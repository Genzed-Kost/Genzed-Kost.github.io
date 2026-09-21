// Generator payload QRIS EMV — port dari logika yang sudah jalan di landing page
// (index.html), dipindah ke server supaya nomor akun QRIS asli jadi secret,
// bukan nilai yang bisa dibaca siapa pun lewat devtools.
// Beda dengan landing page (QRIS statis tanpa nominal), di sini nominal + kode
// unik DISERTAKAN di payload (tag 54) supaya penghuni nggak perlu ketik manual.

function emv(id: string, val: string): string {
  return id + String(val.length).padStart(2, "0") + val;
}

function crc16(str: string): string {
  let c = 0xffff;
  for (let i = 0; i < str.length; i++) {
    c ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, "0");
}

export function buildQrisPayload(params: { merchantAccount: string; amount: number; referenceCode: string }): string {
  const mai = emv("00", "ID.CO.JAGO.WWW") + emv("01", params.merchantAccount) + emv("02", "UMI");
  const adf = emv("05", params.referenceCode);

  const body =
    emv("00", "01") +
    emv("01", "12") +
    emv("26", mai) +
    emv("52", "5999") +
    emv("53", "360") +
    emv("54", String(Math.round(params.amount))) +
    emv("58", "ID") +
    emv("59", "GENZED KOST") +
    emv("60", "INDONESIA") +
    emv("62", adf);

  return body + emv("63", crc16(body + "6304"));
}
