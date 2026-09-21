import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah, formatTanggalWIB } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";
import type { InvoiceDetail, InvoiceStatus } from "../../types/database";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draf",
  TERBIT: "Belum Dibayar",
  SEBAGIAN_DIBAYAR: "Dibayar Sebagian",
  LUNAS: "Lunas",
  JATUH_TEMPO: "Jatuh Tempo",
  DIBATALKAN: "Dibatalkan",
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: "var(--muted)",
  TERBIT: "var(--text)",
  SEBAGIAN_DIBAYAR: "var(--warn)",
  LUNAS: "var(--accent)",
  JATUH_TEMPO: "var(--danger)",
  DIBATALKAN: "var(--muted)",
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  SEWA_KAMAR: "Sewa Kamar",
  LAUNDRY: "Laundry",
  PARKIR_TAMBAHAN: "Parkir Tambahan",
  TAMU_MENGINAP: "Tamu Menginap",
  PERBAIKAN: "Perbaikan",
  DENDA: "Denda Keterlambatan",
  DISKON: "Diskon",
  LAINNYA: "Lainnya",
};

export default function Tagihan() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let mounted = true;

    async function load() {
      const { data, error: fetchErr } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, period_start, period_end, due_date, status, subtotal, discount_total, penalty_total, total, paid_total, notes, invoice_items(id, item_type, description, quantity, unit_price, amount)"
        )
        .eq("tenant_id", profile!.id)
        .order("due_date", { ascending: false });

      if (!mounted) return;
      if (fetchErr) {
        setError("Gagal memuat daftar tagihan. Coba refresh halaman ya.");
        return;
      }
      setInvoices(
        ((data ?? []) as unknown as Array<InvoiceDetail & { invoice_items: InvoiceDetail["items"] }>).map(
          ({ invoice_items, ...inv }) => ({ ...inv, items: invoice_items ?? [] })
        )
      );
    }

    load();
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Tagihan</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>
        Daftar tagihan kost lo, dari yang terbaru.
      </p>

      {invoices === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : invoices.length === 0 ? (
        <Card>
          <EmptyState icon="🧾" text="Belum ada tagihan. Tagihan diterbitkan otomatis tiap periode sewa." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {invoices.map((inv) => {
            const sisa = Number(inv.total) - Number(inv.paid_total);
            const isExpanded = expandedId === inv.id;
            return (
              <Card key={inv.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                  style={{
                    background: "none",
                    border: "none",
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "inherit",
                    padding: 0,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: ".92rem", marginBottom: 3 }}>{inv.invoice_number}</div>
                      <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                        Periode {inv.period_start} s/d {inv.period_end} · Jatuh tempo {formatTanggalWIB(inv.due_date).split(",")[0]}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.05rem" }}>
                        {formatRupiah(sisa > 0 ? sisa : Number(inv.total))}
                      </div>
                      <div style={{ fontSize: ".78rem", fontWeight: 700, color: STATUS_COLOR[inv.status] }}>
                        {STATUS_LABEL[inv.status]}
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    {inv.items.map((item) => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: "6px 0" }}>
                        <span style={{ color: "var(--muted)" }}>
                          {ITEM_TYPE_LABEL[item.item_type] ?? item.item_type} — {item.description}
                        </span>
                        <span style={{ whiteSpace: "nowrap", marginLeft: 12 }}>{formatRupiah(item.amount)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: "3px 0" }}>
                        <span style={{ color: "var(--muted)" }}>Subtotal</span>
                        <span>{formatRupiah(inv.subtotal)}</span>
                      </div>
                      {inv.discount_total > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: "3px 0", color: "var(--accent)" }}>
                          <span>Diskon</span>
                          <span>-{formatRupiah(inv.discount_total)}</span>
                        </div>
                      )}
                      {inv.penalty_total > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: "3px 0", color: "var(--danger)" }}>
                          <span>Denda</span>
                          <span>+{formatRupiah(inv.penalty_total)}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem", fontWeight: 700, padding: "6px 0" }}>
                        <span>Total Tagihan</span>
                        <span>{formatRupiah(inv.total)}</span>
                      </div>
                      {inv.paid_total > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: "3px 0", color: "var(--muted)" }}>
                          <span>Sudah dibayar</span>
                          <span>-{formatRupiah(inv.paid_total)}</span>
                        </div>
                      )}
                    </div>
                    {sisa > 0 && (
                      <button
                        className="btn btn-primary"
                        style={{ width: "auto", marginTop: 14 }}
                        onClick={() => navigate("/penghuni/bayar", { state: { preselectInvoiceId: inv.id } })}
                      >
                        💸 Bayar Sekarang
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
