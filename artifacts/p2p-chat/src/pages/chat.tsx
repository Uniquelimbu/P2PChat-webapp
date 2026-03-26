import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/context/app-context";
import { Sidebar } from "@/components/chat/sidebar";
import { MessageArea } from "@/components/chat/message-area";
import { ProtocolInspector } from "@/components/chat/inspector";
import { MobileNav } from "@/components/chat/mobile-nav";

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
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans flex-col md:flex-row">
      {/* Mobile Navigation Drawer */}
      <div className="md:hidden flex-shrink-0 border-b border-border/50 bg-card/30">
        <MobileNav />
      </div>

      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Message Area - responsive width */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <MessageArea />
      </div>

      {/* Desktop Inspector - hidden on mobile/tablet, drawer controlled via MessageArea */}
      <div className="hidden lg:block lg:flex-shrink-0 border-l border-border/50">
        <ProtocolInspector />
      </div>
    </div>
  );
}
