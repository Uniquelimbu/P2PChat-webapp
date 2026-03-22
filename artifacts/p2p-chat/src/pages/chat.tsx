import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/context/app-context";
import { Sidebar } from "@/components/chat/sidebar";
import { MessageArea } from "@/components/chat/message-area";
import { ProtocolInspector } from "@/components/chat/inspector";

export default function ChatApp() {
  const [_, setLocation] = useLocation();
  const { username } = useApp();

  // Redirect to setup if no username is set
  useEffect(() => {
    if (!username) {
      setLocation("/");
    }
  }, [username, setLocation]);

  if (!username) return null;

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <Sidebar />
      <MessageArea />
      <ProtocolInspector />
    </div>
  );
}
