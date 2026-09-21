import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah, formatTanggalWIB } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";

type PaymentRow = {
  id: string;
  payment_number: string;
  method: string;
  status: string;
  amount: number;
  admin_fee: number;
  created_at: string;
  paid_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  MENUNGGU: "Menunggu Pembayaran",
  MENUNGGU_VERIFIKASI: "Menunggu Verifikasi Admin",
  LUNAS: "Lunas",
  DITOLAK: "Ditolak",
  KEDALUWARSA: "Kedaluwarsa",
  DIBATALKAN: "Dibatalkan",
};

const STATUS_COLOR: Record<string, string> = {
  MENUNGGU: "var(--warn)",
  MENUNGGU_VERIFIKASI: "var(--warn)",
  LUNAS: "var(--accent)",
  DITOLAK: "var(--danger)",
  KEDALUWARSA: "var(--muted)",
  DIBATALKAN: "var(--muted)",
};

const METHOD_LABEL: Record<string, string> = {
  TRANSFER_MANUAL: "Transfer Bank Jago",
  QRIS_STATIS: "QRIS",
  VIRTUAL_ACCOUNT: "Virtual Account",
  QRIS_DINAMIS: "QRIS (Otomatis)",
  EWALLET: "E-Wallet",
  GERAI_RETAIL: "Gerai Retail",
  SALDO_DEPOSIT: "Saldo Deposit",
  VOUCHER: "Voucher",
};

export default function RiwayatBayar() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let mounted = true;

    supabase
      .from("payments")
      .select("id, payment_number, method, status, amount, admin_fee, created_at, paid_at")
      .eq("tenant_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchErr }) => {
        if (!mounted) return;
        if (fetchErr) {
          setError("Gagal memuat riwayat pembayaran.");
          return;
        }
        setPayments(data as PaymentRow[]);
      });

    return () => {
      mounted = false;
    };
  }, [profile]);

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 32 }}>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Riwayat Bayar</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>Semua transaksi pembayaran lo.</p>

      {payments === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState icon="💳" text="Belum ada riwayat pembayaran." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {payments.map((p) => (
            <Card key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{p.payment_number}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 2 }}>
                    {METHOD_LABEL[p.method] ?? p.method} · {formatTanggalWIB(p.paid_at ?? p.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{formatRupiah(Number(p.amount) + Number(p.admin_fee))}</div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: STATUS_COLOR[p.status] ?? "var(--muted)" }}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
