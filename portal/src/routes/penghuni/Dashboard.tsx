import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah, formatTanggalWIB } from "../../lib/format";
import { sisaKontrakLabel } from "../../lib/date";
import { Card, EmptyState, StatCard } from "../../components/Card";
import type { Invoice, NotificationRow, Tenancy } from "../../types/database";

type DashboardData = {
  tenancy: Tenancy | null;
  activeInvoices: Invoice[];
  depositTotal: number;
  voucherCount: number;
  reminders: NotificationRow[];
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let mounted = true;

    async function load() {
      try {
        const [tenancyRes, invoicesRes, depositsRes, vouchersRes, notifRes] = await Promise.all([
          supabase
            .from("tenancies")
            .select("*, room:rooms(*, room_type:room_types(*))")
            .eq("tenant_id", profile!.id)
            .eq("status", "AKTIF")
            .order("start_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("invoices")
            .select("id, invoice_number, due_date, status, total, paid_total")
            .eq("tenant_id", profile!.id)
            .in("status", ["TERBIT", "SEBAGIAN_DIBAYAR", "JATUH_TEMPO"])
            .order("due_date", { ascending: true }),
          supabase.from("deposits").select("remaining_amount").eq("tenant_id", profile!.id),
          supabase
            .from("vouchers")
            .select("id, quota, used_count")
            .eq("is_active", true)
            .lte("valid_from", new Date().toISOString())
            .gte("valid_until", new Date().toISOString()),
          supabase
            .from("notifications")
            .select("id, category, title, body, is_read, created_at")
            .eq("tenant_id", profile!.id)
            .eq("category", "jatuh_tempo")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (!mounted) return;

        const firstErr =
          tenancyRes.error || invoicesRes.error || depositsRes.error || vouchersRes.error || notifRes.error;
        if (firstErr) {
          setError("Gagal memuat data dashboard. Coba refresh halaman ya.");
          return;
        }

        const depositTotal = (depositsRes.data ?? []).reduce((sum, d) => sum + Number(d.remaining_amount), 0);
        const voucherCount = (vouchersRes.data ?? []).filter((v) => v.quota == null || v.used_count < v.quota).length;

        setData({
          tenancy: tenancyRes.data as unknown as Tenancy | null,
          activeInvoices: (invoicesRes.data ?? []) as Invoice[],
          depositTotal,
          voucherCount,
          reminders: (notifRes.data ?? []) as NotificationRow[],
        });
      } catch {
        if (mounted) setError("Terjadi kesalahan saat memuat dashboard.");
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [profile]);

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container" style={{ paddingTop: 40, display: "grid", placeItems: "center" }}>
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      </div>
    );
  }

  const { tenancy, activeInvoices, depositTotal, voucherCount, reminders } = data;
  const totalTagihanAktif = activeInvoices.reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.paid_total)), 0);
  const jatuhTempoTerdekat = activeInvoices[0]?.due_date ?? null;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Halo, {profile?.full_name} 👋</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 28 }}>
        Ini ringkasan kost lo hari ini.
      </p>

      {/* Info Kamar */}
      <Card style={{ marginBottom: 24 }}>
        {tenancy ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: ".75rem", color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>
                KAMAR {tenancy.room.room_number}
              </div>
              <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.2rem" }}>
                {tenancy.room.room_type.name}
              </div>
              <div style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: 4 }}>
                Masuk sejak {formatTanggalWIB(tenancy.start_date).split(" ").slice(0, 4).join(" ")}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: ".75rem", color: "var(--muted)", marginBottom: 4 }}>Sisa Kontrak</div>
              <div style={{ fontWeight: 700 }}>{sisaKontrakLabel(tenancy.end_date)}</div>
            </div>
          </div>
        ) : (
          <EmptyState icon="🛏️" text="Belum ada data kamar aktif. Hubungi admin kost kalau ini nggak seharusnya kosong." />
        )}
      </Card>

      {/* Ringkasan */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Tagihan Aktif"
          value={formatRupiah(totalTagihanAktif)}
          hint={`${activeInvoices.length} tagihan belum lunas`}
        />
        <StatCard
          label="Jatuh Tempo Terdekat"
          value={jatuhTempoTerdekat ? formatTanggalWIB(jatuhTempoTerdekat).split(",")[0] : "—"}
          hint={jatuhTempoTerdekat ? undefined : "Nggak ada tagihan aktif"}
        />
        <StatCard label="Saldo Deposit" value={formatRupiah(depositTotal)} />
        <StatCard label="Voucher Tersedia" value={voucherCount} hint="Bisa dipakai saat bayar" />
      </div>

      {/* Pengingat Jatuh Tempo */}
      <Card>
        <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Pengingat Jatuh Tempo</h3>
        {reminders.length === 0 ? (
          <EmptyState icon="🔔" text="Belum ada pengingat. Kami bakal kirim H-7, H-3, H-1, dan hari-H sebelum tagihan jatuh tempo." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reminders.map((r) => (
              <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{r.title}</div>
                <div style={{ color: "var(--muted)", fontSize: ".82rem", marginTop: 2 }}>{r.body}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
