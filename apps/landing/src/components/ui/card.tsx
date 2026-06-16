import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ref, ...props }: ComponentProps<"div">) {
  return <div ref={ref} className={cn("rounded-[24px] border border-ink/[0.07] bg-canvas shadow-soft", className)} {...props} />;
}
