/* eslint-disable @next/next/no-img-element -- camera MJPEG streams are direct LAN resources. */
"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CircleAlert, CircleCheck, Eye, Pause, Play, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitCameraDetection, type Venue } from "@/lib/api";
import { frameChangeScore } from "@/lib/camera-analysis";

const STORAGE_KEY = "shaktios-local-camera";
const SAMPLE_WIDTH = 160;
const SAMPLE_HEIGHT = 90;
const SAMPLE_INTERVAL_MS = 1_000;
const EVENT_COOLDOWN_MS = 10_000;

type CameraConfig = {
  cameraId: string;
  cameraName: string;
  feedUrl: string;
  venueId: string;
  zoneId: string;
  threshold: number;
};

const EMPTY_CONFIG: CameraConfig = {
  cameraId: "camera-1",
  cameraName: "Local camera",
  feedUrl: "",
  venueId: "",
  zoneId: "",
  threshold: 0.12,
};

function loadConfig(): CameraConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CONFIG;
    const parsed = JSON.parse(raw) as Partial<CameraConfig>;
    return {
      ...EMPTY_CONFIG,
      ...parsed,
      threshold: typeof parsed.threshold === "number" ? parsed.threshold : EMPTY_CONFIG.threshold,
    };
  } catch {
    return EMPTY_CONFIG;
  }
}

function saveConfig(config: CameraConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Camera configuration remains usable for the current browser session.
  }
}

export function CameraMonitor({ venues }: { venues: Venue[] }) {
  const [config, setConfig] = useState<CameraConfig>(EMPTY_CONFIG);
  const [draft, setDraft] = useState<CameraConfig>(EMPTY_CONFIG);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisEnabled, setAnalysisEnabled] = useState(true);
  const [lastScore, setLastScore] = useState(0);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const displayImage = useRef<HTMLImageElement | null>(null);
  const analysisImage = useRef<HTMLImageElement | null>(null);
  const previousFrame = useRef<Uint8ClampedArray | null>(null);
  const lastEventAt = useRef(0);

  useEffect(() => {
    const stored = loadConfig();
    setConfig(stored);
    setDraft(stored);
  }, []);

  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.id === draft.venueId),
    [draft.venueId, venues],
  );
  const selectedZone = selectedVenue?.zones.find((zone) => zone.id === draft.zoneId);

  const stop = () => {
    setFeedUrl(null);
    setFeedError(null);
    setAnalysisError(null);
    setLastScore(0);
    previousFrame.current = null;
  };

  const connect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.feedUrl.trim() || !draft.cameraId.trim() || !draft.cameraName.trim() || !selectedZone) return;
    const next = { ...draft, feedUrl: draft.feedUrl.trim() };
    saveConfig(next);
    setConfig(next);
    setFeedError(null);
    setAnalysisError(null);
    setDetectionError(null);
    setLastDetection(null);
    previousFrame.current = null;
    setFeedUrl(next.feedUrl);
  };

  useEffect(() => {
    if (!feedUrl || !analysisEnabled || !selectedZone) return;
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      setAnalysisError("This browser cannot create a frame-analysis canvas.");
      return;
    }

    const sample = () => {
      const image = analysisImage.current;
      if (!image || !image.complete || image.naturalWidth === 0) return;
      try {
        context.drawImage(image, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
        const current = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;
        const score = frameChangeScore(previousFrame.current, current);
        previousFrame.current = new Uint8ClampedArray(current);
        setLastScore(score);
        setAnalysisError(null);

        if (score < config.threshold || Date.now() - lastEventAt.current < EVENT_COOLDOWN_MS) return;
        lastEventAt.current = Date.now();
        setDetectionError(null);
        void submitCameraDetection({
          camera_id: config.cameraId,
          camera_name: config.cameraName,
          location: selectedZone.id,
          change_score: Number(score.toFixed(4)),
          threshold: config.threshold,
          confidence: 0.75,
        }).then(() => {
          setLastDetection(new Date().toLocaleTimeString());
        }).catch((error: unknown) => {
          setDetectionError(error instanceof Error ? error.message : "Camera detection could not be recorded.");
        });
      } catch {
        setAnalysisError("The feed is visible, but frame analysis needs camera CORS enabled (Access-Control-Allow-Origin).");
      }
    };

    const timer = window.setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [analysisEnabled, config, feedUrl, selectedZone]);

  const status = feedUrl ? "connected" : "stopped";
  const progress = Math.min(100, Math.round((lastScore / Math.max(config.threshold, 0.01)) * 100));

  return (
    <Card className="mb-4 rounded-xl bg-card py-0 ring-0">
      <CardHeader className="px-6 pt-6 pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Camera className="size-5 text-primary" aria-hidden />
              Local camera monitor
            </CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              View a browser-compatible camera feed on the same LAN and turn meaningful frame changes into abnormal-movement events.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <span className={`size-1.5 rounded-full ${status === "connected" ? "bg-success" : "bg-muted-foreground"}`} />
            {status === "connected" ? "Feed connected" : "Not connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
        <div className="min-w-0">
          {feedUrl ? (
            <div className="relative overflow-hidden rounded-xl bg-black">
              <img
                ref={displayImage}
                src={feedUrl}
                alt={`${config.cameraName} live feed`}
                className="aspect-video w-full object-contain"
                onLoad={() => setFeedError(null)}
                onError={() => setFeedError("The dashboard could not load this feed. Check the LAN URL, camera permissions and mixed-content policy.")}
              />
              <img
                ref={analysisImage}
                src={feedUrl}
                alt=""
                crossOrigin="anonymous"
                className="pointer-events-none absolute size-px opacity-0"
                aria-hidden
              />
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white">
                <Radio className="size-3.5 text-red-300" aria-hidden /> Live · {config.cameraName}
              </div>
              {feedError && <p className="absolute right-3 bottom-3 left-3 rounded-md bg-black/75 p-2.5 text-xs text-white" role="alert">{feedError}</p>}
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
              <div>
                <Eye className="mx-auto size-7 text-muted-foreground" aria-hidden />
                <p className="mt-2 text-sm font-medium">No camera feed connected</p>
                <p className="mt-1 text-xs text-muted-foreground">Enter a local HTTP/MJPEG feed URL to begin.</p>
              </div>
            </div>
          )}
          {feedUrl && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Zone: {selectedZone?.label ?? config.zoneId}</span>
              <span>Latest change: {Math.round(lastScore * 100)}%</span>
              {lastDetection && <span className="text-success">Detection sent at {lastDetection}</span>}
            </div>
          )}
        </div>

        <form className="space-y-3" onSubmit={connect}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="camera-name">
              Camera name
              <Input id="camera-name" value={draft.cameraName} maxLength={255} onChange={(event) => setDraft({ ...draft, cameraName: event.target.value })} className="h-10 rounded-lg bg-muted" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="camera-id">
              Camera ID
              <Input id="camera-id" value={draft.cameraId} maxLength={100} onChange={(event) => setDraft({ ...draft, cameraId: event.target.value })} className="h-10 rounded-lg bg-muted" />
            </label>
          </div>
          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="camera-url">
            Local feed URL
            <Input id="camera-url" type="url" value={draft.feedUrl} onChange={(event) => setDraft({ ...draft, feedUrl: event.target.value })} placeholder="http://192.168.1.50/mjpeg" className="h-10 rounded-lg bg-muted" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="camera-venue">
              Venue
              <Select value={draft.venueId} onValueChange={(value) => setDraft({ ...draft, venueId: value ?? "", zoneId: "" })}>
                <SelectTrigger id="camera-venue" className="h-10 w-full rounded-lg bg-muted"><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>{venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="camera-zone">
              Zone
              <Select value={draft.zoneId} onValueChange={(value) => setDraft({ ...draft, zoneId: value ?? "" })}>
                <SelectTrigger id="camera-zone" className="h-10 w-full rounded-lg bg-muted"><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>{selectedVenue?.zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </div>
          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="camera-threshold">
            Change sensitivity · {Math.round(draft.threshold * 100)}%
            <input id="camera-threshold" type="range" min="0.04" max="0.4" step="0.01" value={draft.threshold} onChange={(event) => setDraft({ ...draft, threshold: Number(event.target.value) })} className="w-full accent-primary" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!draft.feedUrl.trim() || !draft.cameraId.trim() || !draft.cameraName.trim() || !selectedZone} className="rounded-lg font-medium">
              <Play className="size-4" aria-hidden /> Connect feed
            </Button>
            <Button type="button" variant="outline" disabled={!feedUrl} onClick={stop} className="rounded-lg font-medium">
              <Pause className="size-4" aria-hidden /> Stop
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <input type="checkbox" checked={analysisEnabled} onChange={(event) => setAnalysisEnabled(event.target.checked)} className="size-4 accent-primary" />
            Detect frame changes and create abnormal-movement events
          </label>
          {analysisEnabled && feedUrl && (
            <div className="rounded-lg bg-muted p-3 text-xs leading-5">
              <p className="font-medium">Analysis status</p>
              <p className="mt-1 text-muted-foreground">{analysisError ?? `Sampling at ${SAMPLE_INTERVAL_MS / 1000}s intervals · trigger at ${Math.round(config.threshold * 100)}% change · cooldown ${EVENT_COOLDOWN_MS / 1000}s`}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background" aria-label={`Frame change ${progress}% of threshold`} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full rounded-full ${lastScore >= config.threshold ? "bg-warning" : "bg-primary"}`} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {detectionError && <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />{detectionError}</p>}
          {!detectionError && lastDetection && <p className="flex items-center gap-1.5 text-xs text-success" role="status"><CircleCheck className="size-3.5" aria-hidden />The detection was added to the normal event and incident pipeline.</p>}
          <p className="text-[11px] leading-5 text-muted-foreground">The browser connects directly to the local feed; this MVP does not discover cameras or store feed credentials. RTSP requires a local gateway that exposes MJPEG, HLS or WebRTC. Frame difference is change detection, not person or crowd recognition.</p>
        </form>
      </CardContent>
    </Card>
  );
}
