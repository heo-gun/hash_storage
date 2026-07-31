import base64
import os

import pytest

os.environ.setdefault("EPF_MASTER_KEY", base64.b64encode(os.urandom(32)).decode())

from app.services import epf_service as epf  # noqa: E402


def test_cek_wrap_roundtrip():
    cek = epf.generate_cek()
    assert epf.unwrap_cek(epf.wrap_cek(cek)) == cek


def test_wrap_uses_fresh_iv_each_time():
    """같은 CEK 를 두 번 감싸도 결과가 달라야 한다 (IV 재사용 금지)."""
    cek = epf.generate_cek()
    assert epf.wrap_cek(cek) != epf.wrap_cek(cek)


def test_epf_roundtrip_preserves_payload():
    cek = epf.generate_cek()
    payload = os.urandom(20_000)
    blob = epf.encode_epf(payload, cek, key_id="k1", policy_url="/access/policy",
                          meta={"original_ext": "pdf"})

    assert blob.startswith(b"EPF1")
    header, out = epf.decode_epf(blob, cek)
    assert out == payload
    assert header["alg"] == "AES-256-GCM"
    assert header["key_id"] == "k1"


def test_decode_rejects_wrong_cek():
    cek = epf.generate_cek()
    blob = epf.encode_epf(b"secret", cek, key_id="k1", policy_url="/p", meta={})
    with pytest.raises(epf.EpfError):
        epf.decode_epf(blob, epf.generate_cek())


def test_decode_rejects_tampered_header():
    """헤더가 AAD 이므로 key_id 한 글자만 바꿔도 복호화가 실패해야 한다."""
    cek = epf.generate_cek()
    blob = epf.encode_epf(b"secret", cek, key_id="k1", policy_url="/p", meta={})
    tampered = bytearray(blob)
    tampered[blob.index(b"k1")] = ord("X")
    with pytest.raises(epf.EpfError):
        epf.decode_epf(bytes(tampered), cek)


def test_decode_rejects_tampered_ciphertext():
    cek = epf.generate_cek()
    blob = bytearray(epf.encode_epf(b"a" * 100, cek, key_id="k", policy_url="/p",
                                    meta={}))
    blob[-1] ^= 0x01
    with pytest.raises(epf.EpfError):
        epf.decode_epf(bytes(blob), cek)


def test_decode_rejects_bad_magic():
    with pytest.raises(epf.EpfError):
        epf.decode_epf(b"NOPE" + b"\x00" * 40, epf.generate_cek())


@pytest.mark.parametrize("mime,expected", [
    ("application/pdf", True),
    ("application/pdf; charset=binary", True),
    ("image/png", True),
    ("image/jpeg", True),
    ("IMAGE/PNG", True),
    ("application/zip", False),
    ("text/plain", False),
    ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", False),
    (None, False),
    ("", False),
])
def test_is_protectable(mime, expected):
    assert epf.is_protectable(mime) is expected


def test_master_key_must_be_32_bytes(monkeypatch):
    monkeypatch.setenv("EPF_MASTER_KEY", base64.b64encode(os.urandom(16)).decode())
    with pytest.raises(epf.EpfError, match="32"):
        epf.wrap_cek(epf.generate_cek())


def test_missing_master_key_raises(monkeypatch):
    monkeypatch.setenv("EPF_MASTER_KEY", "")
    with pytest.raises(epf.EpfError):
        epf.wrap_cek(epf.generate_cek())
