import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/context/app-context";
import { useGetMessages, getGetMessagesQueryKey } from "@workspace/api-client-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, Send, Server, Network, Lock, ArrowDown, AlertCircle } from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

// ── Date separator ────────────────────────────────────────────────
function DateSeparator({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) label = "TODAY";
  else if (isYesterday(date)) label = "YESTERDAY";
  else label = format(date, "MMMM d, yyyy").toUpperCase();

  return (
    <div className="flex items-center gap-3 my-3 select-none">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[10px] font-mono text-muted-foreground/40 tracking-widest px-1">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

// ── Avatar initial ────────────────────────────────────────────────
function Avatar({ name, isMe }: { name: string; isMe: boolean }) {
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-xs border flex-shrink-0",
        isMe
          ? "bg-accent/20 border-accent/40 text-accent"
          : "bg-primary/10 border-primary/30 text-primary"
      )}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function MessageArea() {
  const {
    activeRoom, activeRoomMessages, setActiveRoomMessages,
    activeDm, dmMessages, clearUnread,
    username, isInspectorOpen, setIsInspectorOpen,
  } = useApp();
  const { status, sendMessage, sendDm, dmError, clearDmError } = useWebSocket();
  const [content, setContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // ── Room: fetch history ───────────────────────────────────────
  const { data: initialMessages, isFetching } = useGetMessages(
    activeRoom?.id || "",
    {},
    {
      query: {
        queryKey: getGetMessagesQueryKey(activeRoom?.id || ""),
        enabled: !!activeRoom?.id && !activeDm,
        staleTime: 0,
      },
    }
  );

  const syncedRoomRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeDm) return;
    if (!activeRoom?.id) {
      setActiveRoomMessages([]);
      syncedRoomRef.current = null;
      return;
    }
    if (syncedRoomRef.current !== activeRoom.id) {
      setActiveRoomMessages([]);
      syncedRoomRef.current = activeRoom.id;
    }
    if (!isFetching && initialMessages) {
      // Merge fetched history with any live messages already in state to avoid
      // overwriting real-time messages that arrived during the fetch or while in a DM.
      setActiveRoomMessages((prev) => {
        if (prev.length === 0) return initialMessages;
        const fetchedIds = new Set(initialMessages.map((m) => m.id));
        const liveOnly = prev.filter((m) => !fetchedIds.has(m.id));
        if (liveOnly.length === 0) return initialMessages;
        return [...initialMessages, ...liveOnly].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.id, isFetching, activeDm]);

  // Clear unread when DM opened
  useEffect(() => {
    if (activeDm) clearUnread(activeDm.id);
  }, [activeDm, clearUnread]);

  // Scroll tracking
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
  }, []);

  // Scroll to bottom on new messages (only when already near bottom)
  const messagesKey = activeDm
    ? (dmMessages[activeDm.id] || []).length
    : activeRoomMessages.length;

  useEffect(() => {
    if (!showScrollBtn && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesKey, showScrollBtn]);

  // Initial scroll to bottom when switching conversations
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setShowScrollBtn(false);
    }
  }, [activeRoom?.id, activeDm?.id]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setShowScrollBtn(false);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || status !== "OPEN") return;
    clearDmError();
    if (activeDm) sendDm(activeDm.id, content);
    else if (activeRoom) sendMessage(content);
    setContent("");
  };

  // ── No selection ───────────────────────────────────────────────
  if (!activeRoom && !activeDm) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground/40 gap-4 relative">
        <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />
        <Network className="w-14 h-14 opacity-15" />
        <div className="text-center z-10">
          <h2 className="font-mono text-lg tracking-widest text-muted-foreground/60">
            NO_CHANNEL_SELECTED
          </h2>
          <p className="text-sm mt-2 text-muted-foreground/40">
            Pick a room or click a peer to start transmitting.
          </p>
        </div>
      </div>
    );
  }

  // ── Data to render ─────────────────────────────────────────────
  const dmConvo = activeDm ? dmMessages[activeDm.id] || [] : [];
  const roomMessages = activeDm ? [] : activeRoomMessages;

  // Merge room or DM messages into a unified list with date separators
  type Item =
    | { kind: "date"; key: string; date: Date }
    | { kind: "msg"; key: string; data: (typeof roomMessages)[0] | (typeof dmConvo)[0]; isMe: boolean; isConsecutive: boolean };

  const items: Item[] = [];
  const allMsgs = activeDm ? dmConvo : roomMessages;
  let lastDate: Date | null = null;
  let lastSenderId: string | null = null;
  let lastTime: number | null = null;

  allMsgs.forEach((msg) => {
    const ts = new Date(msg.timestamp);
    if (!lastDate || !isSameDay(lastDate, ts)) {
      items.push({ kind: "date", key: `date-${ts.toDateString()}`, date: ts });
      lastDate = ts;
      lastSenderId = null;
      lastTime = null;
    }
    const isMe = activeDm
      ? (msg as typeof dmConvo[0]).direction === "SENT"
      : (msg as typeof roomMessages[0]).senderName === username;
    const senderId = activeDm
      ? (isMe ? "me" : (msg as typeof dmConvo[0]).senderId)
      : (msg as typeof roomMessages[0]).senderName;
    const isConsecutive =
      lastSenderId === senderId &&
      lastTime !== null &&
      ts.getTime() - lastTime < 60_000;

    items.push({ kind: "msg", key: msg.id, data: msg, isMe, isConsecutive });
    lastSenderId = senderId;
    lastTime = ts.getTime();
  });

  return (
    <div className="flex-1 flex flex-col bg-background h-full relative overflow-hidden">

      {/* Header */}
      <div className="h-14 sm:h-16 border-b border-border flex items-center justify-between px-3 sm:px-5 bg-card/20 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {activeDm ? (
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center font-mono font-bold text-xs sm:text-sm text-accent flex-shrink-0">
                {activeDm.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-accent text-sm sm:text-base truncate">{activeDm.name}</span>
                  <span className="text-[9px] sm:text-xs bg-accent/10 text-accent/70 border border-accent/20 px-1.5 py-0.5 rounded font-mono whitespace-nowrap hidden sm:flex items-center gap-1 flex-shrink-0">
                    <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> PRIVATE
                  </span>
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground/50 font-mono">{activeDm.ip}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-primary font-bold text-lg sm:text-xl">#</span>
              <span className="font-semibold text-sm sm:text-base truncate">{activeRoom!.name}</span>
            </div>
          )}

          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                status === "OPEN" ? "bg-primary animate-pulse" :
                status === "CONNECTING" ? "bg-yellow-500 animate-bounce" : "bg-destructive"
              )}
            />
            <span className={cn(
              "text-[10px] sm:text-xs font-mono hidden sm:block",
              status === "OPEN" ? "text-primary/70" :
              status === "CONNECTING" ? "text-yellow-500" : "text-destructive"
            )}>
              {status}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsInspectorOpen(!isInspectorOpen)}
          className={cn(
            "font-mono text-[11px] sm:text-xs gap-1.5 h-10 sm:h-11 px-2 sm:px-3 flex-shrink-0 transition-colors touch-target",
            isInspectorOpen
              ? "bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20"
              : "text-muted-foreground hover:text-foreground border border-transparent"
          )}
        >
          <Terminal className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          <span className="hidden sm:block">{isInspectorOpen ? "HIDE" : "INSPECT"}</span>
        </Button>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 flex flex-col scrollbar-custom relative"
      >
        {!activeDm && isFetching && roomMessages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center font-mono text-primary/60 text-xs sm:text-sm animate-pulse">
            LOADING_ARCHIVE...
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground/40 font-mono text-xs sm:text-sm">
            {activeDm ? (
              <>
                <Lock className="w-8 h-8 sm:w-10 sm:h-10 opacity-20" />
                <span>SECURE CHANNEL OPEN</span>
                <span className="text-[11px] sm:text-xs opacity-60">Messages go directly to {activeDm.name}</span>
              </>
            ) : (
              <>
                <Server className="w-8 h-8 sm:w-10 sm:h-10 opacity-20" />
                <span>NO MESSAGES YET</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {items.map((item) => {
              if (item.kind === "date") {
                return <DateSeparator key={item.key} date={item.date} />;
              }

              const { data: msg, isMe, isConsecutive } = item;
              const ts = new Date(msg.timestamp);
              const senderName = activeDm
                ? isMe ? username : (msg as typeof dmConvo[0]).senderName
                : (msg as typeof roomMessages[0]).senderName;
              const senderIp = activeDm
                ? isMe ? undefined : (msg as typeof dmConvo[0]).senderIp
                : (msg as typeof roomMessages[0]).senderIp;

              return (
                <div
                  key={item.key}
                  className={cn("flex gap-2 sm:gap-2.5", isMe ? "flex-row-reverse" : "flex-row", isConsecutive ? "mt-0.5" : "mt-2 sm:mt-3")}
                >
                  {/* Avatar (only on first in group) */}
                  <div className="w-7 sm:w-8 flex-shrink-0 flex flex-col items-center">
                    {!isConsecutive && <Avatar name={senderName} isMe={isMe} />}
                  </div>

                  {/* Content */}
                  <div className={cn("flex flex-col max-w-[75%] sm:max-w-[70%]", isMe ? "items-end" : "items-start")}>
                    {!isConsecutive && (
                      <div className={cn("flex items-baseline gap-2 mb-1", isMe ? "flex-row-reverse" : "flex-row")}>
                        <span className={cn("text-xs sm:text-sm font-semibold", isMe ? "text-accent" : "text-primary")}>
                          {senderName}
                        </span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground/50 font-mono">
                          {format(ts, "HH:mm")}
                        </span>
                        {!isMe && senderIp && (
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground/30 font-mono hidden md:block">
                            [{senderIp}]
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      className={cn(
                        "px-3 sm:px-3.5 py-2 text-xs sm:text-sm leading-relaxed break-words",
                        isMe
                          ? "bg-accent/10 border border-accent/20 text-foreground rounded-2xl rounded-tr-sm"
                          : "bg-card border border-border text-foreground rounded-2xl rounded-tl-sm"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-3 sm:right-5 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all touch-target"
        >
          <ArrowDown className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* DM error banner */}
      {dmError && (
        <div className="mx-3 sm:mx-5 mb-0 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm font-mono">
          <AlertCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5 flex-shrink-0" />
          <span className="flex-1">{dmError}</span>
          <button onClick={clearDmError} className="text-destructive/60 hover:text-destructive ml-1">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 sm:px-5 py-2 sm:py-3 border-t border-border bg-background/50 backdrop-blur-sm flex-shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2 max-w-4xl mx-auto">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-mono font-bold pointer-events-none select-none text-sm sm:text-base">
              &gt;
            </span>
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={activeDm ? `Message ${activeDm.name}...` : "Transmit to channel..."}
              className="pl-7 pr-3 h-10 sm:h-12 rounded-xl bg-card/60 border-border focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/30 text-xs sm:text-sm"
              disabled={status !== "OPEN"}
              autoFocus
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-10 sm:h-12 px-3 sm:px-5 rounded-xl font-mono text-xs sm:text-sm gap-2 flex-shrink-0 touch-target"
            disabled={!content.trim() || status !== "OPEN"}
          >
            <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span className="hidden sm:block">SEND</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
