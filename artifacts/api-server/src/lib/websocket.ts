import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import { randomUUID } from "crypto";
import { logger } from "./logger";

/**
 * TRUE P2P SIGNALING SERVER
 * 
 * This server orchestrates peer discovery and connection setup.
 * All messaging happens directly between peers via WebRTC data channels.
 * The server only handles:
 * - Peer registration and discovery (for initial connection setup)
 * - SDP offer/answer relaying
 * - ICE candidate relaying
 * - NO message persistence
 * - NO message relaying (peers communicate directly)
 */

interface SignalingPeer {
  ws: WebSocket;
  id: string;
  name: string;
  ip: string;
  roomId: string;
  connectedAt: string;
}

const peers = new Map<string, SignalingPeer>();

/**
 * Send a message to a specific peer
 */
function sendToPeer(peerId: string, data: object) {
  const peer = peers.get(peerId);
  if (peer?.ws.readyState === WebSocket.OPEN) {
    peer.ws.send(JSON.stringify(data));
  }
}

/**
 * Broadcast peer list update to all peers in a room
 */
function broadcastPeerListInRoom(roomId: string) {
  const roomPeers = Array.from(peers.values())
    .filter((p) => p.roomId === roomId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      ip: p.ip,
      connectedAt: p.connectedAt,
    }));

  for (const peer of peers.values()) {
    if (peer.roomId === roomId && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(JSON.stringify({ type: "peers", peers: roomPeers }));
    }
  }
}

export function getPeers() {
  return Array.from(peers.values()).map((p) => ({
    id: p.id,
    name: p.name,
    ip: p.ip,
    connectedAt: p.connectedAt,
    roomId: p.roomId,
  }));
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  logger.info("WebSocket server initialized on /ws (signaling only)");

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const peerId = randomUUID();
    let signalingPeer: SignalingPeer | null = null;

    logger.info({ peerId, clientIp }, "Signaling peer connected");

    ws.send(
      JSON.stringify({
        type: "system",
        event: "CONNECT",
        frameType: "WS_HANDSHAKE",
        detail: `HTTP Upgrade complete. WebSocket handshake established. Client IP: ${clientIp}`,
        timestamp: new Date().toISOString(),
      })
    );

    ws.on("message", (rawData) => {
      let msg: Record<string, any>;

      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        logger.warn({ peerId }, "Invalid JSON from client");
        return;
      }

      // ── JOIN ROOM (peer discovery) ──────────────────────────
      if (msg.type === "join" && msg.roomId && msg.name) {
        const oldRoomId = signalingPeer?.roomId;
        const connectedAt = signalingPeer?.connectedAt ?? new Date().toISOString();

        signalingPeer = {
          ws,
          id: peerId,
          name: msg.name,
          ip: clientIp,
          roomId: msg.roomId,
          connectedAt,
        };
        peers.set(peerId, signalingPeer);

        logger.info({ peerId, roomId: msg.roomId, name: msg.name }, "Peer joined room");

        // Notify old room
        if (oldRoomId && oldRoomId !== msg.roomId) {
          broadcastPeerListInRoom(oldRoomId);
        }

        // Send confirmation + full peer list
        ws.send(
          JSON.stringify({
            type: "joined",
            frameType: "CTRL",
            peerId,
            ip: clientIp,
            roomId: msg.roomId,
          })
        );

        // Broadcast updated peer list
        broadcastPeerListInRoom(msg.roomId);

      // ── SDP OFFER (relay to target peer) ────────────────────
      } else if (msg.type === "signal:offer" && msg.targetPeerId && msg.offer && signalingPeer) {
        const targetPeerId = msg.targetPeerId;
        logger.info(
          { from: peerId, to: targetPeerId, roomId: signalingPeer.roomId },
          "Relaying SDP offer"
        );

        sendToPeer(targetPeerId, {
          type: "signal:offer",
          fromPeerId: peerId,
          fromName: signalingPeer.name,
          fromIp: clientIp,
          offer: msg.offer,
          timestamp: new Date().toISOString(),
        });

      // ── SDP ANSWER (relay to target peer) ───────────────────
      } else if (msg.type === "signal:answer" && msg.targetPeerId && msg.answer && signalingPeer) {
        const targetPeerId = msg.targetPeerId;
        logger.info(
          { from: peerId, to: targetPeerId, roomId: signalingPeer.roomId },
          "Relaying SDP answer"
        );

        sendToPeer(targetPeerId, {
          type: "signal:answer",
          fromPeerId: peerId,
          fromName: signalingPeer.name,
          answer: msg.answer,
          timestamp: new Date().toISOString(),
        });

      // ── ICE CANDIDATE (relay to target peer) ────────────────
      } else if (msg.type === "signal:ice-candidate" && msg.targetPeerId && msg.candidate && signalingPeer) {
        const targetPeerId = msg.targetPeerId;
        logger.debug(
          { from: peerId, to: targetPeerId },
          "Relaying ICE candidate"
        );

        sendToPeer(targetPeerId, {
          type: "signal:ice-candidate",
          fromPeerId: peerId,
          candidate: msg.candidate,
          timestamp: new Date().toISOString(),
        });
      }
    });

    ws.on("close", () => {
      if (signalingPeer) {
        const roomId = signalingPeer.roomId;
        const name = signalingPeer.name;
        peers.delete(peerId);
        broadcastPeerListInRoom(roomId);
        logger.info({ peerId, name }, "Signaling peer disconnected");
      }
    });

    ws.on("error", (err) => {
      logger.error({ peerId, err }, "WebSocket error");
    });
  });

  return wss;
}
