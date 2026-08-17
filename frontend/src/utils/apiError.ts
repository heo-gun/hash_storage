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

/** 문구는 바뀔 수 있으므로 분기는 code 로 한다 ("auth_required" vs "recipient_mismatch"). */
export function getApiErrorCode(error: unknown): string | null {
  const code = responseData(error)?.code;
  return typeof code === "string" ? code : null;
}

/** 마스킹된 수신자 힌트 (r****@example.com). */
export function getApiErrorHint(error: unknown): string | null {
  const hint = responseData(error)?.grantee_hint;
  return typeof hint === "string" ? hint : null;
}

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
