import React, { useState } from "react";
import { useGetRooms, useCreateRoom, Room } from "@workspace/api-client-react";
import { useApp } from "@/context/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Hash, Plus, Users, Activity, TerminalSquare, MessageSquare, Dot } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function Sidebar() {
  const {
    activeRoom, setActiveRoom,
    activeDm, setActiveDm,
    peers, username, myClientId,
    unreadDms, clearUnread,
    dmMessages,
  } = useApp();

  const { data: rooms = [], refetch } = useGetRooms();
  const createRoomMutation = useCreateRoom();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    createRoomMutation.mutate(
      { data: { name: newRoomName } },
      {
        onSuccess: (room) => {
          setIsCreateOpen(false);
          setNewRoomName("");
          refetch();
          setActiveDm(null);
          setActiveRoom(room);
        },
      }
    );
  };

  const openRoom = (room: Room) => {
    setActiveDm(null);
    setActiveRoom(room);
  };

  const openDm = (peer: (typeof peers)[0]) => {
    setActiveRoom(null);
    setActiveDm(peer);
    clearUnread(peer.id);
  };

  const otherPeers = myClientId
    ? peers.filter((p) => p.id !== myClientId)
    : peers.filter((p) => p.name !== username);

  return (
    <div className="w-64 border-r border-border bg-card/30 flex flex-col h-full flex-shrink-0">
      {/* Brand header */}
      <div className="h-14 px-4 border-b border-border flex items-center gap-2.5 flex-shrink-0">
        <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
          <TerminalSquare className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="font-mono font-bold text-sm text-primary tracking-widest leading-none">
            P2P_NET
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/60 tracking-widest mt-0.5">
            LOCAL MESH
          </div>
        </div>
        {/* Online dot */}
        <div className="ml-auto flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[9px] font-mono text-primary/70">LIVE</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-custom flex flex-col">

        {/* ── ROOMS ─────────────────────────────────────────────── */}
        <div className="p-3 pb-1">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Hash className="w-3 h-3" /> Rooms
            </span>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="text-muted-foreground/50 hover:text-primary transition-colors rounded p-0.5"
              title="New room"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {rooms.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 italic font-mono px-2 py-2">
                No rooms yet.
              </p>
            ) : (
              rooms.map((room: Room) => {
                const isActive = activeRoom?.id === room.id && !activeDm;
                const peerCount = (room as Room & { peerCount?: number }).peerCount ?? 0;
                return (
                  <button
                    key={room.id}
                    onClick={() => openRoom(room)}
                    className={cn(
                      "flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-md transition-all font-mono text-xs group",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/25 shadow-[inset_0_0_8px_hsl(144_100%_50%/0.05)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <span className={cn("flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground")}>#</span>
                    <span className="truncate flex-1">{room.name}</span>
                    {peerCount > 0 && (
                      <span className={cn(
                        "text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0",
                        isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {peerCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mx-3 my-1 h-px bg-border/50" />

        {/* ── DIRECT MESSAGES ───────────────────────────────────── */}
        <div className="p-3 pb-1">
          <div className="mb-2 px-1">
            <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Direct
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            {otherPeers.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 italic font-mono px-2 py-2">
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
                      "flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-md transition-all group",
                      isActive
                        ? "bg-accent/10 border border-accent/25 shadow-[inset_0_0_8px_hsl(163_100%_50%/0.05)]"
                        : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-[11px] border",
                        isActive
                          ? "bg-accent/20 border-accent/40 text-accent"
                          : "bg-secondary border-border text-muted-foreground"
                      )}>
                        {peer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-background" />
                    </div>

                    {/* Name + last message */}
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-xs font-medium truncate",
                          isActive ? "text-accent" : "text-foreground"
                        )}>
                          {peer.name}
                        </span>
                        {lastMsg && (
                          <span className="text-[9px] text-muted-foreground/50 flex-shrink-0 ml-1">
                            {formatDistanceToNow(new Date(lastMsg.timestamp), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="text-[10px] text-muted-foreground/60 truncate font-mono mt-0.5">
                          {lastMsg.direction === "SENT" ? "You: " : ""}{lastMsg.content}
                        </p>
                      )}
                    </div>

                    {/* Unread badge */}
                    {unread > 0 && (
                      <span className="flex-shrink-0 bg-accent text-background text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mx-3 my-1 h-px bg-border/50" />

        {/* ── ALL PEERS ─────────────────────────────────────────── */}
        <div className="p-3">
          <div className="mb-2 px-1">
            <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Peers
              <span className="text-muted-foreground/40">({peers.length})</span>
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            {peers.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 italic font-mono px-2 py-2 animate-pulse">
                Scanning network...
              </p>
            ) : (
              peers.map((peer) => (
                <div
                  key={peer.id}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center border border-border">
                      <Users className="w-2.5 h-2.5 text-muted-foreground/60" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary border border-background" />
                  </div>
                  <div className="flex-1 overflow-hidden min-w-0">
                    <div className="text-xs font-medium truncate flex items-center gap-1">
                      {peer.name}
                      {peer.name === username && (
                        <span className="text-[9px] text-primary/50 font-mono">(you)</span>
                      )}
                    </div>
                    <div className="text-[9px] text-muted-foreground/50 font-mono truncate">
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
      <div className="px-3 py-3 border-t border-border bg-background/30 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center font-mono font-bold text-sm text-accent flex-shrink-0">
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="text-sm font-semibold truncate">{username}</div>
          <div className="text-[10px] font-mono text-primary/70 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            ONLINE
          </div>
        </div>
      </div>

      {/* Create Room Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">CREATE_SECTOR</DialogTitle>
          </DialogHeader>
          <form id="create-room-form" onSubmit={handleCreateRoom} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Sector Name
              </label>
              <Input
                autoFocus
                placeholder="e.g. general-comms"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value.replace(/\s+/g, "-").toLowerCase())}
                maxLength={32}
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-room-form"
              disabled={createRoomMutation.isPending || newRoomName.length < 1}
            >
              {createRoomMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
