"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Scale,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { CreateContestForm } from "@/components/prize/CreateContestForm";
import { ContestCard } from "@/components/prize/ContestCard";
import { EntryPanel } from "@/components/prize/EntryPanel";
import { ContractSetupBanner } from "@/components/ContractSetupBanner";
import { useContests, usePrizeLockClient } from "@/lib/hooks/usePrizeLock";
import { getContractAddress } from "@/lib/genlayer/client";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ContestView, EntryView } from "@/lib/contracts/PrizeLock";

const TABS = [
  { id: "board", label: "Board" },
  { id: "create", label: "Create" },
  { id: "mine", label: "My entries" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PAGE_SIZE = 10;

function tabFromSearch(raw: string | null): TabId {
  if (raw === "create") return "create";
  if (raw === "mine" || raw === "entries") return "mine";
  return "board";
}

function MyEntriesList() {
  const { address, isConnected } = useWallet();
  const client = usePrizeLockClient();
  const { data: contests, isLoading, isError, error, refetch } = useContests();
  const contract = getContractAddress();
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const entryQueries = useQueries({
    queries: (contests ?? []).map((c) => ({
      queryKey: ["contest-entries", contract, c.id],
      queryFn: () => client!.getContestEntries(c.id),
      enabled: !!client && !!isConnected && !!address,
      refetchInterval: 8000,
    })),
  });

  const loadedRows = useMemo(() => {
    const me = address?.toLowerCase();
    if (!me || !contests) return [] as { contest: ContestView; entry: EntryView }[];
    const out: { contest: ContestView; entry: EntryView }[] = [];
    entryQueries.forEach((q, idx) => {
      const contest = contests[idx];
      if (!contest || !q.data) return;
      for (const entry of q.data) {
        if (entry.participant.toLowerCase() === me) {
          out.push({ contest, entry });
        }
      }
    });
    return out.sort((a, b) => b.entry.id - a.entry.id);
  }, [address, contests, entryQueries]);

  const loadingEntries = entryQueries.some((q) => q.isLoading);

  if (!isConnected) {
    return (
      <div className="glass-card p-10 text-center">
        <p className="font-display text-lg font-bold">Connect your wallet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          View entries you registered and manage submissions, claims, or leave.
        </p>
      </div>
    );
  }

  if (isLoading || loadingEntries) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your entries…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-card space-y-2 border-destructive/30 p-4 text-sm">
        <p className="font-medium text-destructive">Failed to load entries.</p>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <button type="button" className="text-primary underline" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (loadedRows.length === 0) {
    return (
      <div className="glass-card p-10 text-center">
        <span className="gradient-brand mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white">
          <Trophy className="h-6 w-6" />
        </span>
        <p className="font-display text-lg font-bold">No entries yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Register for a contest on the board to pin rules and submit your work.
        </p>
      </div>
    );
  }

  const openClaims = loadedRows.filter((r) => r.entry.has_open_claim).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {loadedRows.length} entr{loadedRows.length === 1 ? "y" : "ies"}
        {openClaims > 0 ? ` · ${openClaims} with open claims` : ""}
      </p>
      {loadedRows.map(({ contest, entry }) => (
        <div key={entry.id} className="glass-card space-y-3 p-4 md:p-5">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            {contest.title} · contest #{contest.id}
          </p>
          <EntryPanel contest={contest} entry={entry} nowSec={nowSec} defaultExpanded />
        </div>
      ))}
    </div>
  );
}

export function PrizeLockApp() {
  const search = useSearchParams();
  const [tab, setTab] = useState<TabId>(() => tabFromSearch(search.get("tab")));
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [organizerOnly, setOrganizerOnly] = useState(false);
  const { address, isConnected } = useWallet();
  const contract = getContractAddress();
  const { data, isLoading, isError, error, refetch } = useContests();

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const me = address?.toLowerCase();
    const list = data ? [...data] : [];
    return list
      .filter((c) => {
        if (organizerOnly && me && c.organizer.toLowerCase() !== me) return false;
        if (status !== "all" && c.status !== status) return false;
        if (!term) return true;
        return (
          c.title.toLowerCase().includes(term) ||
          c.rules.toLowerCase().includes(term) ||
          c.organizer.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.id - a.id);
  }, [data, query, status, organizerOnly, address]);

  const total = filtered.length;
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const hasMore = (page + 1) * PAGE_SIZE < total;

  const activeEntries = filtered.reduce(
    (sum, c) => sum + Number(c.active_entry_count || 0),
    0
  );
  const openClaims = filtered.reduce(
    (sum, c) => sum + Number(c.open_claim_count || 0),
    0
  );

  const stats = [
    {
      label: organizerOnly ? "My contests" : "Contests",
      value: total,
      icon: Trophy,
      tint: "gradient-brand",
    },
    { label: "Active entries", value: activeEntries, icon: Users, tint: "gradient-mint" },
    {
      label: "Open claims",
      value: openClaims,
      icon: openClaims > 0 ? AlertTriangle : Scale,
      tint: openClaims > 0 ? "gradient-amber" : "gradient-mint",
    },
  ];

  return (
    <div className="space-y-8">
      {!contract && <ContractSetupBanner />}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="glass-card flex items-center gap-4 p-4">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${s.tint}`}
            >
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {s.label}
              </p>
              <p className="mt-0.5 font-display text-2xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="inline-flex gap-1 rounded-full border border-border bg-secondary/80 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-all",
              tab === t.id
                ? "gradient-brand text-white shadow-[0_8px_18px_-12px_oklch(0.45_0.12_160_/_0.55)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <CreateContestForm onDone={() => setTab("board")} />
      ) : tab === "mine" ? (
        <MyEntriesList />
      ) : (
        <div className="space-y-4">
          <section className="glass-card space-y-4 p-4" aria-label="Contest filters">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="inline-flex rounded-full border border-border bg-secondary/80 p-1"
                role="group"
                aria-label="Contest ownership"
              >
                <button
                  type="button"
                  aria-pressed={organizerOnly}
                  disabled={!isConnected}
                  onClick={() => {
                    setOrganizerOnly(true);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm",
                    organizerOnly && "gradient-brand text-white"
                  )}
                >
                  My contests
                </button>
                <button
                  type="button"
                  aria-pressed={!organizerOnly}
                  onClick={() => {
                    setOrganizerOnly(false);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm",
                    !organizerOnly && "gradient-brand text-white"
                  )}
                >
                  All
                </button>
              </div>
              {!isConnected && (
                <p className="text-xs text-muted-foreground">
                  Connect a wallet to filter your contests.
                </p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
              <label className="relative">
                <span className="sr-only">Search contests</span>
                <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Search title, rules, or organizer"
                  className="pl-9"
                />
              </label>
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(0);
                }}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
              >
                <option value="all">All statuses</option>
                {["OPEN", "AMENDED", "FINALIZED", "CLOSED"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading contests…
            </div>
          )}
          {isError && (
            <div className="glass-card space-y-2 border-destructive/30 p-4 text-sm">
              <p className="font-medium text-destructive">Failed to load contests.</p>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
              <button type="button" className="text-primary underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && pageItems.length === 0 && (
            <div className="glass-card p-10 text-center">
              <span className="gradient-brand mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white">
                <Trophy className="h-6 w-6" />
              </span>
              <p className="font-display text-lg font-bold">No contests yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first contest with a funded prize pool and public rules.
              </p>
              <button
                type="button"
                onClick={() => setTab("create")}
                className="mt-4 text-sm font-semibold text-primary hover:underline"
              >
                Create contest
              </button>
            </div>
          )}
          {pageItems.map((c) => (
            <ContestCard key={c.id} contest={c} />
          ))}
          {!isLoading && !isError && total > 0 && (
            <nav className="flex items-center justify-between" aria-label="Contest pagination">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1}
                {total > PAGE_SIZE ? ` · ${total} contests` : ""}
              </span>
              <Button
                variant="outline"
                disabled={!hasMore}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <ChevronRight />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
