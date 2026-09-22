import { useEffect, useState, type FormEvent } from "react";
import { supabase, functionsUrl } from "../../lib/supabaseClient";
import { isEmail, isPhoneID } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";
import type { Profile } from "../../types/database";

export default function Penghuni() {
  const [list, setList] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const { data, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, role, full_name, email, phone, is_active, created_at")
      .eq("role", "penghuni")
      .order("created_at", { ascending: false });
    if (fetchErr) {
      setError("Gagal memuat daftar penghuni.");
      return;
    }
    setList(data as Profile[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fullName.trim() || !isEmail(email) || !isPhoneID(phone)) {
      setError("Isi nama, email valid, dan No HP yang valid.");
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(functionsUrl("create-invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat undangan.");
        return;
      }
      setSuccess(`Undangan terkirim ke ${fullName} via WhatsApp!`);
      setFullName("");
      setEmail("");
      setPhone("");
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(profile: Profile) {
    const confirmed = confirm(
      `Hapus akun ${profile.full_name} secara PERMANEN?\n\n` +
        `⚠️ Ini juga menghapus SELURUH riwayat tagihan, pembayaran, kontrak, dan dokumennya — nggak bisa dibatalkan. ` +
        `Kalau cuma mau kontrak sewanya berakhir (penghuni pindah), pakai "Akhiri" di menu Kontrak, jangan hapus akunnya.`
    );
    if (!confirmed) return;

    setDeletingId(profile.id);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(functionsUrl("delete-tenant"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ profile_id: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menghapus penghuni.");
        return;
      }
      setSuccess(`Akun ${profile.full_name} berhasil dihapus.`);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: "1.5rem" }}>Kelola Penghuni</h1>
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Batal" : "+ Undang Penghuni Baru"}
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>
        Penghuni cuma bisa aktivasi akun lewat undangan dari sini.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <form onSubmit={handleInvite}>
            <div className="field">
              <label htmlFor="fullName">Nama Lengkap</label>
              <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="phone">No HP (buat kirim undangan via WA)</label>
              <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081234567890" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "auto" }}>
              {submitting ? <span className="spinner" /> : "Kirim Undangan"}
            </button>
          </form>
        </Card>
      )}

      {list === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon="🧑‍🎓" text="Belum ada penghuni." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((p) => (
            <Card key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{p.full_name}</div>
                <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                  {p.email} · {p.phone}
                </div>
              </div>
              <button
                className="btn-link"
                style={{ color: "var(--danger)" }}
                disabled={deletingId === p.id}
                onClick={() => handleDelete(p)}
              >
                {deletingId === p.id ? "Menghapus..." : "🗑️ Hapus Penghuni"}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
