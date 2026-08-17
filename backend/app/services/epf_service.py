""".epf (Encrypted Protected File) 인코딩 + CEK 래핑.

포맷:
    [4]  magic       "EPF1"
    [4]  hdr_len     big-endian uint32
    [n]  header      UTF-8 JSON — {alg, iv, key_id, policy_url, meta:{original_ext, mime, name}}
    [16] tag         AES-GCM 인증 태그
    [..] ciphertext  AES-256-GCM(payload)

위협 모델에 대해 정직하게: 뷰어는 복호화를 위해 CEK 를 받아야 하므로, 이 암호화는
"정책 검증을 거치지 않고는 바이트를 얻을 수 없다"는 것과 "전송 구간/브라우저 캐시에
평문 원본이 남지 않는다"는 것까지만 보장한다. 화면 캡처나 CEK 를 직접 꺼내가는
수신자는 막지 못한다 — 그쪽은 워터마크 기반 책임 추적으로 대응한다.
"""
import base64
import json
import os
import struct

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"EPF1"
ALG = "AES-256-GCM"
IV_LEN = 12
TAG_LEN = 16
KEY_LEN = 32

# .epf 로 감쌀 수 있는 포맷. 이 목록 밖은 보호 공유 대상이 아니다.
VIEWABLE_MIME_PREFIXES = ("image/",)
VIEWABLE_MIMES = {"application/pdf"}


class EpfError(Exception):
    pass


def is_protectable(mime_type: str | None) -> bool:
    if not mime_type:
        return False
    mime = mime_type.split(";")[0].strip().lower()
    return mime in VIEWABLE_MIMES or mime.startswith(VIEWABLE_MIME_PREFIXES)


def _master_key() -> bytes:
    """fallback 기본키를 일부러 두지 않았다 — 개발용 키가 프로덕션에 그대로 나갈 수 있다."""
    raw = os.getenv("EPF_MASTER_KEY", "")
    if not raw:
        raise EpfError("EPF_MASTER_KEY 가 설정되지 않았습니다")
    try:
        key = base64.b64decode(raw, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise EpfError("EPF_MASTER_KEY 는 base64 여야 합니다") from exc
    if len(key) != KEY_LEN:
        raise EpfError(f"EPF_MASTER_KEY 는 {KEY_LEN}바이트여야 합니다 (현재 {len(key)})")
    return key


def generate_cek() -> bytes:
    return AESGCM.generate_key(bit_length=256)


def wrap_cek(cek: bytes) -> bytes:
    """결과 배치는 iv(12) || ciphertext || tag."""
    iv = os.urandom(IV_LEN)
    sealed = AESGCM(_master_key()).encrypt(iv, cek, None)
    return iv + sealed


def unwrap_cek(wrapped: bytes) -> bytes:
    wrapped = bytes(wrapped)
    if len(wrapped) <= IV_LEN + TAG_LEN:
        raise EpfError("wrapped_cek 이 손상되었습니다")
    iv, sealed = wrapped[:IV_LEN], wrapped[IV_LEN:]
    try:
        return AESGCM(_master_key()).decrypt(iv, sealed, None)
    except Exception as exc:  # noqa: BLE001
        raise EpfError("CEK 를 열 수 없습니다 (마스터키 불일치?)") from exc


def encode_epf(payload: bytes, cek: bytes, *, key_id: str, policy_url: str,
               meta: dict) -> bytes:
    """헤더는 AAD 로도 쓰인다 — 헤더를 조작하면 복호화가 실패한다."""
    if len(cek) != KEY_LEN:
        raise EpfError("CEK 는 32바이트여야 합니다")

    iv = os.urandom(IV_LEN)
    header = {
        "alg": ALG,
        "iv": base64.b64encode(iv).decode(),
        "key_id": key_id,
        "policy_url": policy_url,
        "meta": meta,
    }
    header_bytes = json.dumps(header, separators=(",", ":"),
                              ensure_ascii=False).encode()

    sealed = AESGCM(cek).encrypt(iv, payload, header_bytes)
    ciphertext, tag = sealed[:-TAG_LEN], sealed[-TAG_LEN:]

    return (
        MAGIC
        + struct.pack(">I", len(header_bytes))
        + header_bytes
        + tag
        + ciphertext
    )


def decode_epf(blob: bytes, cek: bytes) -> tuple[dict, bytes]:
    """서버측 검증/테스트용 디코더. 실제 뷰어는 프론트엔드에서 복호화한다."""
    if not blob.startswith(MAGIC):
        raise EpfError("EPF1 매직이 아닙니다")

    offset = len(MAGIC)
    (hdr_len,) = struct.unpack(">I", blob[offset:offset + 4])
    offset += 4

    header_bytes = blob[offset:offset + hdr_len]
    offset += hdr_len
    header = json.loads(header_bytes)

    tag = blob[offset:offset + TAG_LEN]
    ciphertext = blob[offset + TAG_LEN:]
    iv = base64.b64decode(header["iv"])

    try:
        payload = AESGCM(cek).decrypt(iv, ciphertext + tag, header_bytes)
    except Exception as exc:  # noqa: BLE001
        raise EpfError("페이로드 복호화 실패") from exc

    return header, payload
