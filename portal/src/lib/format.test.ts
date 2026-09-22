import { describe, expect, it } from "vitest";
import { formatRupiah, isEmail, isPhoneID } from "./format";

describe("formatRupiah", () => {
  // Intl.NumberFormat("id-ID", {style:"currency"}) menyisipkan NO-BREAK SPACE (U+00A0)
  // antara "Rp" dan angkanya — ini perilaku standar formatter, bukan bug.
  it("format angka jadi Rupiah tanpa desimal", () => {
    expect(formatRupiah(800000)).toBe("Rp 800.000");
    expect(formatRupiah(1000000)).toBe("Rp 1.000.000");
    expect(formatRupiah(0)).toBe("Rp 0");
  });
});

describe("isEmail", () => {
  it("menerima email valid", () => {
    expect(isEmail("budi@gmail.com")).toBe(true);
  });
  it("menolak string bukan email", () => {
    expect(isEmail("budi")).toBe(false);
    expect(isEmail("081234567890")).toBe(false);
  });
});

describe("isPhoneID", () => {
  it("menerima format 08xx dan 628xx", () => {
    expect(isPhoneID("081234567890")).toBe(true);
    expect(isPhoneID("6281234567890")).toBe(true);
  });
  it("menolak nomor bukan Indonesia atau email", () => {
    expect(isPhoneID("budi@gmail.com")).toBe(false);
    expect(isPhoneID("12345")).toBe(false);
  });
});
