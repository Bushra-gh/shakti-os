"use client";

import { useState } from "react";
import { CheckCircle2, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitEvent, type Event } from "@/lib/api";
import { EVENT_TYPES } from "@/lib/format";

/** Known demo locations (Ranchi gates + Kolkata Durga Puja pandals). Free text still allowed. */
const LOCATION_SUGGESTIONS = [
  "gate_1",
  "gate_2",
  "gate_3",
  "gate_4",
  "gate_9",
  "kol_sreebhumi",
  "kol_santosh_mitra",
  "kol_college_square",
  "kol_mohammad_ali_park",
  "kol_bagbazar",
  "kol_kumartuli",
  "kol_suruchi_sangha",
  "kol_ekdalia",
  "kol_deshapriya_park",
  "kol_maddox_square",
  "kol_chetla_agrani",
  "kol_dumdum_park",
];

/** Test-signal dialog. Writes through POST /events — never local-only. */
export function SignalDialog({ onCreated }: { onCreated?: (event: Event) => void }) {
  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState<string>("crowd_density");
  const [location, setLocation] = useState("gate_4");
  const [intensity, setIntensity] = useState(72);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setSending(true);
    setSent(false);
    setFailed(false);
    try {
      const level = intensity / 100;
      const created = await submitEvent({
        type: eventType,
        source: "dashboard_demo",
        location,
        confidence: level,
        payload:
          eventType === "crowd_density"
            ? { density: level }
            : eventType === "social_concern"
              ? { velocity: level }
              : eventType === "citizen_report"
                ? {
                    description: note.trim() || "Operator test report",
                    category: "other",
                    urgency: "unknown",
                  }
                : { score: level },
      });
      onCreated?.(created);
      setSent(true);
      setTimeout(() => setOpen(false), 1200);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-full font-medium" size="sm" />}>
        <Signal className="size-4" aria-hidden />
        New signal
      </DialogTrigger>
      <DialogContent className="rounded-[1.75rem] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium tracking-[-0.03em]">
            Submit a test signal
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Posts a normalized event to the backend, where correlation and risk run. Nothing is
          stored locally only.
        </p>
        <form className="space-y-4 pt-2" onSubmit={submit}>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="signal-type">
              Signal type
            </label>
            <Select value={eventType} onValueChange={(v) => v && setEventType(v)}>
              <SelectTrigger id="signal-type" className="h-11 w-full rounded-2xl bg-muted font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="signal-intensity">
                Intensity
              </label>
              <span className="text-xs font-semibold tabular-nums">{intensity}%</span>
            </div>
            <input
              id="signal-intensity"
              type="range"
              min={5}
              max={100}
              value={intensity}
              onChange={(event) => setIntensity(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              aria-describedby="signal-intensity-hint"
            />
            <p id="signal-intensity-hint" className="text-[11px] text-muted-foreground">
              Drives density / velocity / score and confidence. Higher values raise the
              deterministic risk contribution.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="signal-location">
              Location
            </label>
            <Input
              id="signal-location"
              className="h-11 rounded-2xl bg-muted font-medium"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              list="signal-location-suggestions"
            />
            <datalist id="signal-location-suggestions">
              {LOCATION_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          {eventType === "citizen_report" && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="signal-note">
                Report description
              </label>
              <Input
                id="signal-note"
                className="h-11 rounded-2xl bg-muted font-medium"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What did the citizen observe?"
              />
            </div>
          )}
          <Button
            className="h-11 w-full rounded-full font-medium"
            disabled={sending || !location.trim()}
            type="submit"
          >
            {sending ? "Sending…" : "Submit signal"}
          </Button>
          {sent && (
            <p className="flex items-center gap-2 text-sm font-medium text-success" role="status">
              <CheckCircle2 className="size-4" aria-hidden />
              Signal accepted by the backend.
            </p>
          )}
          {failed && (
            <p className="text-sm font-medium text-destructive" role="alert">
              Submission failed. Is the API running?
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
