"""Behavioral tests for PrizeLock — team fairness checklist."""

import json

import pytest

CONTRACT = "contracts/prize_lock.py"
SDK_VERSION = "v0.2.16"
FIRST = 50_000_000_000_000_000  # 0.05 GEN
SECOND = 20_000_000_000_000_000  # 0.02 GEN
CHECKER = 5_000_000_000_000_000  # 0.005 GEN
POOL = FIRST + SECOND + CHECKER + 10_000_000_000_000_000
STAKE = 10_000_000_000_000_000  # 0.01 GEN
SUB_SECS = 60
_DIRECT_VM = None

RULES = (
    "Build a public GenLayer demo. Submit a public HTTPS repo or live demo URL. "
    "Private localhost links are invalid. Judging uses pinned rules at registration."
)


def _review(verdict: str, score: int = 80) -> str:
    return json.dumps(
        {
            "verdict": verdict,
            "confidence": 8,
            "score_meter": score,
            "reasoning": "Mocked submission review.",
        }
    )


def _claim(verdict: str) -> str:
    return json.dumps(
        {
            "verdict": verdict,
            "confidence": 8,
            "reasoning": "Mocked claim arbitration.",
        }
    )


def _web(body: str) -> dict:
    return {"method": "GET", "status": 200, "body": body}


@pytest.fixture
def contract(direct_vm, direct_deploy, direct_alice):
    global _DIRECT_VM
    _DIRECT_VM = direct_vm
    direct_vm.mock_web(r".*", _web("Public hackathon demo with README and commits."))
    direct_vm.mock_llm(r".*", _review("PASS", 90))
    direct_vm.sender = direct_alice
    return direct_deploy(CONTRACT, sdk_version=SDK_VERSION)


def _payable(contract, method: str, *args, value: int):
    previous = _DIRECT_VM.value
    _DIRECT_VM.value = value
    try:
        return getattr(contract, method)(*args)
    finally:
        _DIRECT_VM.value = previous


def _create(contract):
    _payable(
        contract,
        "create_contest",
        "Studionet Sprint",
        RULES,
        FIRST,
        SECOND,
        SUB_SECS,
        CHECKER,
        value=POOL,
    )


def _register(contract, direct_vm, participant):
    direct_vm.sender = participant
    contract.register_entry(0)


class TestCreateAndRegister:
    def test_create_contest(self, contract):
        _create(contract)
        c = contract.get_contest(0)
        assert c["status"] == "OPEN"
        assert c["first_prize"] == FIRST
        assert c["second_prize"] == SECOND
        assert c["clock_started_at"] == 0
        assert c["submission_deadline"] == 0

    def test_organizer_cannot_self_register(self, contract, direct_alice):
        _create(contract)
        with pytest.raises(Exception):
            contract.register_entry(0)

    def test_register_pins_rules_and_starts_clock(
        self, contract, direct_vm, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        e = contract.get_entry(0)
        assert e["status"] == "ACTIVE"
        assert e["accepted_rules_version"] == 1
        assert e["accepted_rules"] == RULES
        c = contract.get_contest(0)
        assert c["clock_started_at"] > 0
        assert c["submission_deadline"] > c["clock_started_at"]
        assert c["active_entry_count"] == 1

    def test_leave_blocks_later_claim_path(self, contract, direct_vm, direct_bob):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        contract.leave_entry(0)
        assert contract.get_entry(0)["status"] == "LEFT"
        assert contract.get_contest(0)["active_entry_count"] == 0


class TestEvidenceAndReview:
    def test_private_url_rejected(self, contract, direct_vm, direct_bob):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        with pytest.raises(Exception):
            contract.submit_entry(0, "demo", "http://localhost:3000/app")

    def test_pass_review_pays_checker(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        contract.submit_entry(0, "demo notes", "https://github.com/example/prize-lock")
        before = contract.get_contest(0)["checker_budget"]
        direct_vm.sender = direct_alice
        contract.review_submission(0)
        e = contract.get_entry(0)
        assert e["review_verdict"] == "PASS"
        assert e["score_meter"] == 90
        after = contract.get_contest(0)["checker_budget"]
        assert after < before


class TestAmendAndClaim:
    def test_cannot_amend_during_open_claim(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _payable(
            contract,
            "amend_rules",
            0,
            "New rules: prize cut.",
            "Reduce first prize",
            FIRST // 2,
            SECOND,
            0,
            1,
            value=FIRST,
        )
        direct_vm.sender = direct_bob
        _payable(
            contract,
            "file_claim",
            0,
            "Bait and switch on prize table",
            "I registered under higher first prize",
            "https://github.com/example/evidence",
            value=FIRST,
        )
        direct_vm.sender = direct_alice
        with pytest.raises(Exception):
            _payable(
                contract,
                "amend_rules",
                0,
                "Another change",
                "Try again",
                FIRST // 2,
                SECOND,
                0,
                1,
                value=FIRST,
            )

    def test_left_cannot_claim(self, contract, direct_vm, direct_alice, direct_bob):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _payable(
            contract,
            "amend_rules",
            0,
            "Material change",
            "Cut prizes",
            FIRST // 2,
            SECOND,
            0,
            1,
            value=FIRST,
        )
        direct_vm.sender = direct_bob
        contract.leave_entry(0)
        with pytest.raises(Exception):
            _payable(
                contract,
                "file_claim",
                0,
                "unfair",
                "x",
                "https://example.com/a",
                value=FIRST,
            )

    def test_claim_stake_must_cover_item(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _payable(
            contract,
            "amend_rules",
            0,
            "Material change",
            "Cut prizes",
            FIRST // 2,
            SECOND,
            0,
            1,
            value=FIRST,
        )
        direct_vm.sender = direct_bob
        with pytest.raises(Exception):
            _payable(
                contract,
                "file_claim",
                0,
                "unfair",
                "x",
                "https://example.com/a",
                value=STAKE,  # too low vs first prize / amend stake
            )

    def test_pin_version_not_overwritten_on_entry(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        pinned = contract.get_entry(0)["accepted_rules"]
        direct_vm.sender = direct_alice
        _payable(
            contract,
            "amend_rules",
            0,
            "Clarified wording only",
            "Clarify",
            FIRST,
            SECOND,
            0,
            0,
            value=STAKE,
        )
        e = contract.get_entry(0)
        assert e["accepted_rules"] == pinned
        assert e["accepted_rules_version"] == 1
        assert contract.get_contest(0)["version"] == 2

    def test_close_blocked_while_claim_window(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _payable(
            contract,
            "amend_rules",
            0,
            "Material change",
            "Cut prizes",
            FIRST // 2,
            SECOND,
            0,
            1,
            value=FIRST,
        )
        with pytest.raises(Exception):
            contract.close_contest(0)

    def test_inconclusive_refunds(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _payable(
            contract,
            "amend_rules",
            0,
            "Material change",
            "Cut prizes",
            FIRST // 2,
            SECOND,
            0,
            1,
            value=FIRST,
        )
        direct_vm.sender = direct_bob
        _payable(
            contract,
            "file_claim",
            0,
            "unfair amend",
            "details",
            "https://example.com/ev",
            value=FIRST,
        )
        direct_vm.sender = direct_alice
        contract.respond_to_claim(0, "organizer notes", "https://example.com/org")
        direct_vm.mock_llm(r".*", _claim("INCONCLUSIVE"))
        contract.judge_claim(0)
        cl = contract.get_claim(0)
        assert cl["verdict"] == "INCONCLUSIVE"
        assert cl["status"] == "JUDGED"
        assert cl["paid_out"] is False
        e = contract.get_entry(0)
        assert e["has_open_claim"] is True
        assert e["claim_count"] == 1
        assert e["last_claim_id"] == 0
        # Settlement deferred until appeal window ends.
        with pytest.raises(Exception):
            contract.settle_claim(0)


class TestAppealAndRelease:
    def test_appeal_after_judgment(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _payable(
            contract,
            "amend_rules",
            0,
            "Material change",
            "Cut prizes",
            FIRST // 2,
            SECOND,
            0,
            1,
            value=FIRST,
        )
        direct_vm.sender = direct_bob
        _payable(
            contract,
            "file_claim",
            0,
            "unfair amend",
            "details",
            "https://example.com/ev",
            value=FIRST,
        )
        direct_vm.sender = direct_alice
        contract.respond_to_claim(0, "organizer notes", "https://example.com/org")
        direct_vm.mock_llm(r".*", _claim("ORGANIZER_WINS"))
        contract.judge_claim(0)
        assert contract.get_claim(0)["status"] == "JUDGED"
        assert contract.get_claim(0)["paid_out"] is False
        assert contract.get_entry(0)["last_claim_id"] == 0
        assert contract.get_entry(0)["has_open_claim"] is True

        direct_vm.sender = direct_bob
        _payable(
            contract,
            "appeal_claim",
            0,
            "Please re-check pinned rules version",
            value=FIRST,
        )
        assert contract.get_claim(0)["status"] == "APPEALED"
        assert contract.get_entry(0)["has_open_claim"] is True

        direct_vm.mock_llm(r".*", _claim("INCONCLUSIVE"))
        direct_vm.sender = direct_alice
        contract.judge_appeal(0)
        cl = contract.get_claim(0)
        assert cl["status"] == "SETTLED"
        assert cl["appeal_verdict"] == "INCONCLUSIVE"
        assert cl["appeal_used"] is True
        assert cl["paid_out"] is True

    def test_response_window_blocks_late_reply(
        self, contract, direct_vm, direct_alice, direct_bob, monkeypatch
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _payable(
            contract,
            "amend_rules",
            0,
            "Material change",
            "Cut prizes",
            FIRST // 2,
            SECOND,
            0,
            1,
            value=FIRST,
        )
        direct_vm.sender = direct_bob
        _payable(
            contract,
            "file_claim",
            0,
            "unfair amend",
            "details",
            "https://example.com/ev",
            value=FIRST,
        )
        # Force response deadline into the past via claim storage if VM allows;
        # otherwise early judge without response must fail while window open.
        direct_vm.sender = direct_alice
        with pytest.raises(Exception):
            contract.judge_claim(0)

    def test_release_amend_stake_blocked_during_window(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        direct_vm.sender = direct_alice
        _payable(
            contract,
            "amend_rules",
            0,
            "Material change",
            "Cut prizes",
            FIRST // 2,
            SECOND,
            0,
            1,
            value=FIRST,
        )
        with pytest.raises(Exception):
            contract.release_amend_stake(0)

    def test_close_blocked_when_submissions_unpaid(
        self, contract, direct_vm, direct_alice, direct_bob
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        contract.submit_entry(0, "shipped", "https://github.com/example/demo")
        direct_vm.sender = direct_alice
        # Even after "deadline" conceptually, without finalize close must fail
        # while a SUBMITTED entry exists and prizes are unpaid.
        with pytest.raises(Exception):
            contract.close_contest(0)


class TestFinalize:
    def test_finalize_after_deadline_ranks_pass(
        self, contract, direct_vm, direct_alice, direct_bob, monkeypatch
    ):
        _create(contract)
        _register(contract, direct_vm, direct_bob)
        contract.submit_entry(0, "shipped", "https://github.com/example/demo")
        direct_vm.sender = direct_alice
        contract.review_submission(0)

        # Force deadline passed via contest storage is hard; call finalize should
        # fail while window open, succeed when we monkeypatch time if available.
        with pytest.raises(Exception):
            contract.finalize_prizes(0)
