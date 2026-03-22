import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import { db } from "@workspace/db";
import { messagesTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { logger } from "./logger";

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  name: string;
  ip: string;
  roomId: string;
  connectedAt: string;
}

const clients = new Map<string, ConnectedClient>();

function broadcast(roomId: string, data: object, excludeId?: string) {
  const json = JSON.stringify(data);
  for (const [id, client] of clients.entries()) {
    if (client.roomId === roomId && id !== excludeId) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(json);
      }
    }
  }
}

function broadcastPeers(roomId: string) {
  const peers = Array.from(clients.values())
    .filter((c) => c.roomId === roomId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      ip: c.ip,
      connectedAt: c.connectedAt,
      roomId: c.roomId,
    }));

  for (const client of clients.values()) {
    if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type: "peers", peers }));
    }
  }
}

export function getPeers() {
  return Array.from(clients.values()).map((c) => ({
    id: c.id,
    name: c.name,
    ip: c.ip,
    connectedAt: c.connectedAt,
    roomId: c.roomId,
  }));
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  logger.info("WebSocket server initialized on /ws");

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const clientId = randomUUID();
    let client: ConnectedClient | null = null;

    logger.info({ clientId, clientIp }, "WebSocket client connected");

    ws.send(
      JSON.stringify({
        type: "system",
        event: "CONNECT",
        frameType: "WS_HANDSHAKE",
        detail: `HTTP Upgrade complete. WebSocket handshake established. Client IP: ${clientIp}`,
        timestamp: new Date().toISOString(),
      })
    );

    ws.on("message", async (rawData) => {
      let msg: {
        type: string;
        roomId?: string;
        name?: string;
        content?: string;
        targetId?: string;
      };

      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        logger.warn({ clientId }, "Invalid JSON from client");
        return;
      }

      // ── JOIN ROOM ──────────────────────────────────────────────
      if (msg.type === "join" && msg.roomId && msg.name) {
        const oldRoomId = client?.roomId ?? null;
        // Preserve the original connection time across room switches
        const connectedAt = client?.connectedAt ?? new Date().toISOString();

        client = {
          ws,
          id: clientId,
          name: msg.name,
          ip: clientIp,
          roomId: msg.roomId,
          connectedAt,
        };
        clients.set(clientId, client);

        // BUG FIX: notify the old room that this peer departed
        if (oldRoomId && oldRoomId !== msg.roomId) {
          broadcastPeers(oldRoomId);
          broadcast(oldRoomId, {
            type: "system",
            event: "PEER_LEFT",
            frameType: "CTRL",
            detail: `${msg.name} (${clientIp}) switched to another room`,
            timestamp: new Date().toISOString(),
          });
        }

        ws.send(
          JSON.stringify({
            type: "joined",
            frameType: "CTRL",
            clientId,
            ip: clientIp,
            roomId: msg.roomId,
          })
        );

        broadcastPeers(msg.roomId);

        broadcast(
          msg.roomId,
          {
            type: "system",
            event: "PEER_JOINED",
            frameType: "CTRL",
            detail: `${msg.name} (${clientIp}) joined the room`,
            timestamp: new Date().toISOString(),
          },
          clientId
        );

      // ── ROOM MESSAGE ───────────────────────────────────────────
      } else if (msg.type === "message" && msg.roomId && msg.content && client) {
        const payload = rawData.toString();
        const payloadSize = Buffer.byteLength(payload, "utf8");
        const messageId = randomUUID();
        const timestamp = new Date().toISOString();

        const chatMessage = {
          type: "chat",
          id: messageId,
          roomId: msg.roomId,
          senderId: clientId,
          senderName: client.name,
          senderIp: clientIp,
          content: msg.content,
          timestamp,
          protocol: "WebSocket",
          frameType: "DATA",
          payloadSize,
        };

        broadcast(msg.roomId, { ...chatMessage, direction: "RECEIVED" });
        ws.send(JSON.stringify({ ...chatMessage, direction: "SENT" }));

        try {
          await db.insert(messagesTable).values({
            id: messageId,
            roomId: msg.roomId,
            senderId: clientId,
            senderName: client.name,
            senderIp: clientIp,
            content: msg.content,
            protocol: "WebSocket",
            frameType: "DATA",
            payloadSize,
            direction: "RECEIVED",
          });
        } catch (err) {
          logger.error({ err }, "Failed to persist message");
        }

      // ── DIRECT MESSAGE ─────────────────────────────────────────
      } else if (msg.type === "dm" && msg.targetId && msg.content && client) {
        const target = clients.get(msg.targetId);
        if (!target) {
          ws.send(
            JSON.stringify({
              type: "dm_error",
              frameType: "CTRL",
              detail: `Peer ${msg.targetId} is not connected`,
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        const payload = rawData.toString();
        const payloadSize = Buffer.byteLength(payload, "utf8");
        const messageId = randomUUID();
        const timestamp = new Date().toISOString();

        const dmPayload = {
          type: "dm",
          id: messageId,
          senderId: clientId,
          senderName: client.name,
          senderIp: clientIp,
          targetId: msg.targetId,
          targetName: target.name,
          content: msg.content,
          timestamp,
          protocol: "WebSocket",
          frameType: "DM",
          payloadSize,
        };

        target.ws.send(JSON.stringify({ ...dmPayload, direction: "RECEIVED" }));
        ws.send(JSON.stringify({ ...dmPayload, direction: "SENT" }));

        logger.info({ from: client.name, to: target.name }, "DM delivered");
      }
    });

    ws.on("close", () => {
      if (client) {
        const roomId = client.roomId;
        const name = client.name;
        clients.delete(clientId);
        broadcastPeers(roomId);
        broadcast(roomId, {
          type: "system",
          event: "PEER_LEFT",
          frameType: "CTRL",
          detail: `${name} (${clientIp}) disconnected`,
          timestamp: new Date().toISOString(),
        });
        logger.info({ clientId, name }, "WebSocket client disconnected");
      }
    });

    ws.on("ping", () => {
      logger.debug({ clientId }, "WebSocket ping received");
    });

    ws.on("error", (err) => {
      logger.error({ clientId, err }, "WebSocket error");
    });
  });

  return wss;
}
