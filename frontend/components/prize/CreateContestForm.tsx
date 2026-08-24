"use client";

import { useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TxStatus } from "@/components/TxStatus";
import { useCreateContest } from "@/lib/hooks/usePrizeLock";
import { useTxFeedback } from "@/lib/hooks/useTxFeedback";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { parseGenToWei } from "@/lib/utils/format";
import { error as toastError } from "@/lib/utils/toast";
import { cn } from "@/lib/utils";

const MIN_WEI = 10_000_000_000_000_000n;

const DEMO_TITLE = "Studionet Sprint — Best Public Demo";
const DEMO_RULES = `Build a small GenLayer dApp and publish a public HTTPS demo or GitHub README.

Judging criteria (pinned at registration):
1) Public evidence URL required (no localhost / private repos).
2) README or live page must describe what the demo does.
3) Theme: fair escrow / claim / AI review on Studionet.
4) Material rule changes after register open a timed claim window.

Submit one public URL before the deadline. AI returns PASS / WARN / FAIL with a score_meter.`;

const SUBMISSION_PRESETS = [
  { id: "demo", label: "60s demo", seconds: 60 },
  { id: "day", label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { id: "month", label: "30 days", seconds: 30 * 24 * 60 * 60 },
] as const;

export function CreateContestForm({ onDone }: { onDone?: () => void }) {
  const { isConnected } = useWallet();
  const create = useCreateContest();
  const tx = useTxFeedback();
  const [title, setTitle] = useState(DEMO_TITLE);
  const [rules, setRules] = useState(DEMO_RULES);
  const [submissionSeconds, setSubmissionSeconds] = useState(60);
  const [firstPrize, setFirstPrize] = useState("0.05");
  const [secondPrize, setSecondPrize] = useState("0.02");
  const [checkerBudget, setCheckerBudget] = useState("0.005");

  const pending = create.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toastError("Connect your wallet to continue");
      return;
    }
    try {
      if (!title.trim() || !rules.trim()) {
        throw new Error("Title and rules are required");
      }
      const firstPrizeWei = parseGenToWei(firstPrize);
      const secondPrizeWei = parseGenToWei(secondPrize);
      const checkerBudgetWei = parseGenToWei(checkerBudget);
      if (firstPrizeWei < MIN_WEI) {
        throw new Error("First prize must be at least 0.01 GEN");
      }
      if (secondPrizeWei < 0n) {
        throw new Error("Second prize cannot be negative");
      }
      if (checkerBudgetWei < 0n) {
        throw new Error("Checker budget cannot be negative");
      }
      if (submissionSeconds < 60) {
        throw new Error("Submission window must be at least 60 seconds");
      }
      const totalValue = firstPrizeWei + secondPrizeWei + checkerBudgetWei;
      tx.begin("Creating contest");
      const result = await create.mutateAsync({
        title: title.trim(),
        rules: rules.trim(),
        firstPrizeWei,
        secondPrizeWei,
        submissionSeconds,
        checkerBudgetWei,
        value: totalValue,
        onProgress: tx.setProgress,
      });
      tx.succeed(
        "Contest created",
        `Contest #${result.contestId} is funded on-chain.`
      );
      setTitle(DEMO_TITLE);
      setRules(DEMO_RULES);
      setFirstPrize("0.05");
      setSecondPrize("0.02");
      setCheckerBudget("0.005");
      setSubmissionSeconds(60);
      onDone?.();
    } catch (err) {
      tx.fail("Unable to create contest", err);
    }
  };

  return (
    <form onSubmit={submit} className="glass-card space-y-6 p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="gradient-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white">
          <Trophy className="h-5 w-5" />
        </span>
        <div>
          <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            New contest
          </p>
          <h2 className="font-display text-xl font-bold">Launch a prize pool with public rules</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Fund first + second prizes and a checker budget. Participants register, submit public
            URLs, and AI review scores submissions.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="e.g. Hackathon Q3 — Best Demo"
          disabled={!isConnected || pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rules">Public rules</Label>
        <Textarea
          id="rules"
          required
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="Submit a public HTTPS demo URL. Project must match the stated theme. No private repos."
          disabled={!isConnected || pending}
        />
        <p className="text-xs text-muted-foreground">
          Rules must be publicly verifiable via URLs. Material amendments open a timed claim window.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Submission window</Label>
        <div className="flex flex-wrap gap-2">
          {SUBMISSION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!isConnected || pending}
              onClick={() => setSubmissionSeconds(preset.seconds)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                submissionSeconds === preset.seconds
                  ? "gradient-brand border-transparent text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Clock starts on first registration. Selected: {submissionSeconds}s
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="first">First prize (GEN)</Label>
          <Input
            id="first"
            required
            value={firstPrize}
            onChange={(e) => setFirstPrize(e.target.value)}
            inputMode="decimal"
            min="0.01"
            step="0.000000000000000001"
            type="number"
            disabled={!isConnected || pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="second">Second prize (GEN)</Label>
          <Input
            id="second"
            required
            value={secondPrize}
            onChange={(e) => setSecondPrize(e.target.value)}
            inputMode="decimal"
            min="0"
            step="0.000000000000000001"
            type="number"
            disabled={!isConnected || pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checker">Checker budget (GEN)</Label>
          <Input
            id="checker"
            required
            value={checkerBudget}
            onChange={(e) => setCheckerBudget(e.target.value)}
            inputMode="decimal"
            min="0"
            step="0.000000000000000001"
            type="number"
            disabled={!isConnected || pending}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Initial funding = first + second + checker budget (min 0.01 GEN for first prize). You can
        fund more later.
      </p>

      <Button type="submit" variant="gradient" className="w-full" disabled={!isConnected || pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <Trophy className="mr-2 h-4 w-4" />
            Create and fund contest
          </>
        )}
      </Button>
      <TxStatus progress={tx.progress} errorMessage={tx.errorMessage} />
    </form>
  );
}
