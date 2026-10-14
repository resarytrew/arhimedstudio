import { cn } from "../utils/cn";

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "text-[44px]" : size === "sm" ? "text-[22px]" : "text-[28px]";
  const s2 = size === "lg" ? "text-[30px]" : size === "sm" ? "text-[15px]" : "text-[19px]";
  return (
    <span className={cn("inline-flex select-none items-baseline gap-1.5 leading-none", className)}>
      <span className={cn("font-hand font-semibold tracking-tight", s)}>Arhimed</span>
      <span className={cn("font-sans font-light", s2)}>Studio</span>
    </span>
  );
}
