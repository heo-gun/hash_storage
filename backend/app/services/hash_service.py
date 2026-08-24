"""업로드 본문의 해시를 서버가 직접 확인한다.

클라이언트가 보낸 hash_id 를 그대로 믿으면, 남의 파일 해시를 주장하며 빈 본문을
올려 그 blob 을 가리키는 노드를 만들 수 있다(content-confirmation 공격). 또한
주장한 크기로 quota 를 더하고 실제 크기로 빼게 되어 사용량 회계가 무너진다.

그래서 dedup 여부와 무관하게 본문을 끝까지 읽어 해시를 계산한다. 이 비용이
"해시만 보내고 본문은 생략하는" 대역폭 최적화와 맞바꾼 안전성이다.
"""
import hashlib
import re

HASH_RE = re.compile(r"^[0-9a-f]{64}$")
CHUNK = 1 << 20


class HashMismatch(Exception):
    def __init__(self, claimed: str, actual: str):
        super().__init__("uploaded bytes do not match the declared hash")
        self.claimed = claimed
        self.actual = actual


def is_valid_hash_id(value: str | None) -> bool:
    """소문자 hex 64자만 허용. 이 값이 그대로 S3 키가 되므로 형식을 좁혀둔다."""
    return bool(value) and bool(HASH_RE.match(value))


def digest_and_size(stream) -> tuple[str, int]:
    """스트림을 한 번 훑어 (sha256 hex, 바이트 수) 를 반환하고 처음으로 되감는다."""
    stream.seek(0)
    digest = hashlib.sha256()
    size = 0
    while True:
        chunk = stream.read(CHUNK)
        if not chunk:
            break
        size += len(chunk)
        digest.update(chunk)
    stream.seek(0)
    return digest.hexdigest(), size


def verify_stream(stream, claimed_hash: str) -> int:
    """본문이 claimed_hash 와 일치하면 크기를 반환, 아니면 HashMismatch."""
    actual, size = digest_and_size(stream)
    if actual != claimed_hash:
        raise HashMismatch(claimed_hash, actual)
    return size
