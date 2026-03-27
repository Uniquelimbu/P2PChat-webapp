import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

/**
 * Mobile Navigation Drawer
 * Wraps sidebar in a responsive drawer for mobile devices (< 768px)
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="md:hidden h-10 w-10 flex-shrink-0 border border-border/50"
          title="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 border-r border-border">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        {/* Pass flag to sidebar so it doesn't show brand header in drawer */}
        <div className="h-full">
          <Sidebar isMobileDrawer onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
