"use client";

import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { PrizeLockApp } from "@/components/prize/PrizeLockApp";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow px-4 pt-32 pb-16 md:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="animate-fade-in">
            <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Dashboard
            </p>
            <h1 className="font-display text-3xl font-bold md:text-4xl">Contest board</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Create funded contests, register entries, review submissions, amend rules, and settle
              material-amend claims via GenLayer AI consensus.
            </p>
          </div>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <PrizeLockApp />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
