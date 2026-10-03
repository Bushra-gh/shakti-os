import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAX_EVIDENCE_PHOTOS = 3;

/**
 * Photo URLs submitted by the citizen app as `photo_urls` inside the
 * citizen_report payload. Only http(s) strings are returned (max 3), so a
 * malformed payload can never inject javascript:/data: URLs into <img>.
 */
export function photoUrlsFromPayload(payload: Record<string, unknown>): string[] {
  const raw = payload.photo_urls;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url))
    .slice(0, MAX_EVIDENCE_PHOTOS);
}

/** Operator-side thumbnails for citizen photo evidence. Plain <img> avoids remote-image config. */
export function EvidencePhotos({
  urls,
  size = "md",
  className,
}: {
  urls: string[];
  size?: "sm" | "md";
  className?: string;
}) {
  if (urls.length === 0) return null;
  const thumb = size === "sm" ? "h-14 w-14" : "h-20 w-20";
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} aria-label={`${urls.length} photo evidence thumbnail${urls.length === 1 ? "" : "s"}`}>
      {urls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Open full photo evidence in a new tab"
          className={cn(
            "group relative block overflow-hidden rounded-lg border border-border bg-muted",
            thumb,
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Citizen photo evidence"
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </a>
      ))}
    </div>
  );
}

/** Inline "has photos" marker for table cells. */
export function PhotoBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
      title={`${count} photo${count === 1 ? "" : "s"} attached`}
    >
      <Camera className="size-3.5" aria-hidden />
      {count}
    </span>
  );
}
