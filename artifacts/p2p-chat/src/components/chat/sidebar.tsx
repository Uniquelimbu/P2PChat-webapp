import React, { useState } from "react";
import { useApp, type Room, type Peer } from "@/context/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Hash, Plus, Users, Activity, TerminalSquare, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function Sidebar({ isMobileDrawer = false, onNavigate }: { isMobileDrawer?: boolean; onNavigate?: () => void } = {}) {
  const {
    activeRoom, setActiveRoom,
    activeDm, setActiveDm,
    peers, username, myClientId,
    unreadDms, clearUnread,
    dmMessages,
  } = useApp();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    
    const room: Room = {
      id: newRoomName.toLowerCase().replace(/\s+/g, "-"),
      name: newRoomName,
    };
    
    setIsCreateOpen(false);
    setNewRoomName("");
    setActiveDm(null);
    setActiveRoom(room);
    onNavigate?.();
  };

  const openRoom = (room: Room) => {
    setActiveDm(null);
    setActiveRoom(room);
    onNavigate?.();
  };

  const openDm = (peer: Peer) => {
    setActiveRoom(null);
    setActiveDm(peer);
    clearUnread(peer.id);
    onNavigate?.();
  };

  const otherPeers = myClientId
    ? peers.filter((p) => p.id !== myClientId)
    : peers.filter((p) => p.name !== username);

  return (
    <div className="w-64 border-r border-border bg-card/30 flex flex-col h-full flex-shrink-0">
      {/* Brand header - hidden in mobile drawer */}
      {!isMobileDrawer && (
        <div className="h-14 px-4 border-b border-border flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
            <TerminalSquare className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-mono font-bold text-sm text-primary tracking-widest leading-none">
              P2P_NET
            </div>
            <div className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 tracking-widest mt-0.5">
              LOCAL MESH
            </div>
          </div>
          {/* Online dot */}
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[9px] sm:text-[10px] font-mono text-primary/70">LIVE</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-custom flex flex-col">

        {/* ── ROOMS ─────────────────────────────────────────────── */}
        <div className="p-3 sm:p-4 pb-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Hash className="w-4 sm:w-5 h-4 sm:h-5" /> Rooms
            </span>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="text-muted-foreground/50 hover:text-primary transition-colors rounded p-1 hover:bg-white/5 touch-target"
              title="New room"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {activeRoom ? (
              <button
                onClick={() => openRoom(activeRoom)}
                className={cn(
                  "flex items-center gap-2 w-full text-left px-3 sm:px-3 py-2.5 sm:py-3 rounded-md transition-all font-mono text-xs sm:text-sm group touch-target",
                  "bg-primary/10 text-primary border border-primary/25 shadow-[inset_0_0_8px_hsl(144_100%_50%/0.05)]"
                )}
              >
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-primary">#</span>
                <span className="truncate flex-1">{activeRoom.name}</span>
                <span className={cn(
                  "text-[10px] sm:text-xs px-2 py-1 rounded font-bold flex-shrink-0",
                  "bg-primary/20 text-primary"
                )}>
                  {peers.filter(p => p.roomId === activeRoom.id).length}
                </span>
              </button>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground/50 italic font-mono px-2 py-2">
                No room joined. Create one to start chatting.
              </p>
            )}
          </div>
        </div>

        <div className="mx-3 sm:mx-4 my-1 h-px bg-border/50" />

        {/* ── DIRECT MESSAGES ───────────────────────────────────── */}
        <div className="p-3 sm:p-4 pb-1">
          <div className="mb-3 px-1">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <MessageSquare className="w-4 sm:w-5 h-4 sm:h-5" /> Direct
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {otherPeers.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground/50 italic font-mono px-2 py-2">
                No peers online.
              </p>
            ) : (
              otherPeers.map((peer) => {
                const unread = unreadDms[peer.id] || 0;
                const isActive = activeDm?.id === peer.id;
                const convo = dmMessages[peer.id] || [];
                const lastMsg = convo[convo.length - 1];

                return (
                  <button
                    key={peer.id}
                    onClick={() => openDm(peer)}
                    className={cn(
                      "flex items-center gap-3 w-full text-left px-3 sm:px-3 py-2.5 sm:py-3 rounded-md transition-all group touch-target",
                      isActive
                        ? "bg-accent/10 border border-accent/25 shadow-[inset_0_0_8px_hsl(163_100%_50%/0.05)]"
                        : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "w-8 h-8 sm:w-9 sm:h-9 rounded-md flex items-center justify-center font-mono font-bold text-sm border touch-target",
                        isActive
                          ? "bg-accent/20 border-accent/40 text-accent"
                          : "bg-secondary border-border text-muted-foreground"
                      )}>
                        {peer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border border-background" />
                    </div>

                    {/* Name + last message */}
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm sm:text-base font-medium truncate",
                          isActive ? "text-accent" : "text-foreground"
                        )}>
                          {peer.name}
                        </span>
                        {lastMsg && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground/50 flex-shrink-0 ml-1">
                            {formatDistanceToNow(new Date(lastMsg.timestamp), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="text-xs sm:text-sm text-muted-foreground/60 truncate font-mono mt-1">
                          {lastMsg.direction === "SENT" ? "You: " : ""}{lastMsg.content}
                        </p>
                      )}
                    </div>

                    {/* Unread badge */}
                    {unread > 0 && (
                      <span className="flex-shrink-0 bg-accent text-background text-xs sm:text-sm font-bold rounded-full min-w-6 h-6 flex items-center justify-center px-2">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mx-3 sm:mx-4 my-1 h-px bg-border/50" />

        {/* ── ALL PEERS ─────────────────────────────────────────── */}
        <div className="p-3 sm:p-4">
          <div className="mb-3 px-1">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Activity className="w-4 sm:w-5 h-4 sm:h-5" /> Peers
              <span className="text-muted-foreground/40">({peers.length})</span>
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {peers.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground/50 italic font-mono px-2 py-2 animate-pulse">
                Scanning network...
              </p>
            ) : (
              peers.map((peer) => (
                <div
                  key={peer.id}
                  className="flex items-center gap-3 px-3 sm:px-3 py-2.5 sm:py-3 rounded-md"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center border border-border">
                      <Users className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-background" />
                  </div>
                  <div className="flex-1 overflow-hidden min-w-0">
                    <div className="text-xs sm:text-sm font-medium truncate flex items-center gap-1">
                      {peer.name}
                      {peer.name === username && (
                        <span className="text-[9px] sm:text-[10px] text-primary/50 font-mono">(you)</span>
                      )}
                    </div>
                    <div className="text-[9px] sm:text-xs text-muted-foreground/50 font-mono truncate">
                      {peer.ip}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Self footer ──────────────────────────────────────────── */}
      <div className="px-3 sm:px-4 py-3 sm:py-4 border-t border-border bg-background/30 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center font-mono font-bold text-base sm:text-lg text-accent flex-shrink-0">
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="text-sm sm:text-base font-semibold truncate">{username}</div>
          <div className="text-[10px] sm:text-xs font-mono text-primary/70 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            ONLINE
          </div>
        </div>
      </div>

      {/* Create Room Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-base sm:text-lg">CREATE_SECTOR</DialogTitle>
          </DialogHeader>
          <form id="create-room-form" onSubmit={handleCreateRoom} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs sm:text-sm font-mono text-muted-foreground uppercase tracking-wider">
                Sector Name
              </label>
              <Input
                autoFocus
                placeholder="e.g. general-comms"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value.replace(/\s+/g, "-").toLowerCase())}
                maxLength={32}
                className="h-10 sm:h-12 text-sm sm:text-base"
              />
            </div>
          </form>
          <DialogFooter className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              className="h-10 sm:h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-room-form"
              disabled={newRoomName.length < 1}
              className="h-10 sm:h-11"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
