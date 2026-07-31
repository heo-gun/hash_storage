"""access_grants 정책 판정 로직 테스트.

DB 없이 돌리기 위해 cursor 는 가짜를 쓴다. FOR UPDATE 로 얻는 동시성 보장 자체는
여기서 검증할 수 없고, 검증하는 것은 "한도/만료/취소를 올바르게 거부하는가"이다.
"""
from datetime import datetime, timedelta, timezone

import pytest
from flask import Flask

from app.services import share_service as ss


@pytest.fixture
def app_ctx():
    """write_audit 이 flask.request 를 읽으므로 요청 컨텍스트가 필요하다."""
    app = Flask(__name__)
    with app.test_request_context("/", headers={"User-Agent": "pytest"}):
        yield


class FakeCursor:
    """UPDATE ... RETURNING 만 흉내내는 최소 커서."""

    def __init__(self):
        self.audit = []
        self._last = None

    def execute(self, sql, params=()):
        if "INSERT INTO audit_logs" in sql:
            self.audit.append({"grant_id": params[0], "action": params[1]})
            self._last = None
        elif "view_count = view_count + 1" in sql:
            self._last = {"view_count": self.view_count + 1}
        elif "print_count = print_count + 1" in sql:
            self._last = {"print_count": self.print_count + 1}

    def fetchone(self):
        return self._last


def make_grant(**overrides):
    grant = {
        "grant_id": "g1",
        "revoked_at": None,
        "expires_at": None,
        "max_views": None,
        "max_prints": None,
        "view_count": 0,
        "print_count": 0,
        "node_type": "file",
        "s3_key": "abc123",
        "name": "doc.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 1234,
        "allow_download": False,
        "grantee_email": "r@example.com",
    }
    grant.update(overrides)
    return grant


def cursor_for(grant):
    cur = FakeCursor()
    cur.view_count = grant["view_count"]
    cur.print_count = grant["print_count"]
    return cur


# ── assert_viewable ────────────────────────────────────────────

def test_unlimited_grant_is_viewable():
    ss.assert_viewable(make_grant())


def test_revoked_grant_denied():
    with pytest.raises(ss.PolicyDenied, match="취소"):
        ss.assert_viewable(make_grant(revoked_at=datetime.now(timezone.utc)))


def test_expired_grant_denied():
    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    with pytest.raises(ss.PolicyDenied, match="만료"):
        ss.assert_viewable(make_grant(expires_at=past))


def test_future_expiry_is_viewable():
    future = datetime.now(timezone.utc) + timedelta(days=1)
    ss.assert_viewable(make_grant(expires_at=future))


def test_exhausted_views_denied():
    with pytest.raises(ss.PolicyDenied, match="열람"):
        ss.assert_viewable(make_grant(max_views=3, view_count=3))


def test_last_view_still_allowed():
    """view_count 가 한도 미만이면 아직 한 번 더 볼 수 있어야 한다 (off-by-one 방지)."""
    ss.assert_viewable(make_grant(max_views=3, view_count=2))


def test_missing_blob_denied():
    with pytest.raises(ss.PolicyDenied) as e:
        ss.assert_viewable(make_grant(s3_key=None))
    assert e.value.status == 404


# ── consume_view ───────────────────────────────────────────────

def test_consume_view_reports_remaining(app_ctx):
    grant = make_grant(max_views=5, view_count=2)
    cur = cursor_for(grant)
    assert ss.consume_view(cur, grant) == 2  # 5 - 3
    assert cur.audit == [{"grant_id": "g1", "action": "view"}]


def test_consume_view_unlimited_returns_minus_one(app_ctx):
    grant = make_grant()
    assert ss.consume_view(cursor_for(grant), grant) == -1


def test_consume_view_on_last_allowed_view_leaves_zero(app_ctx):
    grant = make_grant(max_views=3, view_count=2)
    assert ss.consume_view(cursor_for(grant), grant) == 0


def test_consume_view_beyond_limit_raises(app_ctx):
    grant = make_grant(max_views=1, view_count=1)
    with pytest.raises(ss.PolicyDenied):
        ss.consume_view(cursor_for(grant), grant)


# ── consume_print ──────────────────────────────────────────────

def test_consume_print_reports_remaining(app_ctx):
    grant = make_grant(max_prints=2, print_count=0)
    assert ss.consume_print(cursor_for(grant), grant) == 1


def test_consume_print_exhausted_denied_and_audited(app_ctx):
    grant = make_grant(max_prints=1, print_count=1)
    cur = cursor_for(grant)
    with pytest.raises(ss.PolicyDenied, match="인쇄"):
        ss.consume_print(cur, grant)
    assert cur.audit == [{"grant_id": "g1", "action": "denied"}]


def test_print_zero_limit_blocks_all_printing(app_ctx):
    """max_prints=0 은 '인쇄 금지'를 뜻해야 한다."""
    grant = make_grant(max_prints=0, print_count=0)
    with pytest.raises(ss.PolicyDenied):
        ss.consume_print(cursor_for(grant), grant)


def test_expired_grant_cannot_print(app_ctx):
    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    grant = make_grant(expires_at=past, max_prints=5)
    with pytest.raises(ss.PolicyDenied, match="만료"):
        ss.consume_print(cursor_for(grant), grant)


# ── public_policy_view ─────────────────────────────────────────

def test_policy_view_hides_internal_identifiers():
    view = ss.public_policy_view(make_grant())
    for leaked in ("grant_id", "node_id", "s3_key", "grantor_id", "share_token"):
        assert leaked not in view


def test_policy_view_reports_remaining_counts():
    view = ss.public_policy_view(make_grant(max_views=10, view_count=4,
                                            max_prints=2, print_count=2))
    assert view["views_remaining"] == 6
    assert view["prints_remaining"] == 0


def test_policy_view_unlimited_is_minus_one():
    view = ss.public_policy_view(make_grant())
    assert view["views_remaining"] == -1
    assert view["prints_remaining"] == -1


def test_share_tokens_are_unique_and_long():
    tokens = {ss.new_share_token() for _ in range(500)}
    assert len(tokens) == 500
    assert all(len(t) >= 40 for t in tokens)
