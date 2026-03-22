import React, { useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/context/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, ShieldAlert } from "lucide-react";

export default function Setup() {
  const [_, setLocation] = useLocation();
  const { username, setUsername } = useApp();
  const [inputVal, setInputVal] = useState(username || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim().length > 1) {
      setUsername(inputVal.trim());
      setLocation("/chat");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="scanlines absolute inset-0 pointer-events-none opacity-30" />
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10 relative">
        <div className="bg-card border border-primary/20 rounded-2xl p-8 shadow-2xl glow-primary flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-4 border-b border-border pb-6">
            <div className="w-16 h-16 rounded-full border border-primary bg-primary/10 flex items-center justify-center glow-primary">
              <Terminal className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-mono font-bold text-foreground tracking-widest">P2P_LOCAL_NET</h1>
              <p className="text-primary font-mono text-sm mt-1">SECURE TERMINAL ACCESS</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6 pt-2">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-yellow-500" />
                ENTER_IDENTITY_ALIAS
              </label>
              <Input
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="e.g. cyber_punk_99"
                className="text-lg py-6 bg-background border-primary/30 focus-visible:ring-primary focus-visible:border-primary text-primary placeholder:text-primary/30"
                autoFocus
                maxLength={20}
              />
            </div>
            
            <Button 
              type="submit" 
              size="lg" 
              className="w-full font-mono text-base tracking-wider"
              disabled={inputVal.trim().length < 2}
            >
              INITIALIZE_CONNECTION
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
