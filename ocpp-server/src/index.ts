/**
 * Livanto OCPP 2.0.1 Central System — Phase 1 (connect/see/log) + Phase 2
 * (remote commands, RFID allow-listing, fault/SLA tickets).
 *
 * A charge point connects to  wss://<host>/ocpp/<chargePointId>  with the
 * WebSocket subprotocol "ocpp2.0.1". This server accepts BootNotification,
 * Heartbeat, StatusNotification, Authorize, TransactionEvent and
 * MeterValues, and mirrors live status + session logs into Firestore for
 * the CRM's /chargers page to read.
 *
 * Phase 2 adds the reverse direction: the CRM can ask this server to send a
 * charge point a Call (start/stop/reset/unlock/availability) via the
 * POST /command/<chargerId> endpoint below, and a periodic sweep opens a
 * ticket for chargers that go silent without a clean disconnect.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { COMMAND_ACTIONS, sendCommand, rejectCommand, resolveCommand, type CommandAction } from "./ocpp/commands.js";
import { initFirebase } from "./firebase.js";
import { handleCall } from "./ocpp/handlers.js";
import {
  encodeCallError, encodeCallResult, isCall, isCallResult, isCallError, parseFrame,
} from "./ocpp/rpc.js";
import { logOcppMessage } from "./message-log.js";
import {
  isRegisteredAndActive, markOffline, recordOperationalStatus, registerConnection, unregisterConnection,
} from "./registry.js";
import { sweepStaleConnections, sweepSlaBreaches, OFFLINE_SWEEP_MS } from "./tickets.js";
import { sweepZoneLoads } from "./load-balancer.js";
import { sweepScheduledCharging } from "./depot-scheduling.js";
import { sweepSubscriptionRenewals } from "./subscriptions.js";
import { sweepRevenueGuarantees } from "./revenue-guarantee.js";

initFirebase();

const PORT = Number(process.env.PORT) || 8080;
const SUPPORTED_SUBPROTOCOL = "ocpp2.0.1";
const COMMAND_API_KEY = process.env.COMMAND_API_KEY;

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function handleCommandRequest(req: IncomingMessage, res: ServerResponse, chargerId: string): Promise<void> {
  if (!COMMAND_API_KEY) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "COMMAND_API_KEY is not configured on this server." }));
    return;
  }
  if (req.headers["x-command-key"] !== COMMAND_API_KEY) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Missing or invalid x-command-key." }));
    return;
  }

  try {
    const body = (await readJsonBody(req)) as { action?: string; payload?: unknown };
    if (!body.action || !COMMAND_ACTIONS.includes(body.action as CommandAction)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `action must be one of: ${COMMAND_ACTIONS.join(", ")}` }));
      return;
    }
    const result = await sendCommand(chargerId, body.action as CommandAction, body.payload ?? {});
    if (body.action === "ChangeAvailability") {
      const payload = (body.payload ?? {}) as { evse?: unknown; operationalStatus?: string };
      const resultData = result as { status?: string };
      if (!payload.evse && resultData?.status === "Accepted" && payload.operationalStatus) {
        const status = payload.operationalStatus === "Inoperative" ? "INOPERATIVE" : "OPERATIVE";
        await recordOperationalStatus(chargerId, status).catch(() => undefined);
      }
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, result }));
  } catch (err) {
    const message = (err as Error).message || "Command failed.";
    const notConnected = (err as Error).name === "ChargerNotConnectedError";
    res.writeHead(notConnected ? 409 : 502, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}

const httpServer = createServer((req, res) => {
  if (req.url === "/status") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  const commandMatch = req.method === "POST" && req.url?.match(/^\/command\/([^/?]+)/);
  if (commandMatch) {
    void handleCommandRequest(req, res, decodeURIComponent(commandMatch[1]!));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({
  server: httpServer,
  handleProtocols: (protocols) => {
    // Best-effort: accept whatever the charge point offers so a connection
    // still shows up (and logs) even if firmware only speaks OCPP 1.6 — see
    // README for why that's a real possibility with the deployed hardware.
    // Message *shapes* below are 2.0.1-only, per explicit instruction.
    if (protocols.has(SUPPORTED_SUBPROTOCOL)) return SUPPORTED_SUBPROTOCOL;
    const [first] = protocols;
    return first ?? false;
  },
});

function chargePointIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^\/ocpp\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

/** Reads ?token=... off the connection URL, or the Authorization header (Basic or Bearer) as an alternative — matches the two options the CRM's "Connect to Charger" panel documents. */
function connectionTokenFromRequest(url: string | undefined, headers: IncomingMessage["headers"]): string | null {
  if (url) {
    const match = url.match(/[?&]token=([^&]+)/);
    if (match) return decodeURIComponent(match[1]!);
  }
  const auth = headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6).trim(), "base64").toString("utf8");
      return decoded.split(":")[1] ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

wss.on("connection", (ws: WebSocket, req) => {
  const chargePointId = chargePointIdFromUrl(req.url);
  if (!chargePointId) {
    ws.close(1008, "Connect to /ocpp/<chargePointId>");
    return;
  }
  const token = connectionTokenFromRequest(req.url, req.headers);

  // Only charger IDs registered (and left active) in the CRM dashboard may
  // connect — closes the "anyone who guesses an ID can pose as a charger"
  // gap. A registration with a connectionToken set also requires that
  // token to match. The check is async, so hold off wiring up
  // message/close handlers until it resolves; a charger rejected here
  // should simply retry later rather than error, which is normal OCPP
  // reconnect behavior.
  void isRegisteredAndActive(chargePointId, token).then((allowed) => {
    if (!allowed) {
      console.warn(`[ws] ${chargePointId} rejected — no active/matching registration in chargerRegistry.`);
      ws.close(1008, "Unknown or inactive charger ID, or invalid token");
      return;
    }
    attachChargePoint(chargePointId, ws);
  }).catch((err) => {
    console.error(`[ws] ${chargePointId} registry check failed:`, err);
    ws.close(1011, "Registry check failed");
  });
});

function attachChargePoint(chargePointId: string, ws: WebSocket): void {
  const negotiated = (ws as { protocol?: string }).protocol;
  console.log(`[ws] ${chargePointId} connected (subprotocol: ${negotiated || "none offered"})`);
  if (negotiated && negotiated !== SUPPORTED_SUBPROTOCOL) {
    console.warn(
      `[ws] ${chargePointId} negotiated "${negotiated}", not "${SUPPORTED_SUBPROTOCOL}" — ` +
        "this server only understands OCPP 2.0.1 message shapes, so calls from this charge point will likely fail to parse.",
    );
  }
  registerConnection(chargePointId, ws);

  ws.on("message", (data) => {
    void (async () => {
      const raw = data.toString();
      const frame = parseFrame(raw);
      if (!frame) {
        console.warn(`[ws] ${chargePointId} sent an unparseable frame: ${raw.slice(0, 200)}`);
        return;
      }

      if (isCall(frame)) {
        const [, uniqueId, action, payload] = frame;
        logOcppMessage(chargePointId, "IN", "Call", action, uniqueId, payload);
        try {
          const result = await handleCall(chargePointId, action, payload);
          if (result.ok) {
            logOcppMessage(chargePointId, "OUT", "CallResult", action, uniqueId, result.payload);
            ws.send(encodeCallResult(uniqueId, result.payload));
          } else {
            logOcppMessage(chargePointId, "OUT", "CallError", action, uniqueId, { errorCode: result.errorCode, errorDescription: result.errorDescription });
            ws.send(encodeCallError(uniqueId, result.errorCode, result.errorDescription));
          }
        } catch (err) {
          console.error(`[ws] ${chargePointId} handler error for ${action}:`, err);
          logOcppMessage(chargePointId, "OUT", "CallError", action, uniqueId, { errorCode: "InternalError", message: (err as Error).message });
          ws.send(encodeCallError(uniqueId, "InternalError", (err as Error).message));
        }
        return;
      }

      if (isCallResult(frame)) {
        const [, uniqueId, resultPayload] = frame;
        logOcppMessage(chargePointId, "IN", "CallResult", null, uniqueId, resultPayload);
        if (!resolveCommand(uniqueId, resultPayload)) {
          console.log(`[ws] ${chargePointId} sent an unsolicited CallResult: ${raw.slice(0, 200)}`);
        }
        return;
      }
      if (isCallError(frame)) {
        const [, uniqueId, errorCode, errorDescription] = frame;
        logOcppMessage(chargePointId, "IN", "CallError", null, uniqueId, { errorCode, errorDescription });
        if (!rejectCommand(uniqueId, errorCode, errorDescription)) {
          console.log(`[ws] ${chargePointId} sent an unsolicited CallError: ${raw.slice(0, 200)}`);
        }
      }
    })();
  });

  ws.on("close", () => {
    console.log(`[ws] ${chargePointId} disconnected`);
    unregisterConnection(chargePointId);
    void markOffline(chargePointId).catch((err) => console.error(`[ws] markOffline failed for ${chargePointId}:`, err));
  });

  ws.on("error", (err) => {
    console.error(`[ws] ${chargePointId} error:`, err);
  });
}

httpServer.listen(PORT, () => {
  console.log(`OCPP 2.0.1 CSMS listening on :${PORT} (health check at /status, charge points at /ocpp/<id>)`);
});

setInterval(() => {
  sweepStaleConnections().catch((err) => console.error("[sweep] stale-connection sweep failed:", err));
}, OFFLINE_SWEEP_MS);

const LOAD_BALANCE_SWEEP_MS = Number(process.env.LOAD_BALANCE_SWEEP_MS) || 60 * 1000;
setInterval(() => {
  sweepZoneLoads().catch((err) => console.error("[sweep] zone load-balance sweep failed:", err));
}, LOAD_BALANCE_SWEEP_MS);

const SUBSCRIPTION_RENEWAL_SWEEP_MS = Number(process.env.SUBSCRIPTION_RENEWAL_SWEEP_MS) || 60 * 60 * 1000;
setInterval(() => {
  sweepSubscriptionRenewals().catch((err) => console.error("[sweep] subscription renewal sweep failed:", err));
}, SUBSCRIPTION_RENEWAL_SWEEP_MS);

const SLA_BREACH_SWEEP_MS = Number(process.env.SLA_BREACH_SWEEP_MS) || 15 * 60 * 1000;
setInterval(() => {
  sweepSlaBreaches().catch((err) => console.error("[sweep] SLA breach sweep failed:", err));
}, SLA_BREACH_SWEEP_MS);

const REVENUE_GUARANTEE_SWEEP_MS = Number(process.env.REVENUE_GUARANTEE_SWEEP_MS) || 6 * 60 * 60 * 1000;
setInterval(() => {
  sweepRevenueGuarantees().catch((err) => console.error("[sweep] revenue guarantee sweep failed:", err));
}, REVENUE_GUARANTEE_SWEEP_MS);

const DEPOT_SCHEDULE_SWEEP_MS = Number(process.env.DEPOT_SCHEDULE_SWEEP_MS) || 60 * 1000;
setInterval(() => {
  sweepScheduledCharging().catch((err) => console.error("[sweep] depot scheduled-charging sweep failed:", err));
}, DEPOT_SCHEDULE_SWEEP_MS);
