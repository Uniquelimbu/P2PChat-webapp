import { useEffect, useRef, useState, useCallback } from "react";
import { useApp } from "@/context/app-context";
import type { DmMessage } from "@/context/app-context";
import { v4 as uuidv4 } from "uuid";

type ConnectionStatus = "CONNECTING" | "OPEN" | "CLOSED" | "ERROR";

function resolveFrameType(data: Record<string, unknown>): string {
  if (data.frameType) return String(data.frameType);
  switch (data.type) {
    case "join":
    case "joined":
    case "peers":
    case "system":
    case "dm_error":
      return "CTRL";
    case "chat":
      return "DATA";
    case "dm":
      return "DM";
    default:
      return "TEXT";
  }
}

export function useWebSocket() {
  const { username, userId, activeRoom, activeDm, addLog, addMessage, addDmMessage, setPeers, setMyClientId } =
    useApp();
  const [status, setStatus] = useState<ConnectionStatus>("CLOSED");
  const [dmError, setDmError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientIdRef = useRef<string | null>(null);

  // Stable refs — callbacks and values the WebSocket handlers need without triggering reconnects
  const addLogRef = useRef(addLog);
  const addMessageRef = useRef(addMessage);
  const addDmMessageRef = useRef(addDmMessage);
  const setPeersRef = useRef(setPeers);
  const setMyClientIdRef = useRef(setMyClientId);
  const activeRoomRef = useRef(activeRoom);
  const activeDmRef = useRef(activeDm);
  const usernameRef = useRef(username);
  const userIdRef = useRef(userId);

  useEffect(() => { addLogRef.current = addLog; }, [addLog]);
  useEffect(() => { addMessageRef.current = addMessage; }, [addMessage]);
  useEffect(() => { addDmMessageRef.current = addDmMessage; }, [addDmMessage]);
  useEffect(() => { setPeersRef.current = setPeers; }, [setPeers]);
  useEffect(() => { setMyClientIdRef.current = setMyClientId; }, [setMyClientId]);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { activeDmRef.current = activeDm; }, [activeDm]);
  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const sendRaw = useCallback((dataStr: string, frameType?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const parsed = JSON.parse(dataStr) as Record<string, unknown>;
      const payloadSize = new Blob([dataStr]).size;
      addLogRef.current({
        event: "SENT",
        protocol: "WebSocket",
        frameType: frameType ?? resolveFrameType(parsed),
        direction: "UP",
        payloadSize,
        data: parsed,
      });
      wsRef.current.send(dataStr);
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
    const wsUrl = `${protocol}//${window.location.host}/ws`;
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
          status: "HTTP Upgrade → WebSocket handshake complete",
          headers: ["Upgrade: websocket", "Connection: Upgrade", "Sec-WebSocket-Version: 13"],
        },
      });
      // BUG FIX: do NOT send join here — the useEffect below handles it.
      // Sending it here AND in the effect caused a double join on every (re)connect.
    };

    ws.onmessage = (event) => {
      const payloadSize = new Blob([event.data]).size;
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        const frameType = resolveFrameType(data);

        addLogRef.current({
          event: "RECEIVED",
          protocol: "WebSocket",
          frameType,
          direction: "DOWN",
          payloadSize,
          data,
        });

        if (data.type === "joined") {
          clientIdRef.current = data.clientId as string;
          setMyClientIdRef.current(data.clientId as string);
        } else if (data.type === "dm_error") {
          setDmError((data.detail as string) || "Peer is no longer connected");
        } else if (data.type === "chat") {
          const room = activeRoomRef.current;
          if (room && data.roomId === room.id) {
            addMessageRef.current(data as unknown as Parameters<typeof addMessageRef.current>[0]);
          }
        } else if (data.type === "peers") {
          setPeersRef.current((data.peers || []) as Parameters<typeof setPeersRef.current>[0]);
        } else if (data.type === "dm") {
          const dm = data as unknown as DmMessage;
          const peerId = dm.direction === "SENT" ? dm.targetId : dm.senderId;
          const isActive = activeDmRef.current?.id === peerId;
          addDmMessageRef.current(peerId, dm, isActive);
        }
      } catch {
        addLogRef.current({
          event: "RECEIVED",
          protocol: "WebSocket",
          frameType: typeof event.data === "string" ? "TEXT" : "BINARY",
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
      // BUG FIX: clear any existing reconnect timer before scheduling a new one
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
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
  }, [sendRaw]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close(1000, "Component unmounted");
    };
  }, [connect]);

  // Send join whenever room changes OR when the connection first becomes OPEN
  useEffect(() => {
    if (status === "OPEN" && activeRoom && username) {
      const joinMsg = { type: "join", roomId: activeRoom.id, name: username, userId };
      sendRaw(JSON.stringify(joinMsg), "CTRL");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.id, status]);

  const sendMessage = useCallback(
    (content: string) => {
      const room = activeRoomRef.current;
      if (!room) return;
      sendRaw(
        JSON.stringify({
          type: "message",
          id: uuidv4(),
          roomId: room.id,
          senderId: userIdRef.current,
          senderName: usernameRef.current,
          content,
          timestamp: new Date().toISOString(),
        }),
        "DATA"
      );
    },
    [sendRaw]
  );

  const sendDm = useCallback(
    (targetId: string, content: string) => {
      sendRaw(
        JSON.stringify({
          type: "dm",
          targetId,
          content,
          timestamp: new Date().toISOString(),
        }),
        "DM"
      );
    },
    [sendRaw]
  );

  const clearDmError = useCallback(() => setDmError(null), []);

  return { status, sendMessage, sendDm, myClientId: clientIdRef.current, dmError, clearDmError };
}
