/**
 * WebSocket Server - Handles Chat, Call Signaling & Presence
 *
 * Built on standard Node.js `ws` library (zero vendor lock-in).
 * Integrates:
 * - ConnectionManager for connection lifecycle, subscriptions, presence
 * - Battery-optimized heartbeat system (protocol + application level)
 * - Channel authorization (canSubscribe)
 * - Message handlers for ping, subscribe, unsubscribe, messaging, typing, presence, sync
 * - Auto-subscription to user channels on connect
 * - Context-aware reconnect with exponential backoff + jitter
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";
import {
  ConnectionManager,
  AuthenticatedSocket,
  ConnectionState,
} from "./connection-manager";
import {
  CallConnectionState,
  AppPingMessage,
  AppPongMessage,
  NetworkType,
} from "./battery-heartbeat";
import { WSError, WSErrorCode } from "./reconnect-manager";
import { routeMessage, parseClientMessage } from "./message-handlers";
import { verifyBetterAuthToken } from "./auth-helpers";
import { autoSubscribeConversations } from "./conversation-subscription";
import { initRecoveryState, cleanupRecoveryState } from "./event-recovery";

// Global ConnectionManager instance
export const connectionManager = new ConnectionManager();

/**
 * Extract token from WebSocket upgrade request
 * Supports: Authorization: Bearer <token>, Sec-WebSocket-Protocol: bearer.<token>, or ?token= query param
 */
function extractTokenFromRequest(request: IncomingMessage, url: URL): string | null {
  // 1. Check Authorization header
  const authHeader = request.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // 2. Check Sec-WebSocket-Protocol header
  const protocolHeader = request.headers["sec-websocket-protocol"];
  if (typeof protocolHeader === "string") {
    const protocols = protocolHeader.split(",").map((p) => p.trim());
    const bearerProtocol = protocols.find((p) => p.startsWith("bearer."));
    if (bearerProtocol) {
      return bearerProtocol.slice(7);
    }
  }

  // 3. Query param
  return url.searchParams.get("token");
}

function getClientIp(request: IncomingMessage): string | undefined {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return request.socket?.remoteAddress;
}

function getUserAgent(request: IncomingMessage): string | undefined {
  const ua = request.headers["user-agent"];
  return typeof ua === "string" ? ua : undefined;
}

/**
 * Configure an authenticated socket after upgrade handshake
 */
export async function setupAuthenticatedSocket(
  socket: WebSocket,
  userId: string,
  request: IncomingMessage
): Promise<AuthenticatedSocket> {
  const authSocket = socket as unknown as AuthenticatedSocket;

  // Initialize socket metadata
  authSocket.userId = userId;
  authSocket.isAlive = true;
  authSocket.state = ConnectionState.CONNECTED;
  authSocket.subscriptions = new Set();
  authSocket.lastSequence = 0;
  authSocket.lastEventId = "";
  authSocket.generation = 0;

  const clientIp = getClientIp(request);
  const userAgent = getUserAgent(request);

  // Register with ConnectionManager
  await connectionManager.addConnection(userId, authSocket, {
    ipAddress: clientIp,
    userAgent,
  });

  // Initialize event recovery
  initRecoveryState(authSocket);

  // Auto-subscribe to user conversations
  await autoSubscribeConversations(authSocket, connectionManager);

  // Send connected handshake acknowledgement
  authSocket.send(
    JSON.stringify({
      type: "connected",
      userId,
      serverTime: new Date().toISOString(),
    })
  );

  // Message listener
  authSocket.on("message", async (raw: any) => {
    try {
      let data: string;
      if (typeof raw === "string") {
        data = raw;
      } else if (Buffer.isBuffer(raw)) {
        data = raw.toString("utf-8");
      } else if (raw instanceof ArrayBuffer) {
        data = new TextDecoder().decode(raw);
      } else {
        data = String(raw);
      }

      // Max 16KB per message
      if (data.length > 16_384) {
        authSocket.send(
          JSON.stringify({
            type: "error",
            code: "MESSAGE_TOO_LARGE",
            message: "Message too large (max 16KB)",
          })
        );
        return;
      }

      const message = parseClientMessage(data);
      if (!message) {
        authSocket.send(
          JSON.stringify({
            type: "error",
            code: "INVALID_MESSAGE",
            message: "Invalid message format",
          })
        );
        return;
      }

      if (await handleBatteryHeartbeatMessage(authSocket, message)) {
        return;
      }

      await routeMessage(authSocket, message, connectionManager);
    } catch (err) {
      console.error("[WebSocket] Message error:", err);
      authSocket.send(
        JSON.stringify({
          type: "error",
          code: "INTERNAL_ERROR",
          message: "Internal error",
        })
      );
    }
  });

  // Close listener
  authSocket.on("close", (code: number, reasonBuf: Buffer) => {
    const reason = reasonBuf ? reasonBuf.toString() : "";
    const error = parseCloseCodeForReconnect(code, reason);

    connectionManager.removeConnection(userId, authSocket);
    cleanupRecoveryState(authSocket);

    if (error.recoverable) {
      console.log(
        `[WebSocket] Connection closed with recoverable code: ${error.code}`
      );
    }
  });

  // Error listener
  authSocket.on("error", (err: Error) => {
    console.error("[WebSocket] Socket error:", err);
  });

  return authSocket;
}

/**
 * Attach WebSocketServer to an existing Node.js HTTP server
 */
export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    try {
      const host = request.headers.host || "localhost";
      const url = new URL(request.url || "/", `http://${host}`);

      // Handle paths /ws/v1 and /ws
      if (url.pathname !== "/ws/v1" && url.pathname !== "/ws") {
        return;
      }

      const token = extractTokenFromRequest(request, url);
      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const userId = await verifyBetterAuthToken(token);
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        setupAuthenticatedSocket(ws, userId, request);
      });
    } catch (err) {
      console.error("[WebSocket] Upgrade error:", err);
      socket.destroy();
    }
  });

  console.log("✅ WebSocket server attached (endpoints: /ws/v1, /ws)");
  return wss;
}

/**
 * Handle battery heartbeat specific messages
 */
async function handleBatteryHeartbeatMessage(
  socket: AuthenticatedSocket,
  message: any
): Promise<boolean> {
  if (message.type === "call.pong") {
    const pong = message as AppPongMessage;
    connectionManager.handleAppPong(socket, pong);
    return true;
  }

  if (message.type === "call.ping") {
    const ping = message as AppPingMessage;
    const pong: AppPongMessage = {
      type: "call.pong",
      timestamp: new Date().toISOString(),
      sequence: ping.sequence,
      serverTime: new Date().toISOString(),
    };
    socket.send(JSON.stringify(pong));
    return true;
  }

  if (message.type === "call.state") {
    const { state, callId } = message.payload || {};
    if (state && Object.values(CallConnectionState).includes(state)) {
      connectionManager.setSocketCallState(socket, state as CallConnectionState);
      if (callId) {
        connectionManager.setSocketCallId(socket, callId);
      }
    }
    return true;
  }

  if (message.type === "call.background") {
    const { background } = message.payload || {};
    if (typeof background === "boolean") {
      connectionManager.setSocketBackground(socket, background);
    }
    return true;
  }

  if (message.type === "call.network") {
    const { networkType } = message.payload || {};
    if (networkType && ["wifi", "cellular", "unknown"].includes(networkType)) {
      connectionManager.setSocketNetworkType(socket, networkType as NetworkType);
    }
    return true;
  }

  if (message.type === "call.reconnect") {
    const { callId } = message.payload || {};
    socket.send(
      JSON.stringify({
        type: "call.recovery",
        callId,
        events: [],
        snapshot: null,
        success: true,
      })
    );
    return true;
  }

  return false;
}

/**
 * Parse WebSocket close code to WSError for reconnect policy
 */
function parseCloseCodeForReconnect(code: number, reason: string): WSError {
  switch (code) {
    case 1000:
      return { code: WSErrorCode.CALL_ENDED, message: reason, recoverable: false };
    case 1001:
      return { code: WSErrorCode.CONNECTION_CLOSED, message: reason, recoverable: true };
    case 1002:
      return { code: WSErrorCode.PROTOCOL_ERROR, message: reason, recoverable: true };
    case 1003:
      return { code: WSErrorCode.PROTOCOL_ERROR, message: reason, recoverable: false };
    case 1008:
      return { code: WSErrorCode.PERMISSION_DENIED, message: reason, recoverable: false };
    case 1009:
      return { code: WSErrorCode.PROTOCOL_ERROR, message: reason, recoverable: false };
    case 1011:
      return { code: WSErrorCode.SERVER_UNAVAILABLE, message: reason, recoverable: true };
    case 4001:
      return { code: WSErrorCode.TOKEN_EXPIRED, message: reason, recoverable: false };
    case 4002:
      return { code: WSErrorCode.TOKEN_REVOKED, message: reason, recoverable: false };
    case 4003:
      return { code: WSErrorCode.KICKED_FROM_ROOM, message: reason, recoverable: false };
    case 4004:
      return { code: WSErrorCode.PERMISSION_DENIED, message: reason, recoverable: false };
    default:
      return {
        code: WSErrorCode.UNKNOWN,
        message: `Close code ${code}: ${reason}`,
        recoverable: true,
      };
  }
}
