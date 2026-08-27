# PrizeLock

<div align="center">

## Pinned Contest Rules with Escrowed Prizes on GenLayer

| **PrizeLock Platform** |
|---|
| **Pin the rules. Escrow the prizes. Claim bait-and-switch.** |

[![Live App](https://img.shields.io/badge/Live-prize--lock.vercel.app-0f172a?style=for-the-badge&logo=vercel)](https://prize-lock.vercel.app)
[![Contract](https://img.shields.io/badge/Contract-0xf461D7c9…0EAf-1f6feb?style=for-the-badge)](#environment-variables)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js_+_TypeScript-111827?style=for-the-badge)](#project-structure)
[![Network](https://img.shields.io/badge/Network-GenLayer_Studionet-16a34a?style=for-the-badge)](#environment-variables)

</div>

---

## Overview

PrizeLock is a hackathon / contest protocol where organizers escrow prize GEN behind **public, pinned rules**.

Participants **register** and lock the exact rules version they accepted. Submissions use **public HTTPS** evidence; GenLayer AI returns `PASS` / `WARN` / `FAIL` with a `score_meter`. **Material** rule changes (prize table, deadline, eligibility) require collateral and open a timed **claim window**. Claim judgment and appeals settle only from **unreserved** funds so the prize pool cannot be drained by disputes.

The protocol is designed so organizers cannot publish rules A, accept teams, switch to B, then close and withdraw the pool.

## Core Value Proposition

- **Pin-on-register:** accepted rules version + full text cannot be overwritten by later amends
- **Escrowed prizes:** first + second prizes stay reserved until `finalize_prizes`
- **Material vs Clarify:** only material changes open a claim window + matching stake
- **Public evidence only:** localhost / private URLs blocked; judgments bind to immutable submit/claim snapshots
- **Validator-agreed scores:** `score_meter` must converge across validators (±5) — it ranks prize payouts
- **Fair disputes:** INCONCLUSIVE refunds both sides; one appeal; deferred stake settlement
- **Enforced windows:** amendment claim window + organizer response deadline checked on-chain
- **No rug close:** cannot close while submissions exist unpaid, or while claims / windows are open
- **Anyone-callable AI:** `review_submission` / `judge_*` with capped checker rewards from a separate budget

## Protocol Flow

1. **Organizer creates contest** — funds ≥ first prize + second prize + checker budget
2. **Participant registers** — pins rules version; submission clock starts on first registration
3. **Participant submits** — notes + public demo / repo URLs (resubmit allowed before deadline)
4. **Anyone calls `review_submission`** — AI returns `PASS` / `WARN` / `FAIL` + `score_meter`
5. **Optional material amend** — stake + reason; opens claim window for active entries
6. **Optional claim path** — `file_claim` → `respond_to_claim` → `judge_claim` → (optional) one `appeal_claim` → `settle_claim` / `judge_appeal`
7. **Finalize then close** — rank PASS entries by score; organizer recovers remainder only after prizes are settled

Statuses:

| Entity | Path |
|--------|------|
| Contest | `OPEN` → `AMENDED` → `FINALIZED` → `CLOSED` |
| Entry | `ACTIVE` → `SUBMITTED` / `LEFT` |
| Claim | `OPEN` → `JUDGED` → (`APPEALED`) → `SETTLED` |

## Risk Controls

| Risk | Mitigation in PrizeLock |
|------|-------------------------|
| Mid-stream bait-and-switch | Rules pinned at register; material amend opens timed claim window + stake |
| Amend while dispute open | Blocked while `open_claim_count > 0` |
| Cheap / spam claims | Claim stake ≥ contested item (amend stake or first prize) |
| Left participants claiming | `LEFT` cannot file claims; one open claim per entry |
| Organizer self-deal | Organizer cannot self-register |
| Prize pool drained by claims | Settlements use only unreserved pool (`pool − prizes − checker_budget`) |
| Close without paying winners | `close_contest` blocked if `SUBMITTED` entries exist and prizes unpaid |
| Stake paid before appeal | `judge_claim` defers settlement; `settle_claim` after appeal window |
| Organizer AFK after amend | Anyone may `release_amend_stake` after window (no open claims) |
| Fetch fail / empty page | Review → `WARN`; claim → `INCONCLUSIVE` (no fake WIN) |
| Private / local evidence | Public HTTPS only; localhost and private hosts rejected |
| Score disagreement across validators | Validators must agree on `verdict` **and** `score_meter` (±5) — payout ranking field |
| Mutable live pages after submit | Reviews/claims bind to **immutable on-chain snapshots** + pinned rules version |
| Late organizer reply / early judge | `respond_to_claim` blocked after `response_deadline`; `judge_claim` only after reply or deadline |
| Claim after amend window | Entry window **and** amendment `claim_window_ends` enforced on-chain |
| Unbounded checker drain | Checker reward capped; paid only from `checker_budget` |
| Invalid GenVM web scrape | Snapshot via `strict_eq`; LLM judgment inside `run_nondet_unsafe` |

## Core Contract API

| Function | Type | Description |
|----------|------|-------------|
| `create_contest` | write (payable) | Create contest + escrow prizes + checker budget |
| `fund_contest` | write (payable) | Top up pool |
| `register_entry` | write | Participant registers; pins rules; starts clock |
| `leave_entry` | write | Exit; cannot claim afterward |
| `submit_entry` | write | Public evidence URLs (+ resubmit clears prior review) |
| `review_submission` | write | AI review + capped checker reward |
| `amend_rules` | write (payable) | Clarify or Material change (`is_material`) |
| `file_claim` | write (payable) | Challenge material amend inside claim window |
| `respond_to_claim` | write | Organizer reply before judgment |
| `judge_claim` | write | AI judgment; stakes deferred until settle/appeal |
| `appeal_claim` | write (payable) | One-time appeal |
| `judge_appeal` | write | Final AI judgment + stake settlement |
| `settle_claim` | write | After appeal window with no appeal — settle stakes |
| `release_amend_stake` | write | Release material collateral after window |
| `finalize_prizes` | write | Pay top PASS entries by `score_meter` |
| `close_contest` | write | Organizer recovers remainder (guards apply) |
| `get_contest` / `get_entry` / … | view | Entity reads |

## Project Structure

```text
contracts/   # GenLayer intelligent contract (Python)
scripts/     # Studionet deploy helper
frontend/    # Next.js application (TypeScript)
tests/       # Contract/integration tests
```

## Environment Variables

Configure in `frontend/.env.local` (see `frontend/.env.example`):

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xf461D7c97ed4f0A48BdD97d9fc49818bA09B0EAf
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_CHAIN_NAME=GenLayer Studionet
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
```

> Redeploy after contract changes and update `NEXT_PUBLIC_CONTRACT_ADDRESS` so Studionet matches local source.

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Deploy contract first (or use the Studionet address above), then update `NEXT_PUBLIC_CONTRACT_ADDRESS`.

Studionet deploy:

```bash
set PRIVATE_KEY=0x...
python scripts/deploy_studionet.py
```

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest tests/direct/test_prize_lock.py
```

## Links

- Live app: [https://prize-lock.vercel.app](https://prize-lock.vercel.app)
- GitHub: [https://github.com/hoasine/prize-lock](https://github.com/hoasine/prize-lock)
- Contract (Studionet): [`0xf461D7c97ed4f0A48BdD97d9fc49818bA09B0EAf`](https://studio.genlayer.com)
- Source: `contracts/prize_lock.py`

## Disclaimer

Prototype/demo software for contest experiments on GenLayer Studionet. Not financial, legal, or competition compliance advice.
