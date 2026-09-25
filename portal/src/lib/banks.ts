export type BankRef = { code: string; name: string };

export const BANKS: BankRef[] = [
  { code: "BCA", name: "BCA" },
  { code: "BNI", name: "BNI" },
  { code: "BRI", name: "BRI" },
  { code: "MANDIRI", name: "Mandiri" },
  { code: "BSI", name: "BSI (Bank Syariah Indonesia)" },
  { code: "CIMB", name: "CIMB Niaga" },
  { code: "PERMATA", name: "Permata Bank" },
  { code: "JAGO", name: "Bank Jago" },
  { code: "DANAMON", name: "Danamon" },
  { code: "BTN", name: "BTN" },
  { code: "BJB", name: "BJB (Bank Banten)" },
  { code: "MUAMALAT", name: "Muamalat" },
  { code: "BNC", name: "BNC (Bank Neo Commerce)" },
  { code: "SEABANK", name: "Seabank" },
  { code: "OTHER", name: "Bank lainnya" },
];

export const EWALLET_PROVIDERS = ["GoPay", "OVO", "DANA", "ShopeePay"] as const;
