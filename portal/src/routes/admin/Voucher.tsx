import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah, formatTanggalWIB } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";
import type { Voucher as VoucherType } from "../../types/database";

export default function Voucher() {
  const [vouchers, setVouchers] = useState<VoucherType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [type, setType] = useState<"NOMINAL" | "PERSEN">("NOMINAL");
  const [value, setValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minTransaction, setMinTransaction] = useState("0");
  const [quota, setQuota] = useState("");
  const [validUntil, setValidUntil] = useState("");

  async function load() {
    const { data, error: fetchErr } = await supabase.from("vouchers").select("*").order("created_at", { ascending: false });
    if (fetchErr) {
      setError("Gagal memuat daftar voucher.");
      return;
    }
    setVouchers(data as VoucherType[]);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setCode("");
    setType("NOMINAL");
    setValue("");
    setMaxDiscount("");
    setMinTransaction("0");
    setQuota("");
    setValidUntil("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(v: VoucherType) {
    setEditingId(v.id);
    setCode(v.code);
    setType(v.voucher_type);
    setValue(String(v.value));
    setMaxDiscount(v.max_discount != null ? String(v.max_discount) : "");
    setMinTransaction(String(v.min_transaction));
    setQuota(v.quota != null ? String(v.quota) : "");
    setValidUntil(v.valid_until.slice(0, 10));
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim() || !value || !validUntil) {
      setError("Kode, nilai, dan masa berlaku wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        voucher_type: type,
        value: Number(value),
        max_discount: maxDiscount ? Number(maxDiscount) : null,
        min_transaction: Number(minTransaction || 0),
        quota: quota ? Number(quota) : null,
        valid_until: new Date(validUntil).toISOString(),
      };
      const { error: writeErr } = editingId
        ? await supabase.from("vouchers").update(payload).eq("id", editingId)
        : await supabase.from("vouchers").insert(payload);
      if (writeErr) {
        setError(`Gagal ${editingId ? "menyimpan perubahan" : "membuat voucher"}: ${writeErr.message}`);
        return;
      }
      resetForm();
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(v: VoucherType) {
    await supabase.from("vouchers").update({ is_active: !v.is_active }).eq("id", v.id);
    await load();
  }

  async function handleDelete(v: VoucherType) {
    if (!confirm(`Hapus voucher ${v.code} secara permanen? Riwayat pemakaiannya juga ikut terhapus.`)) return;
    setDeletingId(v.id);
    setError(null);
    try {
      const { error: deleteErr } = await supabase.from("vouchers").delete().eq("id", v.id);
      if (deleteErr) {
        setError("Gagal menghapus voucher: " + deleteErr.message);
        return;
      }
      if (editingId === v.id) resetForm();
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: "1.5rem" }}>Voucher & Diskon</h1>
        <button
          className="btn btn-primary"
          style={{ width: "auto" }}
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
        >
          {showForm ? "Batal" : "+ Voucher Baru"}
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>Kelola kode promo buat penghuni.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: ".95rem", marginBottom: 14 }}>{editingId ? `Edit Voucher — ${code}` : "Voucher Baru"}</h3>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="code">Kode Voucher</label>
              <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="mis. HEMAT50" />
            </div>
            <div className="field">
              <label htmlFor="type">Tipe</label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 14px", color: "var(--text)", width: "100%" }}
              >
                <option value="NOMINAL">Nominal (Rp)</option>
                <option value="PERSEN">Persen (%)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="value">Nilai {type === "PERSEN" ? "(%)" : "(Rp)"}</label>
              <input id="value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            {type === "PERSEN" && (
              <div className="field">
                <label htmlFor="maxDiscount">Maksimal Potongan (Rp, opsional)</label>
                <input id="maxDiscount" type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor="minTransaction">Minimum Transaksi (Rp)</label>
              <input id="minTransaction" type="number" value={minTransaction} onChange={(e) => setMinTransaction(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="quota">Kuota Pemakaian (opsional, kosongkan = tak terbatas)</label>
              <input id="quota" type="number" value={quota} onChange={(e) => setQuota(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="validUntil">Berlaku Sampai</label>
              <input id="validUntil" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "auto" }}>
              {submitting ? <span className="spinner" /> : editingId ? "Simpan Perubahan" : "Buat Voucher"}
            </button>
          </form>
        </Card>
      )}

      {vouchers === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : vouchers.length === 0 ? (
        <Card>
          <EmptyState icon="🎟️" text="Belum ada voucher." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {vouchers.map((v) => (
            <Card key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{v.code}</div>
                <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                  {v.voucher_type === "NOMINAL" ? formatRupiah(v.value) : `${v.value}%`} · dipakai {v.used_count}
                  {v.quota ? `/${v.quota}` : ""} · sampai {formatTanggalWIB(v.valid_until).split(",")[0]}
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn-link" onClick={() => startEdit(v)}>
                  Edit
                </button>
                <button className="btn-link" style={{ color: v.is_active ? "var(--danger)" : "var(--accent)" }} onClick={() => toggleActive(v)}>
                  {v.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button
                  className="btn-link"
                  style={{ color: "var(--danger)" }}
                  disabled={deletingId === v.id}
                  onClick={() => handleDelete(v)}
                >
                  {deletingId === v.id ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
