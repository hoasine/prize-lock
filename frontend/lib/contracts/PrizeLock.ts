import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import {
  extractTxErrorMessage,
  isFailureResultName,
  isPendingResultName,
  isSuccessResultName,
} from "./tx-error";
import { withTransientRpcRetry } from "@/lib/utils/rpc-retry";

export type ContestStatus = "OPEN" | "AMENDED" | "FINALIZED" | "CLOSED";
export type EntryStatus = "ACTIVE" | "SUBMITTED" | "LEFT";
export type ReviewVerdict = "PASS" | "WARN" | "FAIL" | "";
export type ClaimVerdict = "PARTICIPANT_WINS" | "ORGANIZER_WINS" | "INCONCLUSIVE" | "";
export type ClaimStatus = "OPEN" | "JUDGED" | "APPEALED" | "SETTLED";
export type AmendmentKind = "MATERIAL" | "CLARIFY";

export type ContestView = {
  id: number;
  organizer: string;
  title: string;
  rules: string;
  first_prize: number | string;
  second_prize: number | string;
  pool_balance: number | string;
  checker_budget: number | string;
  available_balance?: number | string;
  created_at: number;
  clock_started_at: number;
  submission_seconds: number;
  submission_deadline: number;
  version: number;
  amendment_count: number;
  entry_count: number;
  active_entry_count: number;
  open_claim_count: number;
  first_winner_entry: number;
  second_winner_entry: number;
  prizes_paid: boolean;
  status: ContestStatus;
  closed: boolean;
  has_open_claim_window?: boolean;
  has_open_material_amend_window?: boolean;
  claim_window_seconds?: number;
  appeal_window_seconds?: number;
  checker_reward?: number | string;
  minimum_stake?: number | string;
};

export type EntryView = {
  id: number;
  contest_id: number;
  participant: string;
  status: EntryStatus;
  accepted_rules_version: number;
  accepted_rules: string;
  registered_at: number;
  notes: string;
  evidence_urls: string;
  evidence_snapshot?: string;
  snapshot_at?: number;
  submitted_at: number;
  review_verdict: ReviewVerdict;
  review_confidence: number;
  review_reasoning: string;
  score_meter: number;
  reviewed_at: number;
  has_open_claim: boolean;
  open_claim_id: number;
  last_claim_id: number;
  claim_count: number;
  claim_window_ends: number;
};

export type AmendmentView = {
  id: number;
  contest_id: number;
  organizer: string;
  reason: string;
  old_rules: string;
  new_rules: string;
  old_first_prize: number | string;
  new_first_prize: number | string;
  old_second_prize: number | string;
  new_second_prize: number | string;
  old_deadline: number;
  new_deadline: number;
  stake: number | string;
  kind: AmendmentKind;
  claim_window_ends: number;
  released: boolean;
  created_at: number;
  version: number;
};

export type ClaimView = {
  id: number;
  contest_id: number;
  entry_id: number;
  participant: string;
  reason: string;
  evidence: string;
  evidence_urls: string;
  student_snapshot?: string;
  student_snapshot_at?: number;
  organizer_evidence?: string;
  organizer_evidence_urls?: string;
  organizer_snapshot?: string;
  organizer_responded_at?: number;
  contested_amount: number | string;
  pinned_rules_version: number;
  amendment_id: number;
  claim_kind: string;
  response_deadline: number;
  stake: number | string;
  created_at: number;
  judged_at: number;
  verdict: ClaimVerdict;
  confidence: number;
  reasoning: string;
  status: ClaimStatus;
  paid_out: boolean;
  appeal_used: boolean;
  appeal_stake: number | string;
  appeal_deadline: number;
  appeal_reason: string;
  appeal_judged_at: number;
  appeal_verdict: ClaimVerdict;
  appeal_confidence: number;
  appeal_reasoning: string;
};

export type ProtocolParams = {
  minimum_stake: number | string;
  minimum_submission_seconds: number;
  claim_window_seconds: number;
  appeal_window_seconds: number;
  checker_reward: number | string;
  max_checker_reward: number | string;
  contest_count?: number;
  entry_count?: number;
  claim_count?: number;
};

export type TransactionProgress = {
  hash?: string;
  stage: "preparing" | "submitted" | "finalizing" | "finalized";
  message?: string;
};

export type WriteResult = {
  hash: string;
  receipt: unknown;
};

const AI_TX_WAIT = {
  retries: 90,
  interval: 2000,
  status: TransactionStatus.ACCEPTED,
};
const FAST_TX_WAIT = {
  retries: 40,
  interval: 2000,
  status: TransactionStatus.ACCEPTED,
};

function normalizeReadValue(value: unknown): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [key, entry] of value.entries()) {
      obj[String(key)] = normalizeReadValue(entry);
    }
    return obj;
  }
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeReadValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeReadValue(entry)])
    );
  }
  return value;
}

function normalizeReadResult<T>(raw: unknown): T {
  return normalizeReadValue(raw) as T;
}

export class PrizeLockClient {
  private contractAddress: `0x${string}`;
  private readClient: ReturnType<typeof createClient>;
  private account?: `0x${string}`;
  private endpoint?: string;

  constructor(contractAddress: string, account?: string | null, endpoint?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.account = account ? (account as `0x${string}`) : undefined;
    this.endpoint = endpoint;
    const config: Record<string, unknown> = { chain: studionet };
    if (endpoint) config.endpoint = endpoint;
    this.readClient = createClient(config as Parameters<typeof createClient>[0]);
  }

  updateAccount(address: string, endpoint?: string) {
    this.account = address as `0x${string}`;
    this.endpoint = endpoint ?? this.endpoint;
  }

  private async getWriteClient() {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("A browser wallet is required to send transactions.");
    }
    if (!this.account) {
      throw new Error("Connect your wallet before sending a transaction.");
    }
    const client = createClient({
      chain: studionet,
      endpoint: this.endpoint,
      account: this.account,
      provider: window.ethereum as NonNullable<
        Parameters<typeof createClient>[0]
      >["provider"],
    });
    await client.connect("studionet");
    return client;
  }

  private notifyRpcWait(
    onProgress: ((progress: TransactionProgress) => void) | undefined,
    stage: TransactionProgress["stage"],
    hash: string | undefined,
    remainingMs: number
  ) {
    const secs = Math.max(1, Math.ceil(remainingMs / 1000));
    onProgress?.({
      hash,
      stage,
      message: `RPC busy — still checking for up to ~${secs}s…`,
    });
  }

  private async waitForWrite(
    client: ReturnType<typeof createClient>,
    hash: Awaited<ReturnType<ReturnType<typeof createClient>["writeContract"]>>,
    options: {
      retries: number;
      interval: number;
      status?: TransactionStatus;
    } = AI_TX_WAIT,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    const hashStr = String(hash);
    onProgress?.({ hash: hashStr, stage: "finalizing" });

    const receipt = await withTransientRpcRetry(
      () =>
        client.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.FINALIZED,
          retries: options.retries,
          interval: options.interval,
          fullTransaction: true,
        } as Parameters<typeof client.waitForTransactionReceipt>[0] & {
          fullTransaction?: boolean;
        }),
      {
        timeoutMs: 60_000,
        onRetry: ({ remainingMs }) =>
          this.notifyRpcWait(onProgress, "finalizing", hashStr, remainingMs),
      }
    );

    const statusName = String(
      (receipt as { statusName?: string }).statusName ?? ""
    ).toUpperCase();
    const resultName = (receipt as { resultName?: string }).resultName;

    if (statusName.includes("CANCEL") || statusName.includes("TIMEOUT")) {
      throw new Error(`Transaction ${statusName.toLowerCase().replace(/_/g, " ")}.`);
    }

    if (!isPendingResultName(resultName) && !isSuccessResultName(resultName)) {
      let errMsg = extractTxErrorMessage(receipt);
      if (!errMsg || errMsg.includes("UserWarning")) {
        try {
          const fullTx = await client.getTransaction({ hash });
          errMsg = extractTxErrorMessage(fullTx) ?? errMsg;
        } catch {
          // keep prior
        }
      }
      if (errMsg) throw new Error(errMsg);
    }

    if (isFailureResultName(resultName)) {
      const errMsg = extractTxErrorMessage(receipt);
      throw new Error(
        errMsg ?? `Transaction failed (${String(resultName)}). Check GenLayer Studio.`
      );
    }

    onProgress?.({ hash: hashStr, stage: "finalized" });
    return { hash: hashStr, receipt } satisfies WriteResult;
  }

  private async write(
    functionName: string,
    args: Array<string | number>,
    value: bigint,
    wait = FAST_TX_WAIT,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    onProgress?.({ stage: "preparing" });
    const client = await this.getWriteClient();
    const hash = await withTransientRpcRetry(
      () =>
        client.writeContract({
          address: this.contractAddress,
          functionName,
          args,
          value,
        }),
      {
        timeoutMs: 60_000,
        onRetry: ({ remainingMs }) =>
          this.notifyRpcWait(onProgress, "preparing", undefined, remainingMs),
      }
    );
    onProgress?.({ hash: String(hash), stage: "submitted" });
    return this.waitForWrite(client, hash, wait, onProgress);
  }

  async getParams(): Promise<ProtocolParams> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_params",
      args: [],
    });
    return normalizeReadResult<ProtocolParams>(raw);
  }

  async getContestCount(): Promise<number> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_contest_count",
      args: [],
    });
    return Number(normalizeReadValue(raw));
  }

  async getAllContests(): Promise<ContestView[]> {
    const count = await this.getContestCount();
    const contests: ContestView[] = [];
    for (let i = 0; i < count; i++) {
      contests.push(await this.getContest(i));
    }
    return contests;
  }

  async getContest(id: number): Promise<ContestView> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_contest",
      args: [id],
    });
    return normalizeReadResult<ContestView>(raw);
  }

  async getEntry(id: number): Promise<EntryView> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_entry",
      args: [id],
    });
    return normalizeReadResult<EntryView>(raw);
  }

  async getClaim(id: number): Promise<ClaimView> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_claim",
      args: [id],
    });
    return normalizeReadResult<ClaimView>(raw);
  }

  async getAmendment(id: number): Promise<AmendmentView> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_amendment",
      args: [id],
    });
    return normalizeReadResult<AmendmentView>(raw);
  }

  async getContestEntries(contestId: number): Promise<EntryView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_contest_entries",
      args: [contestId],
    });
    const list = normalizeReadResult<EntryView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async getContestAmendments(contestId: number): Promise<AmendmentView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_contest_amendments",
      args: [contestId],
    });
    const list = normalizeReadResult<AmendmentView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async createContest(
    title: string,
    rules: string,
    firstPrizeWei: bigint,
    secondPrizeWei: bigint,
    submissionSeconds: number,
    checkerBudgetWei: bigint,
    value: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    const before = await this.getContestCount();
    onProgress?.({ stage: "preparing" });
    const client = await this.getWriteClient();
    const hash = await withTransientRpcRetry(
      () =>
        client.writeContract({
          address: this.contractAddress,
          functionName: "create_contest",
          args: [
            title,
            rules,
            firstPrizeWei.toString(),
            secondPrizeWei.toString(),
            submissionSeconds,
            checkerBudgetWei.toString(),
          ],
          value,
        }),
      {
        timeoutMs: 60_000,
        onRetry: ({ remainingMs }) =>
          this.notifyRpcWait(onProgress, "preparing", undefined, remainingMs),
      }
    );
    onProgress?.({ hash: String(hash), stage: "submitted" });
    const transaction = await this.waitForWrite(client, hash, FAST_TX_WAIT, onProgress);
    for (let i = 0; i < 20; i++) {
      const n = await this.getContestCount();
      if (n > before) return { contestId: n - 1, ...transaction };
      await new Promise((r) => setTimeout(r, 1500));
    }
    return { contestId: Math.max(0, before), ...transaction };
  }

  fundContest(
    contestId: number,
    valueWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write("fund_contest", [contestId], valueWei, FAST_TX_WAIT, onProgress);
  }

  registerEntry(contestId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("register_entry", [contestId], 0n, FAST_TX_WAIT, onProgress);
  }

  leaveEntry(entryId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("leave_entry", [entryId], 0n, FAST_TX_WAIT, onProgress);
  }

  submitEntry(
    entryId: number,
    notes: string,
    evidenceUrls: string,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "submit_entry",
      [entryId, notes, evidenceUrls],
      0n,
      FAST_TX_WAIT,
      onProgress
    );
  }

  reviewSubmission(entryId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("review_submission", [entryId], 0n, AI_TX_WAIT, onProgress);
  }

  amendRules(
    contestId: number,
    newRules: string,
    reason: string,
    newFirst: bigint,
    newSecond: bigint,
    newDeadline: number,
    isMaterial: boolean,
    value: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "amend_rules",
      [
        contestId,
        newRules,
        reason,
        newFirst.toString(),
        newSecond.toString(),
        newDeadline,
        isMaterial ? 1 : 0,
      ],
      value,
      FAST_TX_WAIT,
      onProgress
    );
  }

  fileClaim(
    entryId: number,
    reason: string,
    evidence: string,
    evidenceUrls: string,
    stakeWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "file_claim",
      [entryId, reason, evidence, evidenceUrls],
      stakeWei,
      FAST_TX_WAIT,
      onProgress
    );
  }

  respondToClaim(
    claimId: number,
    evidence: string,
    evidenceUrls: string,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "respond_to_claim",
      [claimId, evidence, evidenceUrls],
      0n,
      FAST_TX_WAIT,
      onProgress
    );
  }

  judgeClaim(claimId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("judge_claim", [claimId], 0n, AI_TX_WAIT, onProgress);
  }

  appealClaim(
    claimId: number,
    reason: string,
    stakeWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write("appeal_claim", [claimId, reason], stakeWei, FAST_TX_WAIT, onProgress);
  }

  judgeAppeal(claimId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("judge_appeal", [claimId], 0n, AI_TX_WAIT, onProgress);
  }

  settleClaim(claimId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("settle_claim", [claimId], 0n, FAST_TX_WAIT, onProgress);
  }

  releaseAmendStake(
    amendmentId: number,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write("release_amend_stake", [amendmentId], 0n, FAST_TX_WAIT, onProgress);
  }

  finalizePrizes(contestId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("finalize_prizes", [contestId], 0n, FAST_TX_WAIT, onProgress);
  }

  closeContest(contestId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("close_contest", [contestId], 0n, FAST_TX_WAIT, onProgress);
  }
}
