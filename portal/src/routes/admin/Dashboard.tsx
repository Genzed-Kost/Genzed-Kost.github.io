import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah } from "../../lib/format";
import { StatCard } from "../../components/Card";

type Stats = {
  pendingVerification: number;
  overdueInvoices: number;
  monthIncome: number;
  occupiedRooms: number;
  totalRooms: number;
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [pendingRes, overdueRes, paymentsRes, roomsRes] = await Promise.all([
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "MENUNGGU_VERIFIKASI"),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "JATUH_TEMPO"),
        supabase.from("payments").select("amount, admin_fee").eq("status", "LUNAS").gte("paid_at", monthStart.toISOString()),
        supabase.from("rooms").select("id, is_occupied"),
      ]);

      const monthIncome = (paymentsRes.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
      const totalRooms = roomsRes.data?.length ?? 0;
      const occupiedRooms = (roomsRes.data ?? []).filter((r) => r.is_occupied).length;

      setStats({
        pendingVerification: pendingRes.count ?? 0,
        overdueInvoices: overdueRes.count ?? 0,
        monthIncome,
        occupiedRooms,
        totalRooms,
      });
    }
    load();
  }, []);

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Dashboard Admin</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>Halo, {profile?.full_name}. Ini ringkasan kost hari ini.</p>

      {!stats ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
            <StatCard label="Pemasukan Bulan Ini" value={formatRupiah(stats.monthIncome)} />
            <StatCard label="Tingkat Hunian" value={`${stats.occupiedRooms}/${stats.totalRooms}`} hint="kamar terisi" />
            <StatCard label="Tunggakan Jatuh Tempo" value={stats.overdueInvoices} />
            <StatCard label="Menunggu Verifikasi" value={stats.pendingVerification} />
          </div>
          {stats.pendingVerification > 0 && (
            <Link
              to="/admin/verifikasi"
              className="btn btn-primary"
              style={{ width: "auto", display: "inline-flex" }}
            >
              ✅ Verifikasi {stats.pendingVerification} Pembayaran Sekarang
            </Link>
          )}
        </>
      )}
    </div>
  );
}
