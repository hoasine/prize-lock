"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Scale,
  Sparkles,
  Trophy,
  Wallet,
} from "lucide-react";

const pillars = [
  {
    icon: BadgeCheck,
    title: "Pinned public rules",
    body: "Organizers publish verifiable contest rules. Participants register and pin the rules version they accept.",
    tint: "gradient-brand",
  },
  {
    icon: Trophy,
    title: "Prize pool escrow",
    body: "First and second prizes sit in the pool. AI review scores submissions; finalize pays top PASS entries.",
    tint: "gradient-mint",
  },
  {
    icon: Scale,
    title: "Material amend claims",
    body: "Unfair rule changes open a timed claim window. Participants stake, AI judges, one appeal allowed.",
    tint: "gradient-amber",
  },
];

const flow = [
  {
    step: "01",
    title: "Organizer",
    body: "Create a contest, fund prizes + checker budget, and publish public rules.",
  },
  {
    step: "02",
    title: "Participant",
    body: "Register to pin rules, submit a public HTTPS URL before the deadline.",
  },
  {
    step: "03",
    title: "Review & finalize",
    body: "Anyone triggers AI review. After deadlines and claims clear, finalize pays winners.",
  },
];

const stats = [
  { label: "Min stake / prize", value: "0.01 GEN" },
  { label: "Review path", value: "PASS · WARN · FAIL" },
  { label: "Consensus", value: "GenLayer AI" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-grow">
        <section className="px-4 pt-32 pb-16 md:px-6 lg:px-8 lg:pt-40">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="animate-fade-in">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Intelligent Contract · GenLayer Studionet
              </span>

              <p className="mt-6 font-display text-4xl leading-[1.08] font-bold tracking-tight md:text-6xl">
                Prize<span className="text-gradient">Lock</span>
              </p>

              <h1 className="mt-4 max-w-xl text-xl font-semibold tracking-tight text-foreground/90 md:text-2xl">
                Contests with locked rules and escrowed prizes.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Organizers fund prize pools behind public rules. Participants register, submit public
                URLs, and AI review scores entries — with claim windows when rules change materially.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild variant="gradient" size="lg" className="h-12 px-6">
                  <Link href="/dashboard?tab=create">
                    Create contest
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-6">
                  <Link href="/dashboard">Open board</Link>
                </Button>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3">
                {stats.map((s) => (
                  <div key={s.label} className="soft-tile px-4 py-3">
                    <dt className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                      {s.label}
                    </dt>
                    <dd className="mt-1 font-display text-sm font-bold text-foreground">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="animate-float lg:justify-self-end">
              <div className="glass-card w-full max-w-md p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                    Entry #4 · Hackathon Demo
                  </span>
                  <span className="gradient-mint rounded-full px-3 py-1 text-xs font-semibold text-white">
                    SUBMITTED
                  </span>
                </div>

                <h3 className="mt-5 font-display text-xl font-bold">Public demo URL</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  1st 0.1 GEN · 2nd 0.05 GEN · rules v2
                </p>

                <div className="mt-5 space-y-3">
                  <div className="soft-tile p-3">
                    <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
                      Pinned rules
                    </p>
                    <p className="mt-1 text-sm">
                      Submit a public HTTPS demo matching the theme. No private repos.
                    </p>
                  </div>
                  <div className="rounded-[calc(var(--radius)-2px)] border border-sky/40 bg-sky/10 p-3">
                    <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
                      Awaiting review
                    </p>
                    <p className="mt-1 text-sm font-medium">Anyone can trigger AI submission review</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                    AI submission review
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    Min 0.01 GEN
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 md:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-xl">
              <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                Why PrizeLock
              </p>
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Fair contests with verifiable submissions
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {pillars.map((p) => (
                <article key={p.title} className="glass-card brand-card-hover p-6">
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white ${p.tint}`}
                  >
                    <p.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 md:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-xl">
                <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                  How it works
                </p>
                <h2 className="font-display text-3xl font-bold md:text-4xl">
                  Three steps: Organizer, Participant, Review
                </h2>
              </div>
              <Button asChild variant="outline">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {flow.map((f) => (
                <article key={f.step} className="glass-card p-6">
                  <span className="gradient-brand inline-flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-bold text-white">
                    {f.step}
                  </span>
                  <h3 className="mt-4 font-display text-xl font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 md:px-6 lg:px-8">
          <div className="gradient-brand mx-auto max-w-7xl rounded-[calc(var(--radius)+8px)] p-8 text-white shadow-[0_30px_60px_-35px_oklch(0.4_0.1_230_/_0.55)] md:p-12">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Ready to launch a contest with locked rules?
              </h2>
              <p className="mt-3 text-white/90">
                Connect MetaMask on Studionet, fund a prize pool in GEN, and publish public rules
                participants can pin and prove against.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-8 h-12 bg-foreground px-6 text-background hover:bg-foreground/90"
              >
                <Link href="/dashboard?tab=create">
                  Create contest
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <span className="font-display text-sm font-bold text-foreground">PrizeLock</span>
          <p>
            Powered by GenLayer · Contest/prize prototype — not legal advice. Not a regulated
            financial product.
          </p>
        </div>
      </footer>
    </div>
  );
}
