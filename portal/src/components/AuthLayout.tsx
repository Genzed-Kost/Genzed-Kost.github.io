import type { ReactNode } from "react";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100svh", padding: "40px 5vw" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 32, textDecoration: "none" }}>
          <img src="/logo.png" alt="" width={32} height={32} style={{ borderRadius: "50%" }} />
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.3rem" }}>
            Genz<span style={{ color: "var(--accent)" }}>ed</span>
          </span>
        </a>
        <h1 style={{ fontSize: "1.6rem", marginBottom: 6 }}>{title}</h1>
        {subtitle && <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 28 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
