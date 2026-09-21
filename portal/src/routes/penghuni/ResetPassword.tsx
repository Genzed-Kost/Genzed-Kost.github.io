import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password nggak cocok.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        setError("Link reset sudah kedaluwarsa atau nggak valid. Minta link baru ya.");
        return;
      }
      navigate("/penghuni/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Buat Password Baru">
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="newPassword">Password Baru</label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimal 8 karakter"
          />
        </div>
        <div className="field">
          <label htmlFor="confirmPassword">Konfirmasi Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : "Simpan Password"}
        </button>
      </form>
    </AuthLayout>
  );
}
