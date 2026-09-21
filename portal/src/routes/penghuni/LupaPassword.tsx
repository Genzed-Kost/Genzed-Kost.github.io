import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { supabase, functionsUrl } from "../../lib/supabaseClient";
import { isEmail } from "../../lib/format";

export default function LupaPassword() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier) {
      setError("Isi email atau No HP dulu.");
      return;
    }
    setLoading(true);
    try {
      let email = identifier;
      if (!isEmail(identifier)) {
        const res = await fetch(functionsUrl("resolve-identifier"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier }),
        });
        const data = await res.json();
        email = data.email;
      }

      if (email) {
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/penghuni/reset-password`,
        });
      }
      // Selalu tampilkan pesan sukses yang sama, supaya tidak bocorin akun mana yang terdaftar.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Cek Email Lo">
        <div className="alert alert-success">
          Kalau akun dengan email/No HP itu terdaftar, kami udah kirim link reset password ke emailnya. Cek inbox (atau folder spam) ya.
        </div>
        <Link className="btn-link" to="/penghuni/login">← Kembali ke Login</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Lupa Password" subtitle="Masukkan email atau No HP akun lo, kami kirim link reset ke email.">
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="identifier">Email atau No HP</label>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="budi@email.com / 081234567890"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : "Kirim Link Reset"}
        </button>
      </form>
      <p style={{ marginTop: 20 }}>
        <Link className="btn-link" to="/penghuni/login">← Kembali ke Login</Link>
      </p>
    </AuthLayout>
  );
}
