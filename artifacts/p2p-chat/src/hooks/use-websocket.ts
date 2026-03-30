import { useEffect, useRef, useState, useCallback } from "react";
import { useApp } from "@/context/app-context";
import { useWebRTC } from "./use-webrtc";

/**
 * USE WEBSOCKET — SIGNALING ONLY
 * 
 * This hook manages the WebSocket connection to the signaling server.
 * Messages are NOT relayed through this WebSocket — it's only for:
 * - Peer handshake and discovery
 * - SDP offer/answer relay
 * - ICE candidate relay
 * 
 * All actual chat messages go via WebRTC data channels (P2P direct).
 */

type ConnectionStatus = "CONNECTING" | "OPEN" | "CLOSED" | "ERROR";

export function useWebSocket() {
  const { username, activeRoom, addLog, setPeers, setMyClientId, setActiveRoomMessages } = useApp();
  const [status, setStatus] = useState<ConnectionStatus>("CLOSED");
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const connectedPeersRef = useRef<Set<string>>(new Set());
  const shouldReconnectRef = useRef(true);

  // Stable refs
  const addLogRef = useRef(addLog);
  const setPeersRef = useRef(setPeers);
  const setMyClientIdRef = useRef(setMyClientId);
  const setActiveRoomMessagesRef = useRef(setActiveRoomMessages);
  const activeRoomRef = useRef(activeRoom);
  const usernameRef = useRef(username);

  useEffect(() => { addLogRef.current = addLog; }, [addLog]);
  useEffect(() => { setPeersRef.current = setPeers; }, [setPeers]);
  useEffect(() => { setMyClientIdRef.current = setMyClientId; }, [setMyClientId]);
  useEffect(() => { setActiveRoomMessagesRef.current = setActiveRoomMessages; }, [setActiveRoomMessages]);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { usernameRef.current = username; }, [username]);

  // Initialize WebRTC
  const webrtc = useWebRTC(wsRef.current, myPeerId);
  const webrtcRef = useRef(webrtc);
  useEffect(() => {
    webrtcRef.current = webrtc;
  }, [webrtc]);

  const sendSignaling = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    const currentUsername = usernameRef.current;
    if (!currentUsername) return;
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    setStatus("CONNECTING");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl =
      import.meta.env.VITE_SIGNALING_WS_URL ||
      `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("OPEN");
      addLogRef.current({
        event: "CONNECT",
        protocol: "WebSocket",
        frameType: "WS_HANDSHAKE",
        payloadSize: 0,
        data: {
          url: wsUrl,
          status: "HTTP Upgrade → WebSocket handshake complete (Signaling Only)",
          headers: ["Upgrade: websocket", "Connection: Upgrade", "Sec-WebSocket-Version: 13"],
        },
      });
    };

    ws.onmessage = (event) => {
      const payloadSize = new Blob([event.data]).size;
      try {
        const data = JSON.parse(event.data) as Record<string, any>;

        addLogRef.current({
          event: "RECEIVED",
          protocol: "WebSocket",
          frameType: data.frameType || "CTRL",
          direction: "DOWN",
          payloadSize,
          data,
        });

        if (data.type === "joined") {
          // Server confirmed our join
          myPeerIdRef.current = data.peerId as string;
          setMyPeerId(data.peerId as string);
          setMyClientIdRef.current(data.peerId as string);
        } else if (data.type === "peers") {
          // Updated peer list from server
          setPeersRef.current((data.peers || []) as any[]);

          // Check for new peers and initiate connections
          const newPeers = (data.peers || []) as any[];
          const visiblePeerIds = new Set(
            newPeers
              .filter((peer) => peer.id !== myPeerIdRef.current)
              .map((peer) => peer.id as string)
          );

          // Drop stale peer connections that are no longer present in this room view
          for (const conn of webrtcRef.current.getPeerConnections()) {
            if (!visiblePeerIds.has(conn.peerId)) {
              webrtcRef.current.disconnectFromPeer(conn.peerId);
            }
          }

          // Keep connection tracker aligned with the latest room peer list
          connectedPeersRef.current = new Set(
            Array.from(connectedPeersRef.current).filter((id) => visiblePeerIds.has(id))
          );

          const roomId = activeRoomRef.current?.id;

          for (const peer of newPeers) {
            if (
              peer.id !== myPeerIdRef.current &&
              roomId === activeRoomRef.current?.id &&
              !connectedPeersRef.current.has(peer.id)
            ) {
              // We initiate connection (simple: first peer alphabetically is initiator)
              const shouldInitiate = (myPeerIdRef.current || "") < peer.id;
              if (shouldInitiate) {
                connectedPeersRef.current.add(peer.id);
                setTimeout(() => {
                  webrtcRef.current.connectToPeer(peer.id, peer.name, peer.ip);
                }, 100);
              }
            }
          }
        } else if (data.type === "signal:offer") {
          // Incoming SDP offer from another peer
          webrtcRef.current.handleSignalingOffer(
            data.offer as RTCSessionDescriptionInit,
            data.fromPeerId as string,
            data.fromName as string,
            data.fromIp as string
          );
          connectedPeersRef.current.add(data.fromPeerId as string);
        } else if (data.type === "signal:answer") {
          // Incoming SDP answer from another peer
          webrtcRef.current.handleSignalingAnswer(
            data.answer as RTCSessionDescriptionInit,
            data.fromPeerId as string,
            data.fromName as string
          );
        } else if (data.type === "signal:ice-candidate") {
          // Incoming ICE candidate from another peer
          webrtcRef.current.handleIceCandidate(
            data.candidate as RTCIceCandidate,
            data.fromPeerId as string
          );
        }
      } catch (err) {
        addLogRef.current({
          event: "RECEIVED",
          protocol: "WebSocket",
          frameType: "TEXT",
          direction: "DOWN",
          payloadSize,
          data: event.data,
        });
      }
    };

    ws.onclose = (event) => {
      setStatus("CLOSED");
      addLogRef.current({
        event: "DISCONNECT",
        protocol: "WebSocket",
        frameType: "CLOSE",
        payloadSize: 0,
        data: { code: event.code, reason: event.reason || "Connection closed" },
      });
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
      }
    };

    ws.onerror = () => {
      setStatus("ERROR");
      addLogRef.current({
        event: "ERROR",
        protocol: "WebSocket",
        payloadSize: 0,
        data: "WebSocket connection error",
      });
    };
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      webrtcRef.current.disconnectAllPeers();
      wsRef.current?.close(1000, "Component unmounted");
    };
  }, [connect]);

  // Send join whenever room changes OR when connection is OPEN
  useEffect(() => {
    if (status === "OPEN" && activeRoom && username) {
      // Room switch should always start a fresh mesh for room-scoped P2P channels.
      webrtcRef.current.disconnectAllPeers();
      setPeersRef.current([]);
      setActiveRoomMessagesRef.current([]);
      connectedPeersRef.current.clear();

      const joinMsg = { type: "join", roomId: activeRoom.id, name: username };
      sendSignaling(joinMsg);
    }
  }, [activeRoom?.id, status, username, sendSignaling]);

  // Clear connected peers when room changes
  useEffect(() => {
    connectedPeersRef.current.clear();
  }, [activeRoom?.id]);

  const sendMessage = useCallback((content: string) => {
    webrtc.sendGroupMessage(content);
  }, [webrtc]);

  const sendDm = useCallback((targetPeerId: string, content: string) => {
    webrtc.sendDirectMessage(targetPeerId, content);
  }, [webrtc]);

  return {
    status,
    sendMessage,
    sendDm,
    myClientId: myPeerId,
  };
}
