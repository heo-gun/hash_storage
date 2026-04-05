import CryptoJS from "crypto-js";

export async function hashFile(file : File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as any);
    return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
}