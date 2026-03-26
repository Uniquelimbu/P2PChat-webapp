import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/app-context";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatBytes, cn } from "@/lib/utils";
import {
  Terminal, Trash2, Pause, Play, ArrowDown, ArrowUp,
  Activity, ChevronDown, ChevronRight, Plug, PlugZap, Wifi,
} from "lucide-react";
import type { ProtocolLog } from "@/context/app-context";

// ── Frame type badge config ───────────────────────────────────────
const FRAME_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  WS_HANDSHAKE: {
    label: "HANDSHAKE",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  CTRL: {
    label: "CTRL",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  DATA: {
    label: "DATA",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  DM: {
    label: "DM",
    className: "bg-accent/15 text-accent border-accent/30",
  },
  CLOSE: {
    label: "CLOSE",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  TEXT: {
    label: "TEXT",
    className: "bg-muted/50 text-muted-foreground border-border",
  },
  BINARY: {
    label: "BINARY",
    className: "bg-muted/50 text-muted-foreground border-border",
  },
};

function FrameBadge({ type }: { type?: string }) {
  const cfg = type ? (FRAME_TYPE_CONFIG[type] ?? FRAME_TYPE_CONFIG["TEXT"]) : null;
  if (!cfg) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 sm:px-2.5 sm:py-1.5 rounded text-[9px] sm:text-[10px] font-bold font-mono border tracking-widest",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

// ── Event icon + color ────────────────────────────────────────────
function eventMeta(log: ProtocolLog) {
  switch (log.event) {
    case "CONNECT":
      return { icon: <PlugZap className="w-4 h-4 sm:w-4.5 sm:h-4.5" />, color: "text-blue-400", bg: "border-blue-500/20 bg-blue-500/5" };
    case "DISCONNECT":
      return { icon: <Plug className="w-4 h-4 sm:w-4.5 sm:h-4.5" />, color: "text-destructive", bg: "border-destructive/20 bg-destructive/5" };
    case "ERROR":
      return { icon: <Wifi className="w-4 h-4 sm:w-4.5 sm:h-4.5" />, color: "text-destructive", bg: "border-destructive/20 bg-destructive/10" };
    case "SENT":
      return { icon: <ArrowUp className="w-4 h-4 sm:w-4.5 sm:h-4.5" />, color: "text-primary", bg: "border-primary/20 bg-primary/5" };
    case "RECEIVED":
      return { icon: <ArrowDown className="w-4 h-4 sm:w-4.5 sm:h-4.5" />, color: "text-accent", bg: "border-accent/20 bg-accent/5" };
    default:
      return { icon: null, color: "text-muted-foreground", bg: "border-border bg-card/50" };
  }
}

function LogEntry({ log }: { log: ProtocolLog }) {
  const [expanded, setExpanded] = useState(false);
  const { icon, color, bg } = eventMeta(log);
  const hasData = !!log.data;
  const payload = log.data && typeof log.data === "object" ? (log.data as Record<string, unknown>) : null;

  const detailRows: Array<{ label: string; value: string }> = [
    { label: "Event", value: log.event },
    { label: "Frame", value: log.frameType || "TEXT" },
    { label: "Payload", value: formatBytes(log.payloadSize) },
    { label: "Time", value: format(log.timestamp, "HH:mm:ss.SSS") },
  ];

  if (payload) {
    const interestingKeys = ["type", "action", "messageType", "roomId", "peerId", "senderId", "senderName", "targetId"];
    for (const key of interestingKeys) {
      const value = payload[key];
      if (value !== undefined && value !== null && value !== "") {
        detailRows.push({
          label: key,
          value: typeof value === "string" || typeof value === "number" || typeof value === "boolean"
            ? String(value)
            : JSON.stringify(value),
        });
      }
    }
  }

  return (
    <div
      className={cn(
        "rounded-md border transition-colors text-[10px] sm:text-[11px] font-mono overflow-hidden",
        bg,
        hasData && "cursor-pointer hover:brightness-110"
      )}
      onClick={() => hasData && setExpanded((v) => !v)}
    >
      {/* Top row: timestamp + size + expand toggle */}
      <div className="flex items-center justify-between gap-2 px-2 sm:px-2.5 pt-2 pb-1 opacity-60 text-[9px] sm:text-[10px]">
        <span className="text-muted-foreground min-w-0 truncate">{format(log.timestamp, "HH:mm:ss.SSS")}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-muted-foreground whitespace-nowrap">{formatBytes(log.payloadSize)}</span>
          {hasData && (
            <span className="text-muted-foreground">
              {expanded ? <ChevronDown className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <ChevronRight className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
            </span>
          )}
        </div>
      </div>

      {/* Middle row: event + badge */}
      <div className="flex items-center justify-between gap-2 px-2 sm:px-2.5 pb-2">
        <span className={cn("flex items-center gap-1 font-bold text-xs sm:text-sm min-w-0", color)}>
          {icon}
          <span className="truncate">[{log.event}]</span>
        </span>
        <span className="flex-shrink-0">
          <FrameBadge type={log.frameType} />
        </span>
      </div>

      {/* Expanded protocol details */}
      <AnimatePresence mode="wait">
        {expanded && hasData && (
          <motion.div
            key="payload"
            layout
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full overflow-hidden"
          >
            <div className="border-t border-white/5 bg-black/35 px-2 sm:px-2.5 py-2 sm:py-2.5 space-y-2">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 sm:gap-x-3 gap-y-1.5 text-[9px] sm:text-[10px] items-start">
                {detailRows.map((row) => (
                  <React.Fragment key={row.label}>
                    <span className="text-muted-foreground/70 uppercase tracking-wide whitespace-nowrap">{row.label}</span>
                    <span className="text-gray-200 font-medium break-all" title={row.value}>{row.value}</span>
                  </React.Fragment>
                ))}
              </div>

              <div className="pt-1">
                <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1">Raw Payload</div>
                <div className="overflow-x-auto rounded border border-white/5 bg-black/40">
                  <pre className="px-2 sm:px-2.5 pb-2 sm:pb-2.5 pt-2 text-[9px] sm:text-[10px] leading-relaxed text-gray-300 whitespace-pre-wrap break-all w-full">
                    {typeof log.data === "object"
                      ? JSON.stringify(log.data, null, 2)
                      : String(log.data)}
                  </pre>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProtocolInspector() {
  const { logs, isInspectorOpen, clearLogs, isLogsPaused, setIsLogsPaused } = useApp();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new logs arrive and not paused
  useEffect(() => {
    if (!isLogsPaused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length, isLogsPaused]);

  return (
    <AnimatePresence>
      {isInspectorOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 384, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="h-full flex-shrink-0 border-l border-border bg-[#080810] flex flex-col relative overflow-hidden"
        >
          <div className="scanlines absolute inset-0 pointer-events-none opacity-20" />

          {/* Header */}
          <div className="h-14 sm:h-16 border-b border-border flex items-center justify-between px-3 sm:px-4 bg-[#080810] z-10 relative flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-accent flex-shrink-0" />
              <span className="text-xs sm:text-sm font-mono font-bold text-accent tracking-widest truncate">
                PROTO_TRACE
              </span>
              {logs.length > 0 && (
                <span className="text-[9px] sm:text-[10px] font-mono px-2 py-1 rounded bg-accent/10 text-accent/70 border border-accent/20 flex-shrink-0">
                  {logs.length}
                </span>
              )}
              {isLogsPaused && (
                <span className="text-[9px] sm:text-[10px] font-mono px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse flex-shrink-0">
                  PAUSED
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 sm:h-9 w-8 sm:w-9 transition-colors touch-target",
                  isLogsPaused
                    ? "text-yellow-400 hover:text-yellow-300"
                    : "text-muted-foreground hover:text-accent"
                )}
                onClick={() => setIsLogsPaused(!isLogsPaused)}
                title={isLogsPaused ? "Resume capture" : "Pause capture"}
              >
                {isLogsPaused ? <Play className="w-4 h-4 sm:w-5 sm:h-5" /> : <Pause className="w-4 h-4 sm:w-5 sm:h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 sm:h-9 w-8 sm:w-9 text-muted-foreground hover:text-destructive transition-colors touch-target"
                onClick={clearLogs}
                title="Clear trace"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>

          {/* Log Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto scrollbar-custom p-2 sm:p-2.5 space-y-2 z-10 relative"
          >
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-3 font-mono text-xs sm:text-sm">
                <Activity className="w-8 h-8 sm:w-10 sm:h-10 opacity-20" />
                <span>AWAITING_PACKETS...</span>
                <span className="text-[10px] sm:text-xs opacity-60">Events appear here as they occur</span>
              </div>
            ) : (
              logs.map((log) => <LogEntry key={log.id} log={log} />)
            )}
            <div ref={bottomRef} />
          </div>

          {/* Bottom fade overlay hint */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#080810] to-transparent pointer-events-none z-20" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
