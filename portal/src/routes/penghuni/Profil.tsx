import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { isPhoneID } from "../../lib/format";
import { Card } from "../../components/Card";

export default function Profil() {
  const { profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!fullName.trim()) {
      setError("Nama lengkap wajib diisi.");
      return;
    }
    if (!isPhoneID(phone)) {
      setError("Format No HP nggak valid.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq("id", profile!.id);
      if (updateErr) {
        setError(
          updateErr.message.includes("duplicate")
            ? "No HP itu udah dipakai akun lain."
            : "Gagal menyimpan perubahan. Coba lagi ya."
        );
        return;
      }
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48, maxWidth: 520 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Profil</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>Kelola data diri lo di sini.</p>

      <Card>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">Perubahan berhasil disimpan.</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="fullName">Nama Lengkap</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" value={profile.email} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="field">
            <label htmlFor="phone">No HP</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081234567890" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: "auto" }}>
            {saving ? <span className="spinner" /> : "Simpan Perubahan"}
          </button>
        </form>
      </Card>
    </div>
  );
}
