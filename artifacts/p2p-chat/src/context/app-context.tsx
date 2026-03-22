import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Message, Peer, Room } from "@workspace/api-client-react";

export interface ProtocolLog {
  id: string;
  timestamp: Date;
  event: "CONNECT" | "DISCONNECT" | "ERROR" | "SENT" | "RECEIVED";
  protocol: string;
  frameType?: string;
  payloadSize: number;
  direction?: "UP" | "DOWN";
  data?: unknown;
  ip?: string;
}

export interface DmMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderIp: string;
  targetId: string;
  targetName: string;
  content: string;
  timestamp: string;
  direction: "SENT" | "RECEIVED";
}

interface AppContextType {
  username: string;
  setUsername: (name: string) => void;
  userId: string;
  myClientId: string | null;
  setMyClientId: (id: string) => void;

  activeRoom: Room | null;
  setActiveRoom: (room: Room | null) => void;
  activeRoomMessages: Message[];
  setActiveRoomMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (msg: Message) => void;

  peers: Peer[];
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>;

  activeDm: Peer | null;
  setActiveDm: (peer: Peer | null) => void;
  dmMessages: Record<string, DmMessage[]>;
  // third arg `isActive`: whether the DM conversation is currently open
  addDmMessage: (peerId: string, msg: DmMessage, isActive: boolean) => void;
  unreadDms: Record<string, number>;
  clearUnread: (peerId: string) => void;

  logs: ProtocolLog[];
  addLog: (log: Omit<ProtocolLog, "id" | "timestamp">) => void;
  clearLogs: () => void;
  isLogsPaused: boolean;
  setIsLogsPaused: (paused: boolean) => void;

  isInspectorOpen: boolean;
  setIsInspectorOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameState] = useState(() => localStorage.getItem("p2p_username") || "");
  const [userId] = useState(() => {
    let id = localStorage.getItem("p2p_userid");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("p2p_userid", id);
    }
    return id;
  });

  const setUsername = useCallback((name: string) => {
    localStorage.setItem("p2p_username", name);
    setUsernameState(name);
  }, []);

  const [myClientId, setMyClientId] = useState<string | null>(null);

  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [activeRoomMessages, setActiveRoomMessages] = useState<Message[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);

  const addMessage = useCallback((msg: Message) => {
    setActiveRoomMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });
  }, []);

  // ── DM state ─────────────────────────────────────────────────
  const [activeDm, setActiveDmState] = useState<Peer | null>(null);
  const [dmMessages, setDmMessages] = useState<Record<string, DmMessage[]>>({});
  const [unreadDms, setUnreadDms] = useState<Record<string, number>>({});

  const setActiveDm = useCallback((peer: Peer | null) => setActiveDmState(peer), []);

  const addDmMessage = useCallback((peerId: string, msg: DmMessage, isActive: boolean) => {
    setDmMessages((prev) => {
      const existing = prev[peerId] || [];
      if (existing.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [peerId]: [...existing, msg] };
    });
    // Increment unread only for messages that arrived while the conversation is not open
    if (!isActive && msg.direction === "RECEIVED") {
      setUnreadDms((prev) => ({ ...prev, [peerId]: (prev[peerId] || 0) + 1 }));
    }
  }, []);

  const clearUnread = useCallback((peerId: string) => {
    setUnreadDms((prev) => ({ ...prev, [peerId]: 0 }));
  }, []);

  // ── Protocol logs ─────────────────────────────────────────────
  const [logs, setLogs] = useState<ProtocolLog[]>([]);
  const [isLogsPaused, setIsLogsPausedState] = useState(false);

  // BUG FIX: use a ref so addLog (a stable useCallback) can read the pause state
  // without needing it in its dependency array (which would recreate addLog on every toggle)
  const isLogsPausedRef = useRef(false);

  const setIsLogsPaused = useCallback((paused: boolean) => {
    isLogsPausedRef.current = paused;
    setIsLogsPausedState(paused);
  }, []);

  // BUG FIX: actually gate log accumulation on the pause flag
  const addLog = useCallback((logData: Omit<ProtocolLog, "id" | "timestamp">) => {
    if (isLogsPausedRef.current) return;
    setLogs((prev) => {
      const newLog: ProtocolLog = { ...logData, id: uuidv4(), timestamp: new Date() };
      const updated = [...prev, newLog];
      if (updated.length > 500) return updated.slice(updated.length - 500);
      return updated;
    });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const contextValue = React.useMemo(
    () => ({
      username, setUsername, userId,
      myClientId, setMyClientId,
      activeRoom, setActiveRoom,
      activeRoomMessages, setActiveRoomMessages, addMessage,
      peers, setPeers,
      activeDm, setActiveDm,
      dmMessages, addDmMessage, unreadDms, clearUnread,
      logs, addLog, clearLogs, isLogsPaused, setIsLogsPaused,
      isInspectorOpen, setIsInspectorOpen,
    }),
    [
      username, setUsername, userId,
      myClientId,
      activeRoom, activeRoomMessages, addMessage,
      peers,
      activeDm, setActiveDm, dmMessages, addDmMessage, unreadDms, clearUnread,
      logs, addLog, clearLogs, isLogsPaused, setIsLogsPaused,
      isInspectorOpen,
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error("useApp must be used within an AppProvider");
  return context;
}
