export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTanggalWIB(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(d) + " WIB";
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Nomor HP Indonesia: 08xxxxxxxxxx atau 628xxxxxxxxxx, 9-13 digit setelah prefix.
export function isPhoneID(value: string): boolean {
  return /^(0|62)8[1-9][0-9]{7,11}$/.test(value.trim().replace(/[\s-]/g, ""));
}
