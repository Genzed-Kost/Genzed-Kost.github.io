// Logika alokasi pembayaran & diskon voucher. Sama seperti billing.ts,
// file ini diduplikasi di supabase/functions/_shared/payment.ts untuk Edge Function.

export type PayableInvoice = {
  id: string;
  dueDate: string; // ISO date, dipakai buat urutan alokasi (paling lama jatuh tempo duluan)
  outstanding: number; // total - paid_total saat ini
};

export type Allocation = { invoiceId: string; amount: number };

export type AllocationResult = {
  allocations: Allocation[];
  totalAllocated: number;
  leftover: number; // sisa dana yang nggak habis teralokasi (jadi deposit baru)
};

// Alokasikan sejumlah dana ke daftar tagihan, urut dari jatuh tempo paling lama.
// Melebihi total tagihan yang dipilih? Sisanya dikembalikan sebagai `leftover` (jadi deposit).
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

// Validasi & hitung potongan voucher terhadap total transaksi (SEBELUM dikurangi deposit).
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

// Kode unik 3 digit (001-999) supaya admin gampang cocokin transfer manual.
export function generateUniqueCode(): number {
  return 1 + Math.floor(Math.random() * 999);
}
