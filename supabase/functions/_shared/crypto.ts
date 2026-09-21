export function generateNumericCode(length: number): string {
  const digits = new Uint32Array(length);
  crypto.getRandomValues(digits);
  return Array.from(digits, (d) => (d % 10).toString()).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
