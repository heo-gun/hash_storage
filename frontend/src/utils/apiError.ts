function responseData(error: unknown): Record<string, unknown> | null {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object"
  ) {
    return error.response.data as Record<string, unknown>;
  }
  return null;
}

/**
 * 백엔드가 내려준 기계 판독용 code. 문구는 바뀔 수 있으므로 분기는 이걸로 한다.
 * (예: /access/* 의 "auth_required" vs "recipient_mismatch")
 */
export function getApiErrorCode(error: unknown): string | null {
  const code = responseData(error)?.code;
  return typeof code === "string" ? code : null;
}

/** 수신자 지정 공유에서 백엔드가 주는 마스킹된 이메일 힌트 (r****@example.com). */
export function getApiErrorHint(error: unknown): string | null {
  const hint = responseData(error)?.grantee_hint;
  return typeof hint === "string" ? hint : null;
}

/** Axios/백엔드 응답에서 message 문자열 추출 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data
  ) {
    const msg = (error.response.data as { message?: string }).message;
    return String(msg ?? "") || fallback;
  }
  return fallback;
}
