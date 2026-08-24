"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { getContractAddress, getStudioUrl, ensureGenLayerNetwork } from "@/lib/genlayer/client";
import {
  PrizeLockClient,
  type TransactionProgress,
} from "@/lib/contracts/PrizeLock";

export function usePrizeLockClient() {
  const { address } = useWallet();
  const contract = getContractAddress();
  return useMemo(() => {
    if (!contract) return null;
    return new PrizeLockClient(contract, address, getStudioUrl());
  }, [contract, address]);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["contests"] }),
      qc.invalidateQueries({ queryKey: ["contest"] }),
      qc.invalidateQueries({ queryKey: ["contest-entries"] }),
      qc.invalidateQueries({ queryKey: ["contest-amendments"] }),
      qc.invalidateQueries({ queryKey: ["entry"] }),
      qc.invalidateQueries({ queryKey: ["claim"] }),
      qc.invalidateQueries({ queryKey: ["prize-lock-params"] }),
    ]);
}

export function useContests() {
  const client = usePrizeLockClient();
  return useQuery({
    queryKey: ["contests", getContractAddress()],
    queryFn: async () => {
      if (!client) return [];
      const list = await client.getAllContests();
      return [...list].sort((a, b) => b.id - a.id);
    },
    enabled: !!client,
    refetchInterval: 8000,
  });
}

export function useContestEntries(contestId: number, enabled = true) {
  const client = usePrizeLockClient();
  return useQuery({
    queryKey: ["contest-entries", getContractAddress(), contestId],
    queryFn: () => client!.getContestEntries(contestId),
    enabled: !!client && enabled && contestId >= 0,
    refetchInterval: 8000,
  });
}

export function useContestAmendments(contestId: number, enabled = true) {
  const client = usePrizeLockClient();
  return useQuery({
    queryKey: ["contest-amendments", getContractAddress(), contestId],
    queryFn: () => client!.getContestAmendments(contestId),
    enabled: !!client && enabled && contestId >= 0,
  });
}

export function useClaim(claimId: number, enabled = true) {
  const client = usePrizeLockClient();
  return useQuery({
    queryKey: ["claim", getContractAddress(), claimId],
    queryFn: () => client!.getClaim(claimId),
    enabled: !!client && enabled && claimId >= 0,
    refetchInterval: 8000,
  });
}

export function useParams() {
  const client = usePrizeLockClient();
  return useQuery({
    queryKey: ["prize-lock-params", getContractAddress()],
    queryFn: () => client!.getParams(),
    enabled: !!client,
    staleTime: 60_000,
  });
}

type ProgressInput = { onProgress?: (progress: TransactionProgress) => void };

export function useCreateContest() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: {
        title: string;
        rules: string;
        firstPrizeWei: bigint;
        secondPrizeWei: bigint;
        submissionSeconds: number;
        checkerBudgetWei: bigint;
        value: bigint;
      } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.createContest(
        input.title,
        input.rules,
        input.firstPrizeWei,
        input.secondPrizeWei,
        input.submissionSeconds,
        input.checkerBudgetWei,
        input.value,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useFundContest() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { contestId: number; valueWei: bigint } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.fundContest(input.contestId, input.valueWei, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useRegisterEntry() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { contestId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.registerEntry(input.contestId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useLeaveEntry() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { entryId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.leaveEntry(input.entryId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useSubmitEntry() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: { entryId: number; notes: string; evidenceUrls: string } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.submitEntry(
        input.entryId,
        input.notes,
        input.evidenceUrls,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useReviewSubmission() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { entryId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.reviewSubmission(input.entryId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useAmendRules() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: {
        contestId: number;
        newRules: string;
        reason: string;
        newFirst: bigint;
        newSecond: bigint;
        newDeadline: number;
        isMaterial: boolean;
        value: bigint;
      } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.amendRules(
        input.contestId,
        input.newRules,
        input.reason,
        input.newFirst,
        input.newSecond,
        input.newDeadline,
        input.isMaterial,
        input.value,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useFileClaim() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: {
        entryId: number;
        reason: string;
        evidence: string;
        evidenceUrls: string;
        stakeWei: bigint;
      } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.fileClaim(
        input.entryId,
        input.reason,
        input.evidence,
        input.evidenceUrls,
        input.stakeWei,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useRespondToClaim() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: { claimId: number; evidence: string; evidenceUrls: string } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.respondToClaim(
        input.claimId,
        input.evidence,
        input.evidenceUrls,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useJudgeClaim() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { claimId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.judgeClaim(input.claimId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useAppealClaim() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: { claimId: number; reason: string; stakeWei: bigint } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.appealClaim(input.claimId, input.reason, input.stakeWei, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useJudgeAppeal() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { claimId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.judgeAppeal(input.claimId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useSettleClaim() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { claimId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.settleClaim(input.claimId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useReleaseAmendStake() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { amendmentId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.releaseAmendStake(input.amendmentId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useFinalizePrizes() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { contestId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.finalizePrizes(input.contestId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useCloseContest() {
  const client = usePrizeLockClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { contestId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.closeContest(input.contestId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}
