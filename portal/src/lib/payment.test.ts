import { describe, expect, it } from "vitest";
import { allocatePayment, calculateAdminFee, checkAndCalculateVoucher } from "./payment";

describe("allocatePayment", () => {
  it("alokasikan ke 1 tagihan pas jumlahnya", () => {
    const r = allocatePayment(800000, [{ id: "a", dueDate: "2026-01-05", outstanding: 800000 }]);
    expect(r.allocations).toEqual([{ invoiceId: "a", amount: 800000 }]);
    expect(r.leftover).toBe(0);
  });

  it("alokasikan ke beberapa tagihan, urut dari jatuh tempo paling lama", () => {
    const r = allocatePayment(1200000, [
      { id: "newer", dueDate: "2026-03-01", outstanding: 800000 },
      { id: "older", dueDate: "2026-01-01", outstanding: 800000 },
    ]);
    expect(r.allocations).toEqual([
      { invoiceId: "older", amount: 800000 },
      { invoiceId: "newer", amount: 400000 },
    ]);
    expect(r.totalAllocated).toBe(1200000);
    expect(r.leftover).toBe(0);
  });

  it("bayar sebagian: alokasi nggak melebihi outstanding tagihan pertama", () => {
    const r = allocatePayment(300000, [{ id: "a", dueDate: "2026-01-01", outstanding: 800000 }]);
    expect(r.allocations).toEqual([{ invoiceId: "a", amount: 300000 }]);
    expect(r.leftover).toBe(0);
  });

  it("kelebihan bayar jadi leftover (buat deposit)", () => {
    const r = allocatePayment(1000000, [{ id: "a", dueDate: "2026-01-01", outstanding: 800000 }]);
    expect(r.allocations).toEqual([{ invoiceId: "a", amount: 800000 }]);
    expect(r.leftover).toBe(200000);
  });

  it("skip tagihan yang outstanding-nya sudah 0", () => {
    const r = allocatePayment(500000, [
      { id: "lunas", dueDate: "2026-01-01", outstanding: 0 },
      { id: "belum", dueDate: "2026-02-01", outstanding: 500000 },
    ]);
    expect(r.allocations).toEqual([{ invoiceId: "belum", amount: 500000 }]);
  });
});

describe("checkAndCalculateVoucher", () => {
  const baseVoucher = {
    voucherType: "NOMINAL" as const,
    value: 50000,
    maxDiscount: null,
    minTransaction: 100000,
    quota: 10,
    usedCount: 2,
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: "2026-12-31T23:59:59Z",
  };
  const now = new Date("2026-06-01T00:00:00Z");

  it("valid: potongan nominal", () => {
    const r = checkAndCalculateVoucher(baseVoucher, 800000, now);
    expect(r).toEqual({ valid: true, discount: 50000 });
  });

  it("valid: potongan persen dengan cap max_discount", () => {
    const r = checkAndCalculateVoucher(
      { ...baseVoucher, voucherType: "PERSEN", value: 20, maxDiscount: 100000 },
      1000000,
      now
    );
    expect(r).toEqual({ valid: true, discount: 100000 }); // 20% dari 1jt = 200rb, dicap 100rb
  });

  it("tidak valid: di bawah minimum transaksi", () => {
    const r = checkAndCalculateVoucher(baseVoucher, 50000, now);
    expect(r.valid).toBe(false);
  });

  it("tidak valid: sudah kedaluwarsa", () => {
    const r = checkAndCalculateVoucher(baseVoucher, 800000, new Date("2027-01-01T00:00:00Z"));
    expect(r.valid).toBe(false);
  });

  it("tidak valid: kuota habis", () => {
    const r = checkAndCalculateVoucher({ ...baseVoucher, quota: 2, usedCount: 2 }, 800000, now);
    expect(r.valid).toBe(false);
  });

  it("diskon tidak pernah melebihi total transaksi", () => {
    const r = checkAndCalculateVoucher({ ...baseVoucher, value: 999999 }, 100000, now);
    expect(r).toEqual({ valid: true, discount: 100000 });
  });
});

describe("calculateAdminFee", () => {
  it("nominal tetap", () => {
    expect(calculateAdminFee(800000, { type: "nominal", value: 4000 })).toBe(4000);
  });
  it("persen dari nominal", () => {
    expect(calculateAdminFee(1000000, { type: "percent", value: 2 })).toBe(20000);
  });
  it("0 kalau fee config tidak ada", () => {
    expect(calculateAdminFee(1000000, undefined)).toBe(0);
  });
});
