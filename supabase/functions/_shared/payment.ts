// Logika alokasi pembayaran & diskon voucher.
// CATATAN: diduplikasi dari portal/src/lib/payment.ts (lihat catatan di billing.ts).

export type PayableInvoice = {
  id: string;
  dueDate: string;
  outstanding: number;
};

export type Allocation = { invoiceId: string; amount: number };

export type AllocationResult = {
  allocations: Allocation[];
  totalAllocated: number;
  leftover: number;
};

export function allocatePayment(amount: number, invoices: PayableInvoice[]): AllocationResult {
  const sorted = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  let remaining = Math.max(0, Math.round(amount));
  const allocations: Allocation[] = [];

  for (const inv of sorted) {
    if (remaining <= 0) break;
    const outstanding = Math.max(0, Math.round(inv.outstanding));
    if (outstanding <= 0) continue;
    const take = Math.min(remaining, outstanding);
    if (take > 0) {
      allocations.push({ invoiceId: inv.id, amount: take });
      remaining -= take;
    }
  }

  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  return { allocations, totalAllocated, leftover: remaining };
}

export type VoucherInput = {
  voucherType: "NOMINAL" | "PERSEN";
  value: number;
  maxDiscount: number | null;
  minTransaction: number;
  quota: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string;
};

export type VoucherCheckResult = { valid: true; discount: number } | { valid: false; reason: string };

export function checkAndCalculateVoucher(voucher: VoucherInput, transactionAmount: number, now: Date = new Date()): VoucherCheckResult {
  if (now < new Date(voucher.validFrom)) return { valid: false, reason: "Voucher belum berlaku." };
  if (now > new Date(voucher.validUntil)) return { valid: false, reason: "Voucher sudah kedaluwarsa." };
  if (voucher.quota != null && voucher.usedCount >= voucher.quota) return { valid: false, reason: "Kuota voucher sudah habis." };
  if (transactionAmount < voucher.minTransaction) {
    return { valid: false, reason: `Minimum transaksi untuk voucher ini Rp${voucher.minTransaction.toLocaleString("id-ID")}.` };
  }

  const rawDiscount = voucher.voucherType === "NOMINAL" ? voucher.value : (transactionAmount * voucher.value) / 100;
  const capped = voucher.maxDiscount != null ? Math.min(rawDiscount, voucher.maxDiscount) : rawDiscount;
  const discount = Math.min(Math.round(capped), transactionAmount);
  return { valid: true, discount };
}

export type FeeConfig = { type: "nominal" | "percent"; value: number };

export function calculateAdminFee(amountBeforeFee: number, fee: FeeConfig | undefined): number {
  if (!fee) return 0;
  if (fee.type === "nominal") return Math.round(fee.value);
  return Math.round((amountBeforeFee * fee.value) / 100);
}

export function generateUniqueCode(): number {
  return 1 + Math.floor(Math.random() * 999);
}
