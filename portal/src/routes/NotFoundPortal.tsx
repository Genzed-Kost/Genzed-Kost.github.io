import { Link } from "react-router-dom";

export default function NotFoundPortal() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100svh", textAlign: "center", padding: "40px 5vw" }}>
      <div>
        <h1 style={{ fontSize: "2rem", marginBottom: 10 }}>Halaman Nggak Ketemu</h1>
        <p style={{ color: "var(--muted)", marginBottom: 20 }}>Halaman yang lo cari nggak ada di portal ini.</p>
        <Link className="btn-link" to="/penghuni/login">← Ke halaman Login</Link>
      </div>
    </div>
  );
}
