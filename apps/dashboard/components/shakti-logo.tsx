import Image from "next/image";
import { cn } from "@/lib/utils";

/** Decorative brand mark; the adjacent wordmark or link supplies its label. */
export function ShaktiLogo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/shakti-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  );
}
