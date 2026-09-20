import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Radio, ShieldCheck, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-[#1d1d1f]">
      <nav className="flex items-center justify-between px-6 py-6 sm:px-12 lg:px-20">
        <span className="text-sm font-medium tracking-[0.18em]">SHAKTIOS</span>
        <Link href="/dashboard"><Button className="rounded-full px-5 font-medium" size="sm">Open command center</Button></Link>
      </nav>

      <section className="mx-auto max-w-5xl px-6 pb-28 pt-16 text-center sm:px-10 lg:pt-28">
        <p className="text-[13px] font-medium tracking-[0.18em] text-[#6e6e73] uppercase">Event-driven intelligence</p>
        <h1 className="mx-auto mt-6 max-w-4xl text-[clamp(3.4rem,8vw,7.5rem)] font-medium leading-[0.92] tracking-[-0.07em]">Signals become situations. Situations stay human.</h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg font-light leading-8 text-[#6e6e73] sm:text-xl">
          ShaktiOS fuses crowd density, social concern, abnormal movement, and citizen reports into one evolving incident. Risk is explainable. Response is approved by an operator, then recorded.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard"><Button size="lg" className="rounded-full px-7 font-medium">Enter command center <ArrowUpRight /></Button></Link>
          <a href="#system"><Button variant="outline" size="lg" className="rounded-full px-7 font-medium">See the loop</Button></a>
        </div>
      </section>

      <section id="system" className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4 sm:px-10">
        {[
          ["01", "Detect", "Normalize fragmented observations into a shared event language."],
          ["02", "Correlate", "Group independent evidence by location and time into one incident."],
          ["03", "Estimate", "Compute explainable risk from density, velocity, movement, and reports."],
          ["04", "Decide", "Operators approve status changes and request response workflows."],
        ].map(([index, title, copy]) => (
          <Card key={title} className="rounded-[1.75rem] bg-[#f5f5f7] py-0 ring-0">
            <CardContent className="p-8">
              <p className="text-[12px] font-medium text-[#6e6e73]">{index}</p>
              <h2 className="mt-8 text-2xl font-medium tracking-[-0.04em]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#6e6e73]">{copy}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-4xl font-medium tracking-[-0.05em] sm:text-5xl">A command surface, not a black box.</h2>
          <p className="mt-4 text-lg font-light leading-8 text-[#6e6e73]">ShaktiOS does not predict riots or replace operators. It gives situational awareness and a durable audit trail for human-approved action.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-[1.75rem] bg-[#f5f5f7] py-0 ring-0 lg:col-span-2">
            <CardContent className="flex min-h-[280px] flex-col justify-between p-8 sm:p-10">
              <Radio className="size-7 text-[#0071e3]" />
              <div>
                <h3 className="text-3xl font-medium tracking-[-0.04em]">Review evidence. Approve the next state.</h3>
                <p className="mt-3 max-w-xl text-[#6e6e73]">Move an incident from detected to assessing, responding, or resolved. Every decision is timestamped.</p>
                <Link href="/dashboard" className="mt-6 inline-flex"><Button className="rounded-full font-medium">Open live incidents <ArrowUpRight /></Button></Link>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[1.75rem] bg-[#1d1d1f] py-0 text-white ring-0">
            <CardContent className="flex min-h-[280px] flex-col justify-between p-8">
              <ShieldCheck className="size-7" />
              <div>
                <h3 className="text-2xl font-medium tracking-[-0.04em]">Human-approved handoff</h3>
                <p className="mt-3 text-sm leading-7 text-white/70">When an incident is responding, operators can request an n8n workflow. ShaktiOS never acts autonomously.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[1.75rem] bg-[#f5f5f7] py-0 ring-0">
            <CardContent className="p-8">
              <Waypoints className="mb-10 size-7 text-[#0071e3]" />
              <h3 className="text-2xl font-medium tracking-[-0.04em]">Timeline as memory</h3>
              <p className="mt-3 leading-7 text-[#6e6e73]">Correlated events, status changes, and requested actions stay in one chronological record.</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.75rem] bg-[#f5f5f7] py-0 ring-0 lg:col-span-2">
            <CardContent className="grid min-h-[220px] gap-8 p-8 sm:grid-cols-3">
              {[["Crowd", "Density and movement from the physical world."], ["Social", "Normalized Civic-Shield concern signals."], ["Citizen", "Public reports without exposing identity."]].map(([title, copy]) => (
                <div key={title}>
                  <h4 className="text-xl font-medium">{title}</h4>
                  <p className="mt-3 text-sm leading-7 text-[#6e6e73]">{copy}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="mt-8">
        <div className="relative h-[280px] overflow-hidden sm:h-[360px]">
          <Image src="/footer-field.svg" alt="Quiet civic field under observation" fill className="object-cover" priority={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
        </div>
        <div className="flex flex-col items-start justify-between gap-4 bg-white px-6 py-8 text-sm text-[#6e6e73] sm:flex-row sm:items-center sm:px-12 lg:px-20">
          <span className="font-medium tracking-[0.16em] text-[#1d1d1f]">SHAKTIOS</span>
          <span>HackSpire 2026 · Human-approved intelligence</span>
          <Link href="/dashboard" className="font-medium text-[#1d1d1f]">Command center</Link>
        </div>
      </footer>
    </main>
  );
}
