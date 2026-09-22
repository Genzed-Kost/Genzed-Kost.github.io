import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  billingAnchorFromStartDate,
  calculateFirstPeriodSewaAmount,
  calculatePenalty,
  calculateSewaAmount,
  computePeriodEnd,
  firstAnchoredPeriodEnd,
  formatInvoiceNumber,
  inclusiveDayCount,
  invoicePublishDate,
  nextAnchoredPeriodEnd,
  overlapDays,
} from "./billing";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("addMonthsClamped", () => {
  it("nambah bulan biasa", () => {
    expect(addMonthsClamped(d("2026-01-05"), 1).toISOString().slice(0, 10)).toBe("2026-02-05");
  });
  it("clamp ke akhir bulan kalau overflow (31 Jan + 1 bulan)", () => {
    expect(addMonthsClamped(d("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
  it("clamp ke 29 Feb di tahun kabisat", () => {
    expect(addMonthsClamped(d("2028-01-31"), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
  it("nambah tahun kalau lewat Desember", () => {
    expect(addMonthsClamped(d("2026-12-15"), 1).toISOString().slice(0, 10)).toBe("2027-01-15");
  });
});

describe("computePeriodEnd", () => {
  it("BULANAN: akhir periode = 1 hari sebelum bulan depan", () => {
    expect(computePeriodEnd(d("2026-01-01"), "BULANAN").toISOString().slice(0, 10)).toBe("2026-01-31");
  });
  it("TRIWULAN: 3 bulan", () => {
    expect(computePeriodEnd(d("2026-01-01"), "TRIWULAN").toISOString().slice(0, 10)).toBe("2026-03-31");
  });
  it("TAHUNAN: 12 bulan", () => {
    expect(computePeriodEnd(d("2026-01-01"), "TAHUNAN").toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});

describe("inclusiveDayCount & overlapDays", () => {
  it("hitung hari inklusif", () => {
    expect(inclusiveDayCount(d("2026-01-01"), d("2026-01-31"))).toBe(31);
    expect(inclusiveDayCount(d("2026-01-01"), d("2026-01-01"))).toBe(1);
  });
  it("overlap penuh kalau tenancy mencakup seluruh periode", () => {
    expect(overlapDays(d("2026-01-01"), d("2026-01-31"), d("2025-01-01"), null)).toBe(31);
  });
  it("overlap sebagian kalau penghuni masuk tengah bulan", () => {
    expect(overlapDays(d("2026-01-01"), d("2026-01-31"), d("2026-01-15"), null)).toBe(17); // 15..31
  });
  it("overlap sebagian kalau penghuni keluar tengah bulan", () => {
    expect(overlapDays(d("2026-01-01"), d("2026-01-31"), d("2025-01-01"), d("2026-01-10"))).toBe(10); // 1..10
  });
});

describe("calculateSewaAmount (prorata)", () => {
  it("tarif penuh kalau penghuni sudah sewa sejak awal periode", () => {
    const r = calculateSewaAmount(1000000, d("2026-01-01"), d("2026-01-31"), d("2025-01-01"), null);
    expect(r.amount).toBe(1000000);
    expect(r.isProrated).toBe(false);
  });
  it("prorata kalau masuk tengah bulan (masuk tanggal 15, 31 hari di bulan itu, 17 hari terpakai)", () => {
    const r = calculateSewaAmount(1000000, d("2026-01-01"), d("2026-01-31"), d("2026-01-15"), null);
    expect(r.isProrated).toBe(true);
    expect(r.occupiedDays).toBe(17);
    expect(r.totalDays).toBe(31);
    expect(r.amount).toBe(Math.round((1000000 * 17) / 31));
  });
  it("prorata kalau keluar tengah bulan", () => {
    const r = calculateSewaAmount(800000, d("2026-02-01"), d("2026-02-28"), d("2025-01-01"), d("2026-02-10"));
    expect(r.isProrated).toBe(true);
    expect(r.occupiedDays).toBe(10);
    expect(r.totalDays).toBe(28);
  });
});

describe("calculatePenalty", () => {
  it("nol kalau masih dalam masa tenggang", () => {
    const p = calculatePenalty({
      outstandingAmount: 800000,
      calcType: "NOMINAL_PER_HARI",
      value: 10000,
      gracePeriodDays: 3,
      maxAmount: null,
      daysLate: 2,
    });
    expect(p).toBe(0);
  });
  it("nominal per hari setelah masa tenggang", () => {
    const p = calculatePenalty({
      outstandingAmount: 800000,
      calcType: "NOMINAL_PER_HARI",
      value: 10000,
      gracePeriodDays: 3,
      maxAmount: null,
      daysLate: 5,
    });
    expect(p).toBe(20000); // (5-3) hari x 10rb
  });
  it("persen per hari dari sisa tagihan", () => {
    const p = calculatePenalty({
      outstandingAmount: 1000000,
      calcType: "PERSEN_PER_HARI",
      value: 1, // 1% per hari
      gracePeriodDays: 0,
      maxAmount: null,
      daysLate: 5,
    });
    expect(p).toBe(50000); // 1% x 1jt x 5 hari
  });
  it("dibatasi max_amount", () => {
    const p = calculatePenalty({
      outstandingAmount: 1000000,
      calcType: "PERSEN_PER_HARI",
      value: 5,
      gracePeriodDays: 0,
      maxAmount: 100000,
      daysLate: 10,
    });
    expect(p).toBe(100000);
  });
});

describe("formatInvoiceNumber", () => {
  it("format INV-YYYYMM-XXXX", () => {
    expect(formatInvoiceNumber(d("2026-01-15"), 7)).toBe("INV-202601-0007");
    expect(formatInvoiceNumber(d("2026-11-01"), 123)).toBe("INV-202611-0123");
  });
});

describe("billingAnchorFromStartDate", () => {
  it("tanggal 1-15 -> anchor 1", () => {
    expect(billingAnchorFromStartDate(d("2026-09-01"))).toBe(1);
    expect(billingAnchorFromStartDate(d("2026-09-15"))).toBe(1);
  });
  it("tanggal 16-31 -> anchor 16", () => {
    expect(billingAnchorFromStartDate(d("2026-09-16"))).toBe(16);
    expect(billingAnchorFromStartDate(d("2026-09-30"))).toBe(16);
  });
});

describe("firstAnchoredPeriodEnd", () => {
  it("mulai tanggal 5 (anchor 1) -> periode pertama berakhir akhir bulan itu juga", () => {
    expect(firstAnchoredPeriodEnd(d("2026-09-05"), "BULANAN", 1).toISOString().slice(0, 10)).toBe("2026-09-30");
  });
  it("mulai tanggal 22 (anchor 16) -> periode pertama berakhir tanggal 15 bulan depan", () => {
    expect(firstAnchoredPeriodEnd(d("2026-09-22"), "BULANAN", 16).toISOString().slice(0, 10)).toBe("2026-10-15");
  });
  it("mulai persis tanggal 16 (anchor 16) -> tetap berakhir tanggal 15 bulan depan", () => {
    expect(firstAnchoredPeriodEnd(d("2026-09-16"), "BULANAN", 16).toISOString().slice(0, 10)).toBe("2026-10-15");
  });
});

describe("nextAnchoredPeriodEnd", () => {
  it("periode anchor 1 bulanan: 1 Okt -> akhir Okt", () => {
    expect(nextAnchoredPeriodEnd(d("2026-10-01"), "BULANAN", 1).toISOString().slice(0, 10)).toBe("2026-10-31");
  });
  it("periode anchor 16 bulanan: 16 Okt -> 15 Nov", () => {
    expect(nextAnchoredPeriodEnd(d("2026-10-16"), "BULANAN", 16).toISOString().slice(0, 10)).toBe("2026-11-15");
  });
});

describe("invoicePublishDate", () => {
  it("anchor 1: terbit tanggal 25 bulan sebelumnya", () => {
    expect(invoicePublishDate(d("2026-10-01"), 1).toISOString().slice(0, 10)).toBe("2026-09-25");
  });
  it("anchor 16: terbit tanggal 10 bulan yang sama", () => {
    expect(invoicePublishDate(d("2026-09-16"), 16).toISOString().slice(0, 10)).toBe("2026-09-10");
  });
});

describe("calculateFirstPeriodSewaAmount", () => {
  it("masuk tanggal 22 (anchor 16, periode penuh 16..15 = 30 hari, terpakai 22..15 = 24 hari)", () => {
    const r = calculateFirstPeriodSewaAmount(800000, d("2026-09-22"), d("2026-10-15"), 16);
    expect(r.totalDays).toBe(30);
    expect(r.occupiedDays).toBe(24);
    expect(r.isProrated).toBe(true);
    expect(r.amount).toBe(Math.round((800000 * 24) / 30));
  });
  it("masuk PERSIS tanggal anchor -> nggak diprorata, tarif penuh", () => {
    const r = calculateFirstPeriodSewaAmount(800000, d("2026-09-16"), d("2026-10-15"), 16);
    expect(r.isProrated).toBe(false);
    expect(r.amount).toBe(800000);
  });
  it("anchor 1, masuk tanggal 5 -> prorata dari tanggal 1 sampai akhir bulan", () => {
    const r = calculateFirstPeriodSewaAmount(1000000, d("2026-09-05"), d("2026-09-30"), 1);
    expect(r.totalDays).toBe(30);
    expect(r.occupiedDays).toBe(26);
    expect(r.isProrated).toBe(true);
  });
});
