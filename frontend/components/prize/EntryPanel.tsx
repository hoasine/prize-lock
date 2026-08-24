"use client";

import { useState } from "react";
import { Loader2, Scale, Trophy } from "lucide-react";
import type { ContestView, EntryView } from "@/lib/contracts/PrizeLock";
import {
  useAppealClaim,
  useClaim,
  useFileClaim,
  useJudgeAppeal,
  useJudgeClaim,
  useLeaveEntry,
  useRegisterEntry,
  useRespondToClaim,
  useReviewSubmission,
  useSettleClaim,
  useSubmitEntry,
} from "@/lib/hooks/usePrizeLock";
import { useTxFeedback } from "@/lib/hooks/useTxFeedback";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { formatCountdown, formatGen, parseGenToWei } from "@/lib/utils/format";
import { validateEvidenceUrls } from "@/lib/utils/urls";
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
import { TxStatus } from "@/components/TxStatus";

const MIN_WEI = 10_000_000_000_000_000n;

function toBig(value: number | string | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") return BigInt(value);
  return BigInt(Math.trunc(value));
}

function statusChip(status: string) {
  if (status === "SUBMITTED") return "bg-sky/15 text-sky border-sky/40";
  if (status === "LEFT") return "bg-secondary text-muted-foreground border-border";
  if (status === "ACTIVE") return "bg-mint/15 text-mint border-mint/40";
  return "bg-primary/15 text-primary border-primary/30";
}

function verdictChip(verdict: string) {
  if (verdict === "PASS") return "bg-mint/15 text-mint border-mint/40";
  if (verdict === "WARN") return "bg-amber/15 text-amber border-amber/40";
  if (verdict === "FAIL") return "bg-destructive/15 text-destructive border-destructive/40";
  if (verdict === "PARTICIPANT_WINS") return "bg-mint/15 text-mint border-mint/40";
  if (verdict === "ORGANIZER_WINS") return "bg-sky/15 text-sky border-sky/40";
  if (verdict === "INCONCLUSIVE") return "bg-amber/15 text-amber border-amber/40";
  return "bg-secondary text-muted-foreground border-border";
}

type EntryPanelProps = {
  contest: ContestView;
  entry?: EntryView | null;
  nowSec: number;
  defaultExpanded?: boolean;
};

export function EntryPanel({ contest, entry, nowSec, defaultExpanded = false }: EntryPanelProps) {
  const { address, isConnected } = useWallet();
  const tx = useTxFeedback();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [respondOpen, setRespondOpen] = useState(false);
  const [notes, setNotes] = useState(
    "Week-1 demo: PrizeLock flow — register pins rules, public README evidence, AI review."
  );
  const [urls, setUrls] = useState("https://github.com/hoasine/scholarship-tracker-dapp");
  const [claimReason, setClaimReason] = useState(
    "Material amend cut first prize after I registered under the pinned higher prize table."
  );
  const [claimEvidence, setClaimEvidence] = useState(
    "I accepted rules version at registration. The material amend reduced first prize without my consent."
  );
  const [claimUrls, setClaimUrls] = useState("https://github.com/hoasine/scholarship-tracker-dapp");
  const [claimStake, setClaimStake] = useState(() => formatGen(contest.first_prize));
  const [appealReason, setAppealReason] = useState(
    "Please re-check the pinned rules version and prize table I registered under."
  );
  const [appealStake, setAppealStake] = useState(() => formatGen(contest.first_prize));
  const [organizerEvidence, setOrganizerEvidence] = useState(
    "Clarify: prize table update was announced in the public rules changelog."
  );
  const [organizerUrls, setOrganizerUrls] = useState(
    "https://github.com/hoasine/scholarship-tracker-dapp"
  );
  const register = useRegisterEntry();
  const leave = useLeaveEntry();
  const submitEntry = useSubmitEntry();
  const review = useReviewSubmission();
  const fileClaim = useFileClaim();
  const respondClaim = useRespondToClaim();
  const judge = useJudgeClaim();
  const appeal = useAppealClaim();
  const judgeAppeal = useJudgeAppeal();
  const settle = useSettleClaim();

  const claimId =
    entry && Number(entry.claim_count) > 0
      ? Number(entry.has_open_claim ? entry.open_claim_id : entry.last_claim_id)
      : -1;
  const claimQuery = useClaim(claimId, Boolean(entry && claimId >= 0 && Number(entry.claim_count) > 0));

  const me = address?.toLowerCase();
  const isOrganizer = Boolean(me && contest.organizer.toLowerCase() === me);
  const isParticipant = Boolean(entry && me && entry.participant.toLowerCase() === me);

  const closed = Boolean(contest.closed) || contest.status === "CLOSED";
  const submissionOpen =
    Number(contest.clock_started_at) > 0 &&
    (Number(contest.submission_deadline) === 0 || nowSec <= Number(contest.submission_deadline));

  const claimWindowOpen =
    Boolean(entry) &&
    Number(entry!.claim_window_ends) > 0 &&
    nowSec <= Number(entry!.claim_window_ends) &&
    entry!.status !== "LEFT";

  const minClaimStake = toBig(contest.first_prize) > MIN_WEI ? toBig(contest.first_prize) : MIN_WEI;

  const canRegister =
    Boolean(isConnected) &&
    !isOrganizer &&
    !entry &&
    !closed &&
    contest.status !== "FINALIZED" &&
    (Number(contest.clock_started_at) === 0 || submissionOpen);

  const canLeave =
    Boolean(isConnected) &&
    isParticipant &&
    entry!.status !== "LEFT" &&
    !entry!.has_open_claim;

  const canSubmit =
    Boolean(isConnected) &&
    isParticipant &&
    (entry!.status === "ACTIVE" || entry!.status === "SUBMITTED") &&
    !entry!.has_open_claim &&
    submissionOpen;

  const canReview =
    Boolean(isConnected) &&
    entry?.status === "SUBMITTED" &&
    !entry.review_verdict &&
    !entry.has_open_claim;

  const canClaim =
    Boolean(isConnected) &&
    isParticipant &&
    entry!.status !== "LEFT" &&
    !entry!.has_open_claim &&
    claimWindowOpen;

  const canRespond =
    Boolean(isConnected) &&
    isOrganizer &&
    Boolean(entry?.has_open_claim) &&
    claimQuery.data?.status === "OPEN";

  const canJudge =
    Boolean(isConnected) &&
    Boolean(entry?.has_open_claim) &&
    claimId >= 0 &&
    claimQuery.data?.status === "OPEN";

  const canAppeal =
    Boolean(isConnected) &&
    isParticipant &&
    claimQuery.data?.status === "JUDGED" &&
    !claimQuery.data.appeal_used &&
    !claimQuery.data.paid_out &&
    Number(claimQuery.data.appeal_deadline) > nowSec;

  const canSettle =
    Boolean(isConnected) &&
    claimQuery.data?.status === "JUDGED" &&
    !claimQuery.data.paid_out &&
    Number(claimQuery.data.appeal_deadline) > 0 &&
    nowSec > Number(claimQuery.data.appeal_deadline);

  const canJudgeAppeal =
    Boolean(isConnected) &&
    claimQuery.data?.status === "APPEALED";

  const actionPending =
    register.isPending ||
    leave.isPending ||
    submitEntry.isPending ||
    review.isPending ||
    fileClaim.isPending ||
    respondClaim.isPending ||
    judge.isPending ||
    appeal.isPending ||
    judgeAppeal.isPending ||
    settle.isPending;

  const onRegister = async () => {
    try {
      tx.begin("Registering entry");
      await register.mutateAsync({ contestId: contest.id, onProgress: tx.setProgress });
      tx.succeed("Registered", `Pinned rules version v${contest.version}.`);
    } catch (err) {
      tx.fail("Register failed", err);
    }
  };

  const onLeave = async () => {
    if (!entry) return;
    if (!window.confirm("Leave this contest entry? This cannot be undone.")) return;
    try {
      tx.begin("Leaving entry");
      await leave.mutateAsync({ entryId: entry.id, onProgress: tx.setProgress });
      tx.succeed("Left contest", "Entry marked LEFT.");
    } catch (err) {
      tx.fail("Leave failed", err);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entry) return;
    try {
      const evidenceUrls = validateEvidenceUrls(urls);
      if (!notes.trim()) throw new Error("Submission notes are required");
      tx.begin("Submitting entry");
      await submitEntry.mutateAsync({
        entryId: entry.id,
        notes: notes.trim(),
        evidenceUrls,
        onProgress: tx.setProgress,
      });
      setSubmitOpen(false);
      setNotes(
        "Week-1 demo: PrizeLock flow — register pins rules, public README evidence, AI review."
      );
      setUrls("https://github.com/hoasine/scholarship-tracker-dapp");
      tx.succeed("Entry submitted", "Anyone can trigger AI review when ready.");
    } catch (err) {
      tx.fail("Submit failed", err);
    }
  };

  const onReview = async () => {
    if (!entry) return;
    try {
      tx.begin("Reviewing submission");
      await review.mutateAsync({ entryId: entry.id, onProgress: tx.setProgress });
      tx.succeed("Submission reviewed", "AI validators returned a verdict.");
    } catch (err) {
      tx.fail("Review failed", err);
    }
  };

  const onClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entry) return;
    try {
      const stakeWei = parseGenToWei(claimStake);
      if (stakeWei < minClaimStake) {
        throw new Error(`Claim stake must be at least ${formatGen(minClaimStake)} GEN`);
      }
      const evidenceUrls = validateEvidenceUrls(claimUrls);
      if (!claimReason.trim()) throw new Error("Claim reason is required");
      if (
        !window.confirm(
          "File a material-amend claim with stake? AI validators will judge the case."
        )
      ) {
        return;
      }
      tx.begin("Filing claim");
      await fileClaim.mutateAsync({
        entryId: entry.id,
        reason: claimReason.trim(),
        evidence: claimEvidence.trim(),
        evidenceUrls,
        stakeWei,
        onProgress: tx.setProgress,
      });
      setClaimOpen(false);
      setClaimReason(
        "Material amend cut first prize after I registered under the pinned higher prize table."
      );
      setClaimEvidence(
        "I accepted rules version at registration. The material amend reduced first prize without my consent."
      );
      setClaimUrls("https://github.com/hoasine/scholarship-tracker-dapp");
      tx.succeed("Claim filed", "Organizer can respond; anyone can trigger judgment.");
    } catch (err) {
      tx.fail("Claim failed", err);
    }
  };

  const onRespond = async (event: React.FormEvent) => {
    event.preventDefault();
    if (claimId < 0) return;
    try {
      const evidenceUrls = validateEvidenceUrls(organizerUrls);
      if (!organizerEvidence.trim()) throw new Error("Organizer evidence notes are required");
      tx.begin("Submitting organizer response");
      await respondClaim.mutateAsync({
        claimId,
        evidence: organizerEvidence.trim(),
        evidenceUrls,
        onProgress: tx.setProgress,
      });
      setRespondOpen(false);
      setOrganizerEvidence(
        "Clarify: prize table update was announced in the public rules changelog."
      );
      setOrganizerUrls("https://github.com/hoasine/scholarship-tracker-dapp");
      tx.succeed("Response filed", "Timed snapshot stored for judgment.");
    } catch (err) {
      tx.fail("Response failed", err);
    }
  };

  const onJudge = async () => {
    if (claimId < 0) return;
    try {
      tx.begin("Judging claim");
      await judge.mutateAsync({ claimId, onProgress: tx.setProgress });
      tx.succeed("Claim judged", "AI consensus settled the dispute.");
    } catch (err) {
      tx.fail("Judgment failed", err);
    }
  };

  const onAppeal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (claimId < 0) return;
    try {
      const stakeWei = parseGenToWei(appealStake);
      if (stakeWei < minClaimStake) {
        throw new Error(`Appeal stake must be at least ${formatGen(minClaimStake)} GEN`);
      }
      if (!appealReason.trim()) throw new Error("Appeal reason is required");
      tx.begin("Filing appeal");
      await appeal.mutateAsync({
        claimId,
        reason: appealReason.trim(),
        stakeWei,
        onProgress: tx.setProgress,
      });
      setAppealOpen(false);
      setAppealReason(
        "Please re-check the pinned rules version and prize table I registered under."
      );
      tx.succeed("Appeal filed", "One-time appeal — anyone can trigger judgment.");
    } catch (err) {
      tx.fail("Appeal failed", err);
    }
  };

  const onJudgeAppeal = async () => {
    if (claimId < 0) return;
    try {
      tx.begin("Judging appeal");
      await judgeAppeal.mutateAsync({ claimId, onProgress: tx.setProgress });
      tx.succeed("Appeal judged", "Final verdict and stake settlement recorded.");
    } catch (err) {
      tx.fail("Appeal judgment failed", err);
    }
  };

  const onSettle = async () => {
    if (claimId < 0) return;
    try {
      tx.begin("Settling claim stakes");
      await settle.mutateAsync({ claimId, onProgress: tx.setProgress });
      tx.succeed("Claim settled", "Stakes refunded or forfeited per verdict — prizes untouched.");
    } catch (err) {
      tx.fail("Settlement failed", err);
    }
  };

  if (!entry && canRegister) {
    return (
      <article className="space-y-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Join this contest</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Register to pin rules v{contest.version}. Submit a public HTTPS URL before the deadline.
            </p>
          </div>
        </div>
        <Button variant="gradient" size="sm" onClick={onRegister} disabled={actionPending}>
          {register.isPending ? "Registering…" : "Register entry"}
        </Button>
        <TxStatus progress={tx.progress} errorMessage={tx.errorMessage} />
      </article>
    );
  }

  if (!entry) return null;

  const countdown =
    Number(entry.claim_window_ends) > 0 && claimWindowOpen
      ? formatCountdown(Number(entry.claim_window_ends), nowSec * 1000)
      : null;

  return (
    <article className="space-y-4 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold">
              Entry #{entry.id}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusChip(entry.status)}`}
            >
              {entry.status}
            </span>
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs">
              rules v{entry.accepted_rules_version}
            </span>
            {entry.has_open_claim && (
              <span className="rounded-full border border-amber/40 bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber">
                Claim open
              </span>
            )}
            {entry.review_verdict && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${verdictChip(entry.review_verdict)}`}
              >
                {entry.review_verdict}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Score {entry.score_meter}/100 · conf {entry.review_confidence}/10
          </p>
          {countdown && (
            <p className="mt-1 text-xs font-medium text-amber">
              Claim window: {countdown}
            </p>
          )}
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      {entry.accepted_rules && (
        <div className="soft-tile p-3">
          <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
            Pinned rules · v{entry.accepted_rules_version}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{entry.accepted_rules}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canSubmit && (
          <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" size="sm" disabled={actionPending}>
                Submit entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit contest entry</DialogTitle>
                <DialogDescription>
                  Public http(s) evidence only — no localhost or private URLs.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor={`notes-${entry.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${entry.id}`}
                    required
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={2000}
                    placeholder="Describe your submission against the pinned rules."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`urls-${entry.id}`}>Evidence URLs</Label>
                  <Input
                    id={`urls-${entry.id}`}
                    value={urls}
                    onChange={(e) => setUrls(e.target.value)}
                    placeholder="https://… (comma-separated)"
                    maxLength={2000}
                  />
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={submitEntry.isPending}
                >
                  {submitEntry.isPending ? "Submitting…" : "Submit entry"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {canLeave && (
          <Button variant="outline" size="sm" onClick={onLeave} disabled={actionPending}>
            {leave.isPending ? "Leaving…" : "Leave"}
          </Button>
        )}

        {canClaim && (
          <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" size="sm" disabled={actionPending}>
                <Scale className="h-3.5 w-3.5" />
                File claim
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>File material-amend claim</DialogTitle>
                <DialogDescription>
                  Stake ≥ {formatGen(minClaimStake)} GEN. AI validators decide if the amend was
                  unfair.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onClaim}>
                <div className="space-y-2">
                  <Label htmlFor={`claim-reason-${entry.id}`}>Reason</Label>
                  <Textarea
                    id={`claim-reason-${entry.id}`}
                    required
                    rows={3}
                    value={claimReason}
                    onChange={(e) => setClaimReason(e.target.value)}
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`claim-evidence-${entry.id}`}>Evidence notes</Label>
                  <Textarea
                    id={`claim-evidence-${entry.id}`}
                    rows={3}
                    value={claimEvidence}
                    onChange={(e) => setClaimEvidence(e.target.value)}
                    maxLength={3000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`claim-urls-${entry.id}`}>Evidence URLs</Label>
                  <Input
                    id={`claim-urls-${entry.id}`}
                    value={claimUrls}
                    onChange={(e) => setClaimUrls(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`claim-stake-${entry.id}`}>Stake (GEN)</Label>
                  <Input
                    id={`claim-stake-${entry.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.000000000000000001"
                    required
                    value={claimStake}
                    onChange={(e) => setClaimStake(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={fileClaim.isPending}
                >
                  {fileClaim.isPending ? "Filing…" : "Stake and file claim"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {canReview && (
          <Button variant="outline" size="sm" onClick={onReview} disabled={actionPending}>
            {review.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reviewing…
              </>
            ) : (
              "Review submission"
            )}
          </Button>
        )}

        {canRespond && (
          <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={actionPending}>
                Respond to claim
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Organizer claim response</DialogTitle>
                <DialogDescription>
                  Add opposing evidence with public URLs for AI judgment.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onRespond} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`org-evidence-${entry.id}`}>Evidence notes</Label>
                  <Textarea
                    id={`org-evidence-${entry.id}`}
                    required
                    value={organizerEvidence}
                    onChange={(e) => setOrganizerEvidence(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`org-urls-${entry.id}`}>Public evidence URLs</Label>
                  <Input
                    id={`org-urls-${entry.id}`}
                    value={organizerUrls}
                    onChange={(e) => setOrganizerUrls(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={actionPending}>
                  {respondClaim.isPending ? "Submitting…" : "Submit response"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {canJudge && claimQuery.data?.status !== "APPEALED" && (
          <Button variant="gradient" size="sm" onClick={onJudge} disabled={actionPending}>
            {judge.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Judging…
              </>
            ) : (
              <>
                <Scale className="h-3.5 w-3.5" />
                Judge claim
              </>
            )}
          </Button>
        )}

        {canAppeal && (
          <Dialog open={appealOpen} onOpenChange={setAppealOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={actionPending}>
                Appeal (once)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>One-time appeal</DialogTitle>
                <DialogDescription>
                  Stake ≥ {formatGen(minClaimStake)} GEN. Stakes stay locked until appeal is judged —
                  prizes remain reserved.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onAppeal}>
                <div className="space-y-2">
                  <Label htmlFor={`appeal-reason-${entry.id}`}>Appeal reason</Label>
                  <Textarea
                    id={`appeal-reason-${entry.id}`}
                    required
                    rows={3}
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`appeal-stake-${entry.id}`}>Stake (GEN)</Label>
                  <Input
                    id={`appeal-stake-${entry.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.000000000000000001"
                    required
                    value={appealStake}
                    onChange={(e) => setAppealStake(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={appeal.isPending}>
                  {appeal.isPending ? "Appealing…" : "File appeal"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {canSettle && (
          <Button variant="outline" size="sm" onClick={onSettle} disabled={actionPending}>
            {settle.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Settling…
              </>
            ) : (
              "Settle stakes"
            )}
          </Button>
        )}

        {canJudgeAppeal && (
          <Button variant="gradient" size="sm" onClick={onJudgeAppeal} disabled={actionPending}>
            {judgeAppeal.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Judging appeal…
              </>
            ) : (
              "Judge appeal"
            )}
          </Button>
        )}
      </div>

      {expanded && (
        <section className="space-y-3 border-t border-border pt-4 text-sm">
          {entry.notes && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Submission notes
              </p>
              <p className="mt-1 whitespace-pre-wrap">{entry.notes}</p>
              {entry.evidence_urls && (
                <p className="mt-1 break-all text-xs text-primary">{entry.evidence_urls}</p>
              )}
            </div>
          )}
          {entry.review_reasoning && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Review reasoning
              </p>
              <p className="mt-1 text-muted-foreground">{entry.review_reasoning}</p>
            </div>
          )}
          {claimQuery.data && (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-semibold">Claim #{claimQuery.data.id} · {claimQuery.data.status}</p>
              {claimQuery.data.verdict && (
                <p className="mt-1">
                  Verdict:{" "}
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${verdictChip(claimQuery.data.verdict)}`}>
                    {claimQuery.data.verdict}
                  </span>
                </p>
              )}
              {claimQuery.data.appeal_verdict && (
                <p className="mt-1">
                  Appeal:{" "}
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${verdictChip(claimQuery.data.appeal_verdict)}`}>
                    {claimQuery.data.appeal_verdict}
                  </span>
                </p>
              )}
              {claimQuery.data.reasoning && (
                <p className="mt-2 text-xs text-muted-foreground">{claimQuery.data.reasoning}</p>
              )}
            </div>
          )}
        </section>
      )}

      <TxStatus progress={tx.progress} errorMessage={tx.errorMessage} />
    </article>
  );
}
