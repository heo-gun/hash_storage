/**
 * Web Crypto API (native) 로 SHA-256 계산.
 * crypto-js 대비 메인스레드 블로킹 없이 대용량 파일도 처리 가능.
 */
export async function hashFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
