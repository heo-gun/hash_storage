"""감사 로그 IP — 클라이언트가 보낸 X-Forwarded-For 를 믿지 않는다.

nginx 는 `$proxy_add_x_forwarded_for` 로 클라이언트 값 **뒤에** 실제 주소를
덧붙인다. 따라서 첫 항목은 요청자가 원하는 값을 적을 수 있고, 그것을 그대로
기록하면 감사 로그를 위조할 수 있다.
"""
from app.services.share_service import client_ip_from

REAL = "203.0.113.9"
SPOOFED = "1.2.3.4"


def test_prefers_x_real_ip_set_by_nginx():
    headers = {"X-Real-IP": REAL, "X-Forwarded-For": f"{SPOOFED}, {REAL}"}
    assert client_ip_from(headers, "10.0.0.1") == REAL


def test_spoofed_first_hop_is_ignored():
    headers = {"X-Forwarded-For": f"{SPOOFED}, {REAL}"}
    assert client_ip_from(headers, "10.0.0.1") == REAL


def test_single_hop_is_used_as_is():
    assert client_ip_from({"X-Forwarded-For": REAL}, "10.0.0.1") == REAL


def test_falls_back_to_remote_addr():
    assert client_ip_from({}, "10.0.0.1") == "10.0.0.1"


def test_blank_headers_do_not_win_over_remote_addr():
    headers = {"X-Real-IP": "  ", "X-Forwarded-For": " , "}
    assert client_ip_from(headers, "10.0.0.1") == "10.0.0.1"
