"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Wallet,
} from "lucide-react";
import type { ContestView } from "@/lib/contracts/PrizeLock";
import {
  useAmendRules,
  useCloseContest,
  useContestAmendments,
  useContestEntries,
  useFinalizePrizes,
  useFundContest,
  useReleaseAmendStake,
} from "@/lib/hooks/usePrizeLock";
import { useTxFeedback } from "@/lib/hooks/useTxFeedback";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { formatCountdown, formatGen, parseGenToWei, shortAddr } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EntryPanel } from "@/components/prize/EntryPanel";
import { TxStatus } from "@/components/TxStatus";

const MIN_WEI = 10_000_000_000_000_000n;

function toBig(value: number | string | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") return BigInt(value);
  return BigInt(Math.trunc(value));
}

function statusChip(status: string) {
  if (status === "AMENDED") return "bg-sky/15 text-sky border-sky/40";
  if (status === "FINALIZED") return "bg-mint/15 text-mint border-mint/40";
  if (status === "CLOSED") return "bg-secondary text-muted-foreground border-border";
  return "bg-primary/15 text-primary border-primary/30";
}

export function ContestCard({ contest }: { contest: ContestView }) {
  const { address, isConnected } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const tx = useTxFeedback();

  const [fundOpen, setFundOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState("0.05");
  const [newRules, setNewRules] = useState(
    `${contest.rules}\n\nMATERIAL UPDATE (demo): First prize reduced; eligibility now requires a public live demo URL in addition to the README.`
  );
  const [amendReason, setAmendReason] = useState(
    "Demo material amend — reduce first prize and tighten eligibility."
  );
  const [amendStake, setAmendStake] = useState(() => formatGen(contest.first_prize));
  const [amendMaterial, setAmendMaterial] = useState(true);
  const [newFirst, setNewFirst] = useState(() => {
    const raw = formatGen(contest.first_prize);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return raw;
    return String(Math.max(0.01, Number((n / 2).toFixed(4))));
  });
  const [newSecond, setNewSecond] = useState(() => formatGen(contest.second_prize));
  const [newDeadline, setNewDeadline] = useState("");

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const entries = useContestEntries(contest.id, true);
  const amendments = useContestAmendments(contest.id, expanded);
  const fund = useFundContest();
  const amend = useAmendRules();
  const finalize = useFinalizePrizes();
  const close = useCloseContest();
  const releaseStake = useReleaseAmendStake();

  const me = address?.toLowerCase();
  const isOrganizer = Boolean(me && contest.organizer.toLowerCase() === me);
  const closed = Boolean(contest.closed) || contest.status === "CLOSED";
  const finalized = Boolean(contest.prizes_paid) || contest.status === "FINALIZED";

  const submissionOpen =
    Number(contest.clock_started_at) > 0 &&
    nowSec < Number(contest.submission_deadline);
  const submissionPassed =
    Number(contest.clock_started_at) > 0 &&
    nowSec >= Number(contest.submission_deadline);

  const hasOpenClaims = Number(contest.open_claim_count) > 0;
  const hasClaimWindow = Boolean(contest.has_open_claim_window);
  const hasMaterialAmendWindow = Boolean(contest.has_open_material_amend_window);

  const canOrganizerAct = Boolean(isConnected) && isOrganizer && !closed;
  const canAmend =
    canOrganizerAct && !finalized && !hasOpenClaims && !hasMaterialAmendWindow;
  const canFinalize =
    Boolean(isConnected) &&
    !closed &&
    !finalized &&
    !hasOpenClaims &&
    !hasClaimWindow &&
    submissionPassed;
  const canClose =
    canOrganizerAct &&
    !hasOpenClaims &&
    !hasClaimWindow &&
    (finalized || !Number(contest.active_entry_count) || submissionPassed);

  const actionPending =
    fund.isPending ||
    amend.isPending ||
    finalize.isPending ||
    close.isPending ||
    releaseStake.isPending;

  const myEntry = useMemo(() => {
    if (!me) return null;
    return (entries.data ?? []).find((e) => e.participant.toLowerCase() === me) ?? null;
  }, [entries.data, me]);

  const entryList = useMemo(
    () => [...(entries.data ?? [])].sort((a, b) => b.id - a.id),
    [entries.data]
  );

  const releasableAmendments = useMemo(
    () =>
      (amendments.data ?? []).filter(
        (a) =>
          a.kind === "MATERIAL" &&
          !a.released &&
          Number(a.claim_window_ends) > 0 &&
          nowSec > Number(a.claim_window_ends)
      ),
    [amendments.data, nowSec]
  );

  const deadlineCountdown =
    Number(contest.submission_deadline) > 0 && submissionOpen
      ? formatCountdown(Number(contest.submission_deadline), nowSec * 1000)
      : null;

  const onFund = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const valueWei = parseGenToWei(fundAmount);
      if (valueWei < MIN_WEI) throw new Error("Fund amount must be at least 0.01 GEN");
      tx.begin("Funding contest");
      await fund.mutateAsync({
        contestId: contest.id,
        valueWei,
        onProgress: tx.setProgress,
      });
      setFundOpen(false);
      tx.succeed("Contest funded", `Added ${fundAmount} GEN to the pool.`);
    } catch (err) {
      tx.fail("Fund failed", err);
    }
  };

  const onAmend = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (hasOpenClaims) throw new Error("Cannot amend while a claim is open");
      const stakeWei = parseGenToWei(amendStake);
      const firstWei = parseGenToWei(newFirst);
      const secondWei = parseGenToWei(newSecond);
      const minStake = amendMaterial
        ? toBig(contest.first_prize) > MIN_WEI
          ? toBig(contest.first_prize)
          : MIN_WEI
        : MIN_WEI;
      if (stakeWei < minStake) {
        throw new Error(
          amendMaterial
            ? "Material amend stake must be >= first prize"
            : "Stake must be at least 0.01 GEN"
        );
      }
      if (!newRules.trim() || !amendReason.trim()) {
        throw new Error("New rules and reason are required");
      }
      const deadlineTs = newDeadline.trim()
        ? Math.floor(new Date(newDeadline).getTime() / 1000)
        : 0;
      if (
        !window.confirm(
          amendMaterial
            ? "Material amend opens a claim window for active entries. Continue?"
            : "Clarifying amend (no claim window). Continue?"
        )
      ) {
        return;
      }
      tx.begin("Amending rules");
      await amend.mutateAsync({
        contestId: contest.id,
        newRules: newRules.trim(),
        reason: amendReason.trim(),
        newFirst: firstWei,
        newSecond: secondWei,
        newDeadline: deadlineTs,
        isMaterial: amendMaterial,
        value: stakeWei,
        onProgress: tx.setProgress,
      });
      setAmendOpen(false);
      setAmendReason("Demo material amend — reduce first prize and tighten eligibility.");
      tx.succeed("Rules amended", "New version recorded on-chain.");
    } catch (err) {
      tx.fail("Amend failed", err);
    }
  };

  const onFinalize = async () => {
    if (!window.confirm("Finalize prizes to top PASS submissions? This pays winners.")) return;
    try {
      tx.begin("Finalizing prizes");
      await finalize.mutateAsync({ contestId: contest.id, onProgress: tx.setProgress });
      tx.succeed("Prizes finalized", "Winners paid from the pool.");
    } catch (err) {
      tx.fail("Finalize failed", err);
    }
  };

  const onClose = async () => {
    if (
      !window.confirm(
        "Close this contest and recover remaining pool? This cannot be undone."
      )
    ) {
      return;
    }
    try {
      tx.begin("Closing contest");
      await close.mutateAsync({ contestId: contest.id, onProgress: tx.setProgress });
      tx.succeed("Contest closed", "Remaining pool returned to organizer.");
    } catch (err) {
      tx.fail("Close failed", err);
    }
  };

  const onReleaseStake = async (amendmentId: number) => {
    try {
      tx.begin("Releasing amend stake");
      await releaseStake.mutateAsync({ amendmentId, onProgress: tx.setProgress });
      tx.succeed("Stake released", "Amendment collateral returned to organizer.");
    } catch (err) {
      tx.fail("Release failed", err);
    }
  };

  return (
    <article className="glass-card brand-card-hover space-y-5 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              #{contest.id}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusChip(contest.status)}`}
            >
              {contest.status}
            </span>
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold">
              v{contest.version}
            </span>
            {hasOpenClaims && (
              <span className="rounded-full border border-amber/40 bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber">
                {contest.open_claim_count} open claim
                {Number(contest.open_claim_count) === 1 ? "" : "s"}
              </span>
            )}
            {hasClaimWindow && (
              <span className="rounded-full border border-amber/40 bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber">
                Claim window open
              </span>
            )}
          </div>
          <h3 className="font-display text-xl font-bold">{contest.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Organizer {shortAddr(contest.organizer)} · {contest.submission_seconds}s window
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-bold text-primary">
            {formatGen(contest.pool_balance)} GEN
          </p>
          <p className="text-xs text-muted-foreground">
            pool · 1st {formatGen(contest.first_prize)} · 2nd {formatGen(contest.second_prize)}
          </p>
        </div>
      </div>

      <div className="soft-tile p-4">
        <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
          Public rules
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{contest.rules}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="soft-tile px-3 py-2">
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            Entries
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {contest.entry_count} total · {contest.active_entry_count} active
          </p>
        </div>
        <div className="soft-tile px-3 py-2">
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            Deadline
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {Number(contest.clock_started_at) === 0
              ? "Starts on first register"
              : deadlineCountdown ?? "Closed"}
          </p>
        </div>
        <div className="soft-tile px-3 py-2">
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            Amendments
          </p>
          <p className="mt-0.5 text-sm font-semibold">{contest.amendment_count}</p>
        </div>
        <div className="soft-tile px-3 py-2">
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            Winners
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {finalized
              ? `#${contest.first_winner_entry}${Number(contest.second_winner_entry) > 0 ? ` / #${contest.second_winner_entry}` : ""}`
              : "—"}
          </p>
        </div>
      </div>

      {!isOrganizer && isConnected && !myEntry && !closed && contest.status !== "FINALIZED" && (
        <EntryPanel contest={contest} entry={null} nowSec={nowSec} />
      )}

      {canOrganizerAct && (
        <div className="flex flex-wrap gap-2">
          <Dialog open={fundOpen} onOpenChange={setFundOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={actionPending}>
                <Wallet className="h-4 w-4" />
                Fund
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fund contest #{contest.id}</DialogTitle>
                <DialogDescription>Top up the prize pool with GEN.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onFund}>
                <div className="space-y-2">
                  <Label htmlFor={`fund-${contest.id}`}>Amount (GEN)</Label>
                  <Input
                    id={`fund-${contest.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.000000000000000001"
                    required
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={fund.isPending}>
                  {fund.isPending ? "Funding…" : "Confirm fund"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {canAmend && (
            <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={actionPending}>
                  Amend rules
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Amend rules</DialogTitle>
                  <DialogDescription>
                    Requires stake + reason. Material changes open a claim window.
                    A second amend is blocked while that window is open.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={onAmend}>
                  <div className="space-y-2">
                    <Label htmlFor={`amend-rules-${contest.id}`}>New rules</Label>
                    <Textarea
                      id={`amend-rules-${contest.id}`}
                      required
                      rows={4}
                      value={newRules}
                      onChange={(e) => setNewRules(e.target.value)}
                      maxLength={4000}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`amend-reason-${contest.id}`}>Reason</Label>
                    <Textarea
                      id={`amend-reason-${contest.id}`}
                      required
                      rows={2}
                      value={amendReason}
                      onChange={(e) => setAmendReason(e.target.value)}
                      maxLength={1500}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={amendMaterial ? "gradient" : "outline"}
                      onClick={() => setAmendMaterial(true)}
                    >
                      Material
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!amendMaterial ? "gradient" : "outline"}
                      onClick={() => setAmendMaterial(false)}
                    >
                      Clarify
                    </Button>
                  </div>
                  {amendMaterial && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`new-first-${contest.id}`}>New 1st prize (GEN)</Label>
                        <Input
                          id={`new-first-${contest.id}`}
                          type="number"
                          value={newFirst}
                          onChange={(e) => setNewFirst(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`new-second-${contest.id}`}>New 2nd prize (GEN)</Label>
                        <Input
                          id={`new-second-${contest.id}`}
                          type="number"
                          value={newSecond}
                          onChange={(e) => setNewSecond(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`new-deadline-${contest.id}`}>
                          New deadline (optional, local datetime)
                        </Label>
                        <Input
                          id={`new-deadline-${contest.id}`}
                          type="datetime-local"
                          value={newDeadline}
                          onChange={(e) => setNewDeadline(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`amend-stake-${contest.id}`}>Stake (GEN)</Label>
                    <Input
                      id={`amend-stake-${contest.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.000000000000000001"
                      required
                      value={amendStake}
                      onChange={(e) => setAmendStake(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="gradient"
                    className="w-full"
                    disabled={amend.isPending}
                  >
                    {amend.isPending ? "Amending…" : "Confirm amendment"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {canFinalize && (
            <Button variant="gradient" onClick={onFinalize} disabled={actionPending}>
              {finalize.isPending ? "Finalizing…" : "Finalize prizes"}
            </Button>
          )}

          {canClose && (
            <Button variant="outline" onClick={onClose} disabled={actionPending}>
              {close.isPending ? "Closing…" : "Close contest"}
            </Button>
          )}

          {releasableAmendments.map((a) => (
            <Button
              key={a.id}
              variant="outline"
              size="sm"
              onClick={() => onReleaseStake(a.id)}
              disabled={actionPending || hasOpenClaims}
            >
              Release stake #{a.id}
            </Button>
          ))}
        </div>
      )}

      {isOrganizer && !finalized && hasMaterialAmendWindow && (
        <p className="text-xs text-muted-foreground">
          Amend locked: a prior material amendment claim window is still open.
        </p>
      )}

      {myEntry && (
        <EntryPanel contest={contest} entry={myEntry} nowSec={nowSec} defaultExpanded />
      )}

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/70 px-4 py-3 text-left text-sm font-semibold"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        All entries ({entryList.length})
        {expanded ? <ChevronUp /> : <ChevronDown />}
      </button>

      {expanded && (
        <section className="space-y-4" aria-label={`Entries for ${contest.title}`}>
          {entries.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading entries…
            </div>
          )}
          {entries.isError && (
            <div role="alert" className="text-sm text-destructive">
              Unable to load entries.{" "}
              <button type="button" className="underline" onClick={() => entries.refetch()}>
                Retry
              </button>
            </div>
          )}
          {!entries.isLoading && entryList.length === 0 && (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          )}
          {entryList
            .filter((e) => e.id !== myEntry?.id)
            .map((entry) => (
              <EntryPanel key={entry.id} contest={contest} entry={entry} nowSec={nowSec} />
            ))}
        </section>
      )}

      <TxStatus progress={tx.progress} errorMessage={tx.errorMessage} />
    </article>
  );
}
