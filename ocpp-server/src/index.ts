/**
 * Livanto OCPP 2.0.1 Central System — Phase 1.
 *
 * A charge point connects to  wss://<host>/ocpp/<chargePointId>  with the
 * WebSocket subprotocol "ocpp2.0.1". This server accepts BootNotification,
 * Heartbeat, StatusNotification, Authorize, TransactionEvent and
 * MeterValues, and mirrors live status + session logs into Firestore for
 * the CRM's /chargers page to read.
 *
 * Deliberately NOT here yet: any Call this server *sends* to a charge point
 * (remote start/stop, reset, config changes) — that's Phase 2, once this
 * foundation is proven against real hardware.
 */

import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { initFirebase } from "./firebase.js";
import { handleCall } from "./ocpp/handlers.js";
import {
  encodeCallError, encodeCallResult, isCall, isCallResult, isCallError, parseFrame,
} from "./ocpp/rpc.js";
import {
  isRegisteredAndActive, markOffline, registerConnection, unregisterConnection,
} from "./registry.js";

initFirebase();

const PORT = Number(process.env.PORT) || 8080;
const SUPPORTED_SUBPROTOCOL = "ocpp2.0.1";

const httpServer = createServer((req, res) => {
  if (req.url === "/status") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
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

      // This server doesn't send Calls in Phase 1, so a CallResult/CallError
      // arriving here means the charge point is answering something we
      // never asked — log it, nothing to act on yet.
      if (isCallResult(frame) || isCallError(frame)) {
        console.log(`[ws] ${chargePointId} sent an unsolicited response: ${raw.slice(0, 200)}`);
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
