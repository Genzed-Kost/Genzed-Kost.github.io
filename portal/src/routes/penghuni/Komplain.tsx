import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { formatTanggalWIB } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";
import type { Complaint } from "../../types/database";

const KATEGORI = ["perbaikan", "kebersihan", "keamanan", "data_diri", "lainnya"] as const;
const KATEGORI_LABEL: Record<(typeof KATEGORI)[number], string> = {
  perbaikan: "Perbaikan",
  kebersihan: "Kebersihan",
  keamanan: "Keamanan",
  data_diri: "Ubah Data Diri",
  lainnya: "Lainnya",
};
const STATUS_LABEL: Record<Complaint["status"], string> = {
  BARU: "Baru",
  DIPROSES: "Diproses",
  SELESAI: "Selesai",
  DITOLAK: "Ditolak",
};
const STATUS_COLOR: Record<Complaint["status"], string> = {
  BARU: "var(--muted)",
  DIPROSES: "var(--warn)",
  SELESAI: "var(--accent)",
  DITOLAK: "var(--danger)",
};

export default function Komplain() {
  const { profile } = useAuth();
  const location = useLocation();
  const preset = location.state as { presetCategory?: (typeof KATEGORI)[number]; presetTitle?: string } | null;
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [category, setCategory] = useState<(typeof KATEGORI)[number]>(preset?.presetCategory ?? "perbaikan");
  const [title, setTitle] = useState(preset?.presetTitle ?? "");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadComplaints() {
    const { data, error: fetchErr } = await supabase
      .from("complaints")
      .select("id, category, title, description, status, admin_response, created_at")
      .order("created_at", { ascending: false });
    if (!fetchErr) setComplaints(data as Complaint[]);
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !description.trim()) {
      setError("Judul dan deskripsi wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from("complaints").insert({
        tenant_id: profile!.id,
        category,
        title: title.trim(),
        description: description.trim(),
      });
      if (insertErr) {
        setError("Gagal mengirim komplain. Coba lagi ya.");
        return;
      }
      setTitle("");
      setDescription("");
      await loadComplaints();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Komplain & Perbaikan</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>
        Ada yang rusak atau kurang nyaman? Laporin di sini, admin bakal segera follow up.
      </p>

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", marginBottom: 14 }}>Buat Laporan Baru</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="category">Kategori</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                padding: "12px 14px",
                fontSize: ".95rem",
                color: "var(--text)",
              }}
            >
              {KATEGORI.map((k) => (
                <option key={k} value={k}>
                  {KATEGORI_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="title">Judul</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: AC kamar 12 bocor" />
          </div>
          <div className="field">
            <label htmlFor="description">Deskripsi</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={category === "data_diri" ? "Contoh: tolong ubah nama jadi ..., atau nomor HP baru: 0812xxxxxxxx" : "Jelasin detail masalahnya..."}
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                padding: "12px 14px",
                fontSize: ".95rem",
                color: "var(--text)",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "auto" }}>
            {submitting ? <span className="spinner" /> : "Kirim Laporan"}
          </button>
        </form>
      </Card>

      <h3 style={{ fontSize: "1rem", marginBottom: 14 }}>Riwayat Laporan</h3>
      {complaints === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : complaints.length === 0 ? (
        <Card>
          <EmptyState icon="🛠️" text="Belum ada laporan komplain." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {complaints.map((c) => (
            <Card key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: ".92rem" }}>{c.title}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>{formatTanggalWIB(c.created_at)}</div>
                </div>
                <span style={{ fontSize: ".78rem", fontWeight: 700, color: STATUS_COLOR[c.status], whiteSpace: "nowrap" }}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
              <p style={{ fontSize: ".85rem", color: "var(--muted)" }}>{c.description}</p>
              {c.admin_response && (
                <div style={{ marginTop: 10, padding: 10, background: "var(--surface2)", borderRadius: 10, fontSize: ".82rem" }}>
                  <strong>Balasan admin:</strong> {c.admin_response}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
