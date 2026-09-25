import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { Card } from "../../components/Card";

export default function Pengaturan() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [adminFeeBorneBy, setAdminFeeBorneBy] = useState<"tenant" | "pemilik">("tenant");
  const [minPartialPayment, setMinPartialPayment] = useState("50000");
  const [gatewayFeePercent, setGatewayFeePercent] = useState("2");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["payment_gateway_enabled", "admin_fee_borne_by", "min_partial_payment", "payment_method_fees"]);
      const map = new Map((data ?? []).map((r) => [r.key, r.value]));
      setGatewayEnabled(map.get("payment_gateway_enabled") === true);
      setAdminFeeBorneBy((map.get("admin_fee_borne_by") as "tenant" | "pemilik") ?? "tenant");
      setMinPartialPayment(String(map.get("min_partial_payment") ?? 50000));
      const fees = map.get("payment_method_fees") as { gateway?: { value: number } } | undefined;
      setGatewayFeePercent(String(fees?.gateway?.value ?? 2));
      setLoaded(true);
    }
    load();
  }, []);

  async function handleSave() {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const updates = [
        supabase.from("settings").update({ value: gatewayEnabled }).eq("key", "payment_gateway_enabled"),
        supabase.from("settings").update({ value: adminFeeBorneBy }).eq("key", "admin_fee_borne_by"),
        supabase.from("settings").update({ value: Number(minPartialPayment) }).eq("key", "min_partial_payment"),
        supabase
          .from("settings")
          .update({ value: { manual: { type: "nominal", value: 0 }, gateway: { type: "percent", value: Number(gatewayFeePercent) } } })
          .eq("key", "payment_method_fees"),
      ];
      const results = await Promise.all(updates);
      if (results.some((r) => r.error)) {
        setError("Sebagian pengaturan gagal disimpan.");
        return;
      }
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="container" style={{ paddingTop: 32 }}>
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48, maxWidth: 560 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Pengaturan Pembayaran</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>Rekening, biaya admin, dan jalur pembayaran otomatis.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">Pengaturan berhasil disimpan.</div>}

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: ".95rem", marginBottom: 8 }}>Rekening Transfer Manual</h3>
        <p style={{ fontSize: ".85rem", color: "var(--muted)", marginBottom: 12 }}>
          Sekarang bisa lebih dari satu rekening (bank, QRIS, e-wallet) — dikelola di halaman terpisah.
        </p>
        <Link to="/admin/rekening" className="btn-link">
          Kelola Rekening →
        </Link>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: ".95rem", marginBottom: 12 }}>Pembayaran Otomatis (Midtrans)</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={gatewayEnabled} onChange={(e) => setGatewayEnabled(e.target.checked)} />
          <span style={{ fontSize: ".85rem" }}>Aktifkan jalur otomatis (VA/E-wallet/QRIS/Retail)</span>
        </label>
        <p style={{ fontSize: ".78rem", color: "var(--warn)" }}>
          ⚠️ Pastikan MIDTRANS_SERVER_KEY sudah di-set di Supabase secrets dan sudah dites di Sandbox sebelum diaktifkan di production.
        </p>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: ".95rem", marginBottom: 12 }}>Biaya Admin</h3>
        <div className="field">
          <label>Siapa yang Menanggung Biaya Admin?</label>
          <select
            value={adminFeeBorneBy}
            onChange={(e) => setAdminFeeBorneBy(e.target.value as typeof adminFeeBorneBy)}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 14px", color: "var(--text)", width: "100%" }}
          >
            <option value="tenant">Penghuni</option>
            <option value="pemilik">Pemilik Kost</option>
          </select>
        </div>
        <div className="field">
          <label>Biaya Jalur Otomatis (% dari nominal)</label>
          <input type="number" step="0.1" value={gatewayFeePercent} onChange={(e) => setGatewayFeePercent(e.target.value)} />
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: ".95rem", marginBottom: 12 }}>Bayar Sebagian</h3>
        <div className="field">
          <label>Nominal Minimum (Rp)</label>
          <input type="number" value={minPartialPayment} onChange={(e) => setMinPartialPayment(e.target.value)} />
        </div>
      </Card>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: "auto" }}>
        {saving ? <span className="spinner" /> : "Simpan Pengaturan"}
      </button>
    </div>
  );
}
