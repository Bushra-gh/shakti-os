"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitEvent, type Event, type Venue } from "@/lib/api";

/** A real operator-authored report, never a generated sensor signal. */
export function SignalDialog({ onCreated, venues = [] }: { onCreated?: (event: Event) => void; venues?: Venue[] }) {
  const [open, setOpen] = useState(false);
  const [venueId, setVenueId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [confidence, setConfidence] = useState("");
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const selectedVenue = useMemo(() => venues.find((venue) => venue.id === venueId), [venues, venueId]);
  const selectedZone = selectedVenue?.zones.find((zone) => zone.id === zoneId);
  const confidenceNumber = Number(confidence);
  const valid = Boolean(selectedZone && note.trim() && category && urgency && confidence.trim())
    && Number.isFinite(confidenceNumber) && confidenceNumber >= 0 && confidenceNumber <= 100;

  const submit = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!valid || !selectedZone || !selectedVenue || sending) return;
    setSending(true);
    setSent(false);
    setFailure(null);
    try {
      const created = await submitEvent({
        type: "citizen_report",
        source: "dashboard_observation",
        location: selectedZone.id,
        confidence: confidenceNumber / 100,
        payload: {
          venue_event_id: selectedVenue.id,
          zone_id: selectedZone.id,
          latitude: selectedZone.latitude,
          longitude: selectedZone.longitude,
          description: note.trim(),
          category,
          urgency,
        },
      });
      onCreated?.(created);
      setSent(true);
      setNote("");
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Observation could not be saved.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-lg font-medium" size="sm" />}>
        <Signal className="size-4" aria-hidden />New observation
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-md">
        <DialogHeader><DialogTitle className="text-xl font-medium tracking-[-0.03em]">Record an observation</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Record what you actually observed. This creates a report linked to your authenticated identity; it does not generate sensor measurements.</p>
        <form className="space-y-4 pt-2" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="signal-venue">Venue</label>
              <Select value={venueId} onValueChange={(value) => { setVenueId(value ?? ""); setZoneId(""); }}>
                <SelectTrigger id="signal-venue" className="h-11 w-full rounded-lg bg-muted font-medium"><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>{venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="signal-zone">Zone</label>
              <Select value={zoneId} onValueChange={(value) => setZoneId(value ?? "")}>
                <SelectTrigger id="signal-zone" className="h-11 w-full rounded-lg bg-muted font-medium"><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>{selectedVenue?.zones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground" htmlFor="signal-category">Category</label><Select value={category} onValueChange={(value) => setCategory(value ?? "")}><SelectTrigger id="signal-category" className="h-11 w-full rounded-lg bg-muted"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{["crowding", "blocked_access", "medical", "safety", "other"].map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground" htmlFor="signal-urgency">Urgency</label><Select value={urgency} onValueChange={(value) => setUrgency(value ?? "")}><SelectTrigger id="signal-urgency" className="h-11 w-full rounded-lg bg-muted"><SelectValue placeholder="Select urgency" /></SelectTrigger><SelectContent>{["low", "medium", "high", "critical", "unknown"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground" htmlFor="signal-confidence">Your confidence in this observation (%)</label><Input id="signal-confidence" type="number" min={0} max={100} required value={confidence} onChange={(event) => setConfidence(event.target.value)} className="h-11 rounded-lg bg-muted" /></div>
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground" htmlFor="signal-note">What did you observe?</label><Textarea id="signal-note" className="min-h-24 rounded-lg bg-muted" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe the observation" required maxLength={2000} /></div>
          {!venues.length && <p className="text-sm text-warning-foreground" role="status">No observation zones are available from the API.</p>}
          <Button className="h-11 w-full rounded-lg font-medium" disabled={sending || !valid} type="submit">{sending ? "Saving…" : "Save observation"}</Button>
          {sent && <p className="flex items-center gap-2 text-sm font-medium text-success" role="status"><CheckCircle2 className="size-4" aria-hidden />Observation accepted by the backend.</p>}
          {failure && <p className="text-sm font-medium text-destructive" role="alert">{failure}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
