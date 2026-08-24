"""업로드 해시 검증 — content-confirmation 공격 방어.

이 파일이 막는 시나리오: 공격자가 남의 파일 해시를 hash_id 로 주장하면서 아무
내용이나 올려, 검증 없이 그 blob 을 가리키는 노드를 얻는 것.
"""
import hashlib
import io

import pytest

from app.services import hash_service as hs


def stream_of(data: bytes) -> io.BytesIO:
    return io.BytesIO(data)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ── hash_id 형식 ───────────────────────────────────────────────

def test_accepts_lowercase_sha256():
    assert hs.is_valid_hash_id(sha(b"hello"))


@pytest.mark.parametrize(
    "bad",
    [
        None,
        "",
        sha(b"hello").upper(),          # 대문자는 다른 S3 키가 된다
        sha(b"hello")[:63],             # 길이 부족
        sha(b"hello") + "a",            # 길이 초과
        "../../etc/passwd",             # 경로처럼 생긴 키
        "abc/def",                      # 슬래시로 키 공간을 갈라놓는 시도
        "z" * 64,                       # hex 아님
    ],
)
def test_rejects_malformed_hash_id(bad):
    assert not hs.is_valid_hash_id(bad)


# ── 본문 검증 ──────────────────────────────────────────────────

def test_verify_returns_size_for_matching_bytes():
    data = b"the real file contents"
    assert hs.verify_stream(stream_of(data), sha(data)) == len(data)


def test_claiming_someone_elses_hash_is_rejected():
    """공격 재현: 피해자 파일의 해시 + 1바이트 더미."""
    victim_hash = sha(b"a private document that the attacker never had")
    with pytest.raises(hs.HashMismatch) as e:
        hs.verify_stream(stream_of(b"x"), victim_hash)
    assert e.value.claimed == victim_hash
    assert e.value.actual == sha(b"x")


def test_empty_upload_cannot_claim_a_hash():
    with pytest.raises(hs.HashMismatch):
        hs.verify_stream(stream_of(b""), sha(b"anything"))


def test_stream_is_rewound_for_the_s3_upload():
    """검증이 스트림을 소진해버리면 S3 에 빈 오브젝트가 올라간다."""
    data = b"payload that must still be readable"
    s = stream_of(data)
    hs.verify_stream(s, sha(data))
    assert s.read() == data


def test_size_is_measured_from_the_bytes_not_the_claim():
    """quota 는 실제로 받은 바이트 수로 계산돼야 한다."""
    data = b"0123456789"
    _, size = hs.digest_and_size(stream_of(data))
    assert size == 10


def test_multi_chunk_file_hashes_correctly():
    data = b"\xa5" * (hs.CHUNK * 2 + 1234)
    assert hs.verify_stream(stream_of(data), sha(data)) == len(data)
