"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const handlePointer = (event: MouseEvent<HTMLDivElement>) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    ref.current.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  return (
    <m.div
      ref={ref}
      onMouseMove={handlePointer}
      whileHover={reduced ? undefined : { transform: "translateY(-3px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="h-full"
    >
      <Card
        className={cn(
          "spotlight-card relative h-full overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-terracotta/20 hover:shadow-[0_0_0_1px_rgba(93,42,26,0.08),0_28px_70px_-42px_rgba(23,25,28,0.36)]",
          className,
        )}
      >
        {children}
      </Card>
    </m.div>
  );
}
