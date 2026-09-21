// Logika inti perhitungan tagihan: prorata, siklus billing, dan denda keterlambatan.
// CATATAN: file ini sengaja diduplikasi dari portal/src/lib/billing.ts
// karena Edge Function (Deno) dan portal (Vite/browser) adalah dua runtime terpisah
// tanpa tooling monorepo. Kalau ubah logika di sini, ubah juga di sana.

export type BillingCycle = "BULANAN" | "TRIWULAN" | "SEMESTER" | "TAHUNAN";
export type PenaltyCalcType = "NOMINAL_PER_HARI" | "PERSEN_PER_HARI";

const CYCLE_MONTHS: Record<BillingCycle, number> = {
  BULANAN: 1,
  TRIWULAN: 3,
  SEMESTER: 6,
  TAHUNAN: 12,
};

export function cycleMonths(cycle: BillingCycle): number {
  return CYCLE_MONTHS[cycle];
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

export function computePeriodEnd(periodStart: Date, cycle: BillingCycle): Date {
  const nextStart = addMonthsClamped(periodStart, CYCLE_MONTHS[cycle]);
  return new Date(nextStart.getTime() - 24 * 60 * 60 * 1000);
}

function toUTCDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function inclusiveDayCount(a: Date, b: Date): number {
  const diff = Math.round((toUTCDateOnly(b).getTime() - toUTCDateOnly(a).getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(0, diff);
}

export function overlapDays(
  periodStart: Date,
  periodEnd: Date,
  tenancyStart: Date,
  tenancyEnd: Date | null
): number {
  const start = tenancyStart > periodStart ? tenancyStart : periodStart;
  const end = tenancyEnd && tenancyEnd < periodEnd ? tenancyEnd : periodEnd;
  return inclusiveDayCount(start, end);
}

export function calculateSewaAmount(
  rate: number,
  periodStart: Date,
  periodEnd: Date,
  tenancyStart: Date,
  tenancyEnd: Date | null
): { amount: number; isProrated: boolean; occupiedDays: number; totalDays: number } {
  const totalDays = inclusiveDayCount(periodStart, periodEnd);
  const occupiedDays = overlapDays(periodStart, periodEnd, tenancyStart, tenancyEnd);

  if (occupiedDays >= totalDays) {
    return { amount: Math.round(rate), isProrated: false, occupiedDays, totalDays };
  }
  const amount = Math.round((rate * occupiedDays) / totalDays);
  return { amount, isProrated: true, occupiedDays, totalDays };
}

export function calculatePenalty(params: {
  outstandingAmount: number;
  calcType: PenaltyCalcType;
  value: number;
  gracePeriodDays: number;
  maxAmount: number | null;
  daysLate: number;
}): number {
  const { outstandingAmount, calcType, value, gracePeriodDays, maxAmount, daysLate } = params;
  const effectiveDaysLate = daysLate - gracePeriodDays;
  if (effectiveDaysLate <= 0) return 0;

  const raw =
    calcType === "NOMINAL_PER_HARI"
      ? value * effectiveDaysLate
      : (outstandingAmount * value) / 100 * effectiveDaysLate;

  const capped = maxAmount != null ? Math.min(raw, maxAmount) : raw;
  return Math.round(Math.max(0, capped));
}

export function formatInvoiceNumber(date: Date, sequence: number): string {
  const yyyymm = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return `INV-${yyyymm}-${String(sequence).padStart(4, "0")}`;
}
