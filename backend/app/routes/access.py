"""보호 뷰어용 접근 API — 인증 없이 공유 토큰만으로 동작.

비회원 수신자도 열람할 수 있어야 하므로 @require_auth 를 걸지 않는다.
접근 자격 증명은 추측 불가능한 share_token 그 자체다.
"""
import base64
import io
import os
from contextlib import closing

from flask import jsonify, request, send_file

from app.config import S3_BUCKET_NAME
from app.db import get_db_connection
from app.routes import bp
from app.services.epf_service import EpfError, encode_epf, unwrap_cek
from app.services.share_service import (
    PolicyDenied,
    assert_viewable,
    consume_print,
    consume_view,
    load_grant_for_update,
    public_policy_view,
    write_audit,
)
from app.storage import get_s3_client


def _token() -> str:
    token = (request.args.get("token") or "").strip()
    if not token and request.is_json:
        token = (request.get_json(silent=True) or {}).get("token", "").strip()
    if not token:
        raise PolicyDenied("token is required", 400)
    return token


def _load_cek(cur, grant_id) -> tuple[str, bytes]:
    cur.execute(
        "SELECT key_id, wrapped_cek FROM content_keys WHERE grant_id = %s",
        (grant_id,),
    )
    row = cur.fetchone()
    if not row:
        raise PolicyDenied("콘텐츠 키가 없습니다", 500)
    return str(row["key_id"]), unwrap_cek(row["wrapped_cek"])


@bp.route("/access/policy", methods=["GET"])
def access_policy():
    """정책 요약 + CEK 반환. 열람 1회를 소비한다.

    뷰어가 페이지를 열 때 한 번 호출한다. 카운트 증가와 한도 검사가 같은
    트랜잭션 안에서 행 잠금 하에 일어나므로 동시 요청으로 한도를 넘길 수 없다.
    """
    try:
        token = _token()
        with closing(get_db_connection()) as conn:
            with conn.cursor() as cur:
                grant = load_grant_for_update(cur, token)
                try:
                    remaining = consume_view(cur, grant)
                except PolicyDenied:
                    write_audit(cur, grant["grant_id"], "denied",
                                grant["grantee_email"])
                    conn.commit()  # 거부 로그는 남긴다
                    raise

                key_id, cek = _load_cek(cur, grant["grant_id"])
                policy = public_policy_view(grant)
                conn.commit()

        policy["views_remaining"] = remaining
        return jsonify({
            "key_id": key_id,
            "cek": base64.b64encode(cek).decode(),
            "policy": policy,
        })
    except PolicyDenied as e:
        return jsonify({"message": e.reason}), e.status
    except EpfError as e:
        return jsonify({"message": str(e)}), 503


@bp.route("/access/content", methods=["GET"])
def access_content():
    """원본을 CEK 로 감싼 .epf 바이트를 스트리밍한다.

    S3 에는 평문 원본만 있고 .epf 는 저장하지 않는다. 요청 시점에 감싸므로
    유출될 수 있는 영구 암호문 사본이 생기지 않는다.
    """
    try:
        token = _token()
        with closing(get_db_connection()) as conn:
            with conn.cursor() as cur:
                grant = load_grant_for_update(cur, token)
                # 여기서는 카운트를 소비하지 않는다 — /access/policy 가 이미 셌다.
                assert_viewable(grant)
                key_id, cek = _load_cek(cur, grant["grant_id"])
                conn.commit()

        s3 = get_s3_client()
        payload = s3.get_object(Bucket=S3_BUCKET_NAME, Key=grant["s3_key"])["Body"].read()

        _, ext = os.path.splitext(grant["name"])
        blob = encode_epf(
            payload,
            cek,
            key_id=key_id,
            policy_url="/access/policy",
            meta={
                "original_ext": ext.lstrip(".").lower(),
                "mime": grant["mime_type"],
                "name": grant["name"],
            },
        )

        response = send_file(
            io.BytesIO(blob),
            mimetype="application/vnd.castor.epf",
            as_attachment=False,
            download_name=f"{grant['name']}.epf",
        )
        # 보호 대상이므로 어떤 캐시에도 남기지 않는다.
        response.headers["Cache-Control"] = "no-store, private"
        return response
    except PolicyDenied as e:
        return jsonify({"message": e.reason}), e.status
    except EpfError as e:
        return jsonify({"message": str(e)}), 503


@bp.route("/access/print", methods=["POST"])
def access_print():
    try:
        token = _token()
        with closing(get_db_connection()) as conn:
            with conn.cursor() as cur:
                grant = load_grant_for_update(cur, token)
                remaining = consume_print(cur, grant)
                conn.commit()
        return jsonify({"message": "ok", "prints_remaining": remaining})
    except PolicyDenied as e:
        return jsonify({"message": e.reason}), e.status


@bp.route("/access/download", methods=["GET"])
def access_download():
    """allow_download 가 켜진 공유에 한해 원본을 그대로 내려준다."""
    try:
        token = _token()
        with closing(get_db_connection()) as conn:
            with conn.cursor() as cur:
                grant = load_grant_for_update(cur, token)
                assert_viewable(grant)
                if not grant["allow_download"]:
                    write_audit(cur, grant["grant_id"], "denied",
                                grant["grantee_email"])
                    conn.commit()
                    raise PolicyDenied("이 공유는 다운로드를 허용하지 않습니다")
                write_audit(cur, grant["grant_id"], "download",
                            grant["grantee_email"])
                conn.commit()

        s3 = get_s3_client()
        obj = s3.get_object(Bucket=S3_BUCKET_NAME, Key=grant["s3_key"])
        return send_file(
            io.BytesIO(obj["Body"].read()),
            mimetype=grant["mime_type"] or "application/octet-stream",
            as_attachment=True,
            download_name=grant["name"],
        )
    except PolicyDenied as e:
        return jsonify({"message": e.reason}), e.status
