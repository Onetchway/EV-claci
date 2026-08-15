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
import {
  isRegisteredAndActive, markOffline, registerConnection, unregisterConnection,
} from "./registry.js";
import { sweepStaleConnections, OFFLINE_SWEEP_MS } from "./tickets.js";

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

wss.on("connection", (ws: WebSocket, req) => {
  const chargePointId = chargePointIdFromUrl(req.url);
  if (!chargePointId) {
    ws.close(1008, "Connect to /ocpp/<chargePointId>");
    return;
  }

  // Only charger IDs registered (and left active) in the CRM dashboard may
  // connect — closes the "anyone who guesses an ID can pose as a charger"
  // gap. The check is async, so hold off wiring up message/close handlers
  // until it resolves; a charger rejected here should simply retry later
  // rather than error, which is normal OCPP reconnect behavior.
  void isRegisteredAndActive(chargePointId).then((allowed) => {
    if (!allowed) {
      console.warn(`[ws] ${chargePointId} rejected — no active registration in chargerRegistry.`);
      ws.close(1008, "Unknown or inactive charger ID");
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
        try {
          const result = await handleCall(chargePointId, action, payload);
          ws.send(
            result.ok
              ? encodeCallResult(uniqueId, result.payload)
              : encodeCallError(uniqueId, result.errorCode, result.errorDescription),
          );
        } catch (err) {
          console.error(`[ws] ${chargePointId} handler error for ${action}:`, err);
          ws.send(encodeCallError(uniqueId, "InternalError", (err as Error).message));
        }
        return;
      }

      if (isCallResult(frame)) {
        const [, uniqueId, resultPayload] = frame;
        if (!resolveCommand(uniqueId, resultPayload)) {
          console.log(`[ws] ${chargePointId} sent an unsolicited CallResult: ${raw.slice(0, 200)}`);
        }
        return;
      }
      if (isCallError(frame)) {
        const [, uniqueId, errorCode, errorDescription] = frame;
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
