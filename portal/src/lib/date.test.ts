import { describe, expect, it } from "vitest";
import { daysUntil, sisaKontrakLabel } from "./date";

describe("daysUntil", () => {
  it("menghitung selisih hari dengan benar", () => {
    const now = new Date("2026-01-01T10:00:00+07:00");
    expect(daysUntil("2026-01-08", now)).toBe(7);
    expect(daysUntil("2026-01-01", now)).toBe(0);
    expect(daysUntil("2025-12-30", now)).toBe(-2);
  });
});

describe("sisaKontrakLabel", () => {
  it("mengembalikan label per bulan kalau tanpa end_date", () => {
    expect(sisaKontrakLabel(null)).toBe("Tidak ditentukan (per bulan)");
  });
  it("mengembalikan 'Kontrak berakhir' kalau sudah lewat", () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(sisaKontrakLabel(past)).toBe("Kontrak berakhir");
  });
});
