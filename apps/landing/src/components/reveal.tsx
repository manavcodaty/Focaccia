"use client";

import { m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduced ? { opacity: 1 } : { opacity: 0, transform: "translateY(28px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay: reduced ? 0 : delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </m.div>
  );
}
