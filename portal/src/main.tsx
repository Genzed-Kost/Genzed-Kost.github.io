import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (missingEnv) {
  // Belum ada VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (GitHub secret belum di-set,
  // atau Supabase project belum dibuat) — tampilkan pesan jelas alih-alih membiarkan
  // Supabase client melempar error mentah yang bikin layar putih/hitam kosong.
  root.render(
    <div style={{ display: "grid", placeItems: "center", minHeight: "100svh", padding: "40px 5vw", textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.4rem", marginBottom: 12 }}>
          Portal Belum Dikonfigurasi
        </h1>
        <p style={{ color: "#888880", fontSize: ".9rem" }}>
          Backend Supabase portal ini belum disambungkan. Kalau lo admin Genzed Kost, cek README bagian "Setup Supabase" dan
          "Setup GitHub Actions" — pastikan secret <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> sudah
          diisi di GitHub repo, lalu deploy ulang.
        </p>
      </div>
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
