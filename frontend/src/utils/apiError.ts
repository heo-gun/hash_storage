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
