const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Jumlah hari kalender dari hari ini (WIB) ke tanggal target. Negatif = sudah lewat.
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const target = new Date(dateStr + "T00:00:00+07:00");
  const today = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now) + "T00:00:00+07:00"
  );
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export function sisaKontrakLabel(endDate: string | null): string {
  if (!endDate) return "Tidak ditentukan (per bulan)";
  const days = daysUntil(endDate);
  if (days < 0) return "Kontrak berakhir";
  if (days === 0) return "Berakhir hari ini";
  if (days < 30) return `${days} hari lagi`;
  const months = Math.round(days / 30);
  return `${months} bulan lagi`;
}
