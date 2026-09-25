import { supabase } from "../lib/supabaseClient";
import type { PaymentAccount } from "../types/database";

export function PaymentAccountInfo({ account }: { account: PaymentAccount | null | undefined }) {
  if (!account) {
    return (
      <p style={{ fontSize: ".85rem", color: "var(--muted)" }}>Info rekening belum tersedia. Hubungi admin kost buat instruksi transfer.</p>
    );
  }

  if (account.account_type === "QRIS") {
    const url = account.qris_image_path ? supabase.storage.from("payment-account-qris").getPublicUrl(account.qris_image_path).data.publicUrl : null;
    return (
      <div style={{ textAlign: "center" }}>
        {url && <img src={url} alt="QRIS" style={{ width: 180, height: 180, objectFit: "contain", margin: "0 auto", borderRadius: 10, border: "1px solid var(--border)" }} />}
        {account.instructions && <p style={{ fontSize: ".8rem", color: "var(--muted)", marginTop: 8 }}>{account.instructions}</p>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: ".85rem", marginBottom: 4 }}>
        <strong>{account.account_type === "EWALLET" ? account.ewallet_provider : account.bank_name}</strong>
      </div>
      <div style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 4 }}>{account.account_number}</div>
      {account.account_holder && <div style={{ fontSize: ".8rem", color: "var(--muted)" }}>a.n {account.account_holder}</div>}
      {account.instructions && <div style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 6 }}>{account.instructions}</div>}
    </div>
  );
}
