import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatTanggalWIB } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";
import type { Profile } from "../../types/database";

const BUCKET = "tenant-documents";

type DocFile = {
  name: string;
  path: string;
  size: number;
  createdAt: string;
};

export default function AdminDokumen() {
  const [tenants, setTenants] = useState<Profile[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filesByTenant, setFilesByTenant] = useState<Record<string, DocFile[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error: fetchErr } = await supabase
        .from("profiles")
        .select("id, role, full_name, email, phone, is_active, created_at")
        .eq("role", "penghuni")
        .order("full_name", { ascending: true });
      if (fetchErr) {
        setError("Gagal memuat daftar penghuni.");
        return;
      }
      setTenants(data as Profile[]);
    }
    load();
  }, []);

  async function loadDocs(tenantId: string) {
    setLoadingId(tenantId);
    setError(null);
    try {
      const { data, error: listErr } = await supabase.storage.from(BUCKET).list(tenantId, {
        sortBy: { column: "created_at", order: "desc" },
      });
      if (listErr) {
        setError("Gagal memuat dokumen penghuni ini.");
        return;
      }
      setFilesByTenant((prev) => ({
        ...prev,
        [tenantId]: (data ?? [])
          .filter((f) => f.id)
          .map((f) => ({
            name: f.name,
            path: `${tenantId}/${f.name}`,
            size: f.metadata?.size ?? 0,
            createdAt: f.created_at ?? "",
          })),
      }));
    } finally {
      setLoadingId(null);
    }
  }

  function toggle(tenantId: string) {
    const next = openId === tenantId ? null : tenantId;
    setOpenId(next);
    if (next && !filesByTenant[next]) loadDocs(next);
  }

  async function handleView(path: string) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleDelete(tenantId: string, path: string) {
    if (!confirm("Hapus dokumen ini secara permanen?")) return;
    await supabase.storage.from(BUCKET).remove([path]);
    await loadDocs(tenantId);
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Dokumen Penghuni</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>
        Lihat dokumen pribadi (KTP, kontrak sewa, dll) yang diupload tiap penghuni.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {tenants === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : tenants.length === 0 ? (
        <Card>
          <EmptyState icon="🧑‍🎓" text="Belum ada penghuni." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tenants.map((t) => {
            const isOpen = openId === t.id;
            const docs = filesByTenant[t.id];
            return (
              <Card key={t.id}>
                <button
                  onClick={() => toggle(t.id)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{t.full_name}</div>
                    <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                      {t.email} · {t.phone}
                    </div>
                  </div>
                  <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>{isOpen ? "▲ Tutup" : "▼ Lihat dokumen"}</span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    {loadingId === t.id ? (
                      <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
                    ) : !docs || docs.length === 0 ? (
                      <EmptyState icon="📁" text="Belum ada dokumen yang diupload penghuni ini." />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {docs.map((f) => (
                          <div
                            key={f.path}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              padding: "10px 12px",
                              background: "var(--surface2)",
                              borderRadius: 10,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: ".85rem",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {f.name}
                              </div>
                              <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>
                                {(f.size / 1024).toFixed(1)} KB · {f.createdAt ? formatTanggalWIB(f.createdAt) : "-"}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                              <button className="btn-link" onClick={() => handleView(f.path)}>
                                Lihat
                              </button>
                              <button
                                className="btn-link"
                                style={{ color: "var(--danger)" }}
                                onClick={() => handleDelete(t.id, f.path)}
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
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
