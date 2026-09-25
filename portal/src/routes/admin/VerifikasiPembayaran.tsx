import { useEffect, useState } from "react";
import { supabase, functionsUrl } from "../../lib/supabaseClient";
import { formatRupiah, formatTanggalWIB } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";
import type { PaymentForReview } from "../../types/database";

export default function VerifikasiPembayaran() {
  const [payments, setPayments] = useState<PaymentForReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  async function load() {
    const { data, error: fetchErr } = await supabase
      .from("payments")
      .select(
        "id, payment_number, method, amount, admin_fee, unique_code, deposit_used, voucher_discount, status, created_at, tenant:profiles!payments_tenant_id_fkey(full_name, phone), payment_proofs(id, file_path, uploaded_at, payment_account:payment_accounts(account_type, bank_name, account_number, ewallet_provider))"
      )
      .eq("status", "MENUNGGU_VERIFIKASI")
      .order("created_at", { ascending: true });

    if (fetchErr) {
      setError("Gagal memuat daftar verifikasi.");
      return;
    }
    const rows = (data ?? []) as unknown as PaymentForReview[];
    setPayments(rows);

    const urls: Record<string, string> = {};
    for (const p of rows) {
      const proof = p.payment_proofs[p.payment_proofs.length - 1];
      if (proof) {
        const { data: signed } = await supabase.storage.from("payment-proofs").createSignedUrl(proof.file_path, 3600);
        if (signed) urls[p.id] = signed.signedUrl;
      }
    }
    setProofUrls(urls);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecision(paymentId: string, decision: "APPROVE" | "REJECT") {
    setError(null);
    if (decision === "REJECT" && !rejectReason[paymentId]?.trim()) {
      setError("Isi alasan penolakan dulu ya.");
      return;
    }
    setProcessingId(paymentId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(functionsUrl("review-payment"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ payment_id: paymentId, decision, reason: rejectReason[paymentId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memproses verifikasi.");
        return;
      }
      await load();
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Verifikasi Pembayaran</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>
        Cocokkan nominal transfer (termasuk kode unik) dengan bukti yang diupload.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {payments === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState icon="✅" text="Nggak ada pembayaran yang perlu diverifikasi." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {payments.map((p) => {
            const grossTransfer = Number(p.amount) - Number(p.deposit_used) - Number(p.voucher_discount) + Number(p.admin_fee) + Number(p.unique_code ?? 0);
            return (
              <Card key={p.id}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "space-between" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 700, fontSize: ".92rem", marginBottom: 4 }}>{p.payment_number}</div>
                    <div style={{ fontSize: ".82rem", color: "var(--muted)", marginBottom: 2 }}>
                      {p.tenant?.full_name} · {p.tenant?.phone}
                    </div>
                    <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>Diajukan {formatTanggalWIB(p.created_at)}</div>
                    <div style={{ marginTop: 10, fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.2rem" }}>
                      {formatRupiah(grossTransfer)}
                    </div>
                    <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                      Kode unik: {p.unique_code ?? "-"} · Metode: {p.method}
                    </div>
                    {(() => {
                      const acc = p.payment_proofs[p.payment_proofs.length - 1]?.payment_account;
                      if (!acc) return null;
                      const label = acc.account_type === "EWALLET" ? acc.ewallet_provider : acc.account_type === "QRIS" ? "QRIS" : acc.bank_name;
                      return (
                        <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                          Transfer ke: {label} {acc.account_number ? `· ${acc.account_number}` : ""}
                        </div>
                      );
                    })()}
                  </div>

                  {proofUrls[p.id] && (
                    <a href={proofUrls[p.id]} target="_blank" rel="noopener noreferrer">
                      <img
                        src={proofUrls[p.id]}
                        alt="Bukti transfer"
                        style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }}
                      />
                    </a>
                  )}
                </div>

                <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    className="btn btn-primary"
                    style={{ width: "auto" }}
                    disabled={processingId === p.id}
                    onClick={() => handleDecision(p.id, "APPROVE")}
                  >
                    {processingId === p.id ? <span className="spinner" /> : "✅ Setujui"}
                  </button>
                  <input
                    placeholder="Alasan tolak (kalau ditolak)"
                    value={rejectReason[p.id] ?? ""}
                    onChange={(e) => setRejectReason((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    style={{ flex: 1, minWidth: 180 }}
                  />
                  <button
                    className="btn-link"
                    style={{ color: "var(--danger)" }}
                    disabled={processingId === p.id}
                    onClick={() => handleDecision(p.id, "REJECT")}
                  >
                    Tolak
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
