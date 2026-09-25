import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/Card";

export default function Profil() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (!profile) return null;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48, maxWidth: 520 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Profil</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>Data diri lo yang tercatat di sistem.</p>

      <Card>
        <div className="field">
          <label htmlFor="fullName">Nama Lengkap</label>
          <input id="fullName" value={profile.full_name} disabled style={{ opacity: 0.6 }} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" value={profile.email} disabled style={{ opacity: 0.6 }} />
        </div>
        <div className="field">
          <label htmlFor="phone">No HP</label>
          <input id="phone" value={profile.phone} disabled style={{ opacity: 0.6 }} />
        </div>

        <p style={{ fontSize: ".82rem", color: "var(--muted)", marginBottom: 14 }}>
          Data di atas nggak bisa diubah sendiri. Ada yang salah atau mau diganti? Ajukan lewat komplain, nanti admin yang proses.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "auto" }}
          onClick={() =>
            navigate("/penghuni/komplain", {
              state: { presetCategory: "data_diri", presetTitle: "Permintaan ubah data profil" },
            })
          }
        >
          Ajukan Perubahan Data →
        </button>
      </Card>
    </div>
  );
}
