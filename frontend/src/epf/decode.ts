/**
 * .epf 디코더 (백엔드 app/services/epf_service.py 의 encode_epf 와 짝을 이룸).
 *
 * 레이아웃:
 *   [4] "EPF1" | [4] hdrLen(BE u32) | [n] header JSON | [16] GCM tag | [..] ciphertext
 *
 * 헤더는 AAD 로 쓰이므로 헤더가 한 바이트라도 바뀌면 복호화가 실패한다.
 */

export type EpfHeader = {
  alg: string;
  iv: string;
  key_id: string;
  policy_url: string;
  meta: {
    original_ext?: string;
    mime?: string | null;
    name?: string;
  };
};

const MAGIC = "EPF1";
const TAG_LEN = 16;

export class EpfDecodeError extends Error {}

// 반환 타입을 Uint8Array<ArrayBuffer> 로 좁힌다. 기본 Uint8Array 는
// ArrayBufferLike(=SharedArrayBuffer 포함)라서 WebCrypto 의 BufferSource 에 맞지 않는다.
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** base64 CEK 를 AES-GCM 복호화용 CryptoKey 로 가져온다. */
export async function importCek(cekBase64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(cekBase64);
  if (raw.length !== 32) {
    throw new EpfDecodeError("Invalid content key length");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

export async function decodeEpf(
  buffer: ArrayBuffer,
  cek: CryptoKey
): Promise<{ header: EpfHeader; payload: ArrayBuffer }> {
  const bytes = new Uint8Array(buffer);

  if (bytes.length < MAGIC.length + 4) {
    throw new EpfDecodeError("File is too short");
  }
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));
  if (magic !== MAGIC) {
    throw new EpfDecodeError("Not an EPF1 file");
  }

  const view = new DataView(buffer);
  const hdrLen = view.getUint32(4, false);
  const headerStart = 8;
  const headerEnd = headerStart + hdrLen;

  if (headerEnd + TAG_LEN > bytes.length) {
    throw new EpfDecodeError("Bad header length");
  }

  const headerBytes = bytes.subarray(headerStart, headerEnd);
  let header: EpfHeader;
  try {
    header = JSON.parse(new TextDecoder().decode(headerBytes));
  } catch {
    throw new EpfDecodeError("Header could not be read");
  }

  const tag = bytes.subarray(headerEnd, headerEnd + TAG_LEN);
  const ciphertext = bytes.subarray(headerEnd + TAG_LEN);

  // WebCrypto 는 태그가 암호문 뒤에 붙어 있길 기대하지만, .epf 는 태그를 앞에
  // 두므로 여기서 순서를 맞춰준다.
  const sealed = new Uint8Array(ciphertext.length + TAG_LEN);
  sealed.set(ciphertext, 0);
  sealed.set(tag, ciphertext.length);

  let payload: ArrayBuffer;
  try {
    payload = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(header.iv),
        additionalData: headerBytes,
        tagLength: TAG_LEN * 8,
      },
      cek,
      sealed
    );
  } catch {
    throw new EpfDecodeError("Decryption failed — the file was altered or the key does not match");
  }

  return { header, payload };
}
