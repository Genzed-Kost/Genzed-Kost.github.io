import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatTanggalWIB } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";

type ComplaintRow = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: "BARU" | "DIPROSES" | "SELESAI" | "DITOLAK";
  admin_response: string | null;
  created_at: string;
  tenant: { full_name: string; phone: string } | null;
};

const STATUS_OPTIONS = ["BARU", "DIPROSES", "SELESAI", "DITOLAK"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  perbaikan: "Perbaikan",
  kebersihan: "Kebersihan",
  keamanan: "Keamanan",
  data_diri: "Ubah Data Diri",
  lainnya: "Lainnya",
};

export default function AdminKomplain() {
  const [complaints, setComplaints] = useState<ComplaintRow[] | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error: fetchErr } = await supabase
      .from("complaints")
      .select("id, category, title, description, status, admin_response, created_at, tenant:profiles(full_name, phone)")
      .order("created_at", { ascending: false });
    if (fetchErr) {
      setError("Gagal memuat daftar komplain.");
      return;
    }
    setComplaints(data as unknown as ComplaintRow[]);
    const initial: Record<string, string> = {};
    for (const c of (data ?? []) as unknown as ComplaintRow[]) initial[c.id] = c.admin_response ?? "";
    setResponses(initial);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpdate(id: string, status: ComplaintRow["status"]) {
    setSaving(id);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from("complaints")
        .update({ status, admin_response: responses[id] || null, resolved_at: status === "SELESAI" ? new Date().toISOString() : null })
        .eq("id", id);
      if (updateErr) {
        setError("Gagal menyimpan balasan.");
        return;
      }
      await load();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Komplain Penghuni</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>Balas & update status laporan dari penghuni.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {complaints === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : complaints.length === 0 ? (
        <Card>
          <EmptyState icon="🛠️" text="Belum ada komplain." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {complaints.map((c) => (
            <Card key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{c.title}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                    {c.tenant?.full_name} · {CATEGORY_LABEL[c.category] ?? c.category} · {formatTanggalWIB(c.created_at)}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: ".85rem", color: "var(--muted)", marginBottom: 12 }}>{c.description}</p>

              <textarea
                placeholder="Balasan buat penghuni..."
                value={responses[c.id] ?? ""}
                onChange={(e) => setResponses((prev) => ({ ...prev, [c.id]: e.target.value }))}
                rows={2}
                style={{
                  width: "100%",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r)",
                  padding: "10px 12px",
                  fontSize: ".85rem",
                  color: "var(--text)",
                  resize: "vertical",
                  fontFamily: "inherit",
                  marginBottom: 10,
                }}
              />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    className="btn-link"
                    style={{ color: c.status === s ? "var(--accent)" : "var(--muted)", fontWeight: c.status === s ? 700 : 600 }}
                    disabled={saving === c.id}
                    onClick={() => handleUpdate(c.id, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
