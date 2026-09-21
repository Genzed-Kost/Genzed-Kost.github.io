import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";
import type { TenancyWithTenant } from "../../types/database";

type SimpleProfile = { id: string; full_name: string };
type SimpleRoom = { id: string; room_number: string; is_occupied: boolean; room_type_id: string; room_types: { name: string; base_price: number } };

const CYCLES = ["BULANAN", "TRIWULAN", "SEMESTER", "TAHUNAN"] as const;

export default function Kontrak() {
  const [tenancies, setTenancies] = useState<TenancyWithTenant[] | null>(null);
  const [penghuniOptions, setPenghuniOptions] = useState<SimpleProfile[]>([]);
  const [roomOptions, setRoomOptions] = useState<SimpleRoom[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]>("BULANAN");
  const [rate, setRate] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [tenRes, profRes, roomRes] = await Promise.all([
      supabase
        .from("tenancies")
        .select("*, room:rooms(*, room_type:room_types(*)), tenant:profiles(id, full_name, phone)")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name").eq("role", "penghuni").eq("is_active", true).order("full_name"),
      supabase.from("rooms").select("id, room_number, is_occupied, room_type_id, room_types(name, base_price)").order("room_number"),
    ]);
    if (tenRes.error) {
      setError("Gagal memuat daftar kontrak.");
      return;
    }
    setTenancies(tenRes.data as unknown as TenancyWithTenant[]);
    setPenghuniOptions((profRes.data ?? []) as SimpleProfile[]);
    setRoomOptions((roomRes.data ?? []) as unknown as SimpleRoom[]);
  }

  useEffect(() => {
    load();
  }, []);

  function handleRoomChange(id: string) {
    setRoomId(id);
    const room = roomOptions.find((r) => r.id === id);
    if (room) setRate(String(room.room_types.base_price));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tenantId || !roomId || !rate || !startDate) {
      setError("Semua field wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from("tenancies").insert({
        tenant_id: tenantId,
        room_id: roomId,
        billing_cycle: cycle,
        monthly_rate: Number(rate),
        start_date: startDate,
        status: "AKTIF",
      });
      if (insertErr) {
        setError("Gagal membuat kontrak: " + insertErr.message);
        return;
      }
      await supabase.from("rooms").update({ is_occupied: true }).eq("id", roomId);
      setShowForm(false);
      setTenantId("");
      setRoomId("");
      setRate("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnd(tenancy: TenancyWithTenant) {
    if (!confirm(`Akhiri kontrak ${tenancy.tenant.full_name} di kamar ${tenancy.room.room_number}?`)) return;
    await supabase
      .from("tenancies")
      .update({ status: "BERAKHIR", end_date: new Date().toISOString().slice(0, 10) })
      .eq("id", tenancy.id);
    await supabase.from("rooms").update({ is_occupied: false }).eq("id", tenancy.room_id);
    await load();
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: "1.5rem" }}>Kelola Kontrak</h1>
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Batal" : "+ Kontrak Baru"}
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>Tetapkan penghuni ke kamar & atur tarif sewa.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="tenant">Penghuni</label>
              <select id="tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={selectStyle}>
                <option value="">— Pilih penghuni —</option>
                {penghuniOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="room">Kamar</label>
              <select id="room" value={roomId} onChange={(e) => handleRoomChange(e.target.value)} style={selectStyle}>
                <option value="">— Pilih kamar —</option>
                {roomOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} — {r.room_types.name} {r.is_occupied ? "(terisi)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cycle">Siklus Bayar</label>
              <select id="cycle" value={cycle} onChange={(e) => setCycle(e.target.value as typeof cycle)} style={selectStyle}>
                {CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rate">Tarif per Bulan (Rp)</label>
              <input id="rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="startDate">Tanggal Mulai</label>
              <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "auto" }}>
              {submitting ? <span className="spinner" /> : "Buat Kontrak"}
            </button>
          </form>
        </Card>
      )}

      {tenancies === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : tenancies.length === 0 ? (
        <Card>
          <EmptyState icon="📄" text="Belum ada kontrak." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tenancies.map((t) => (
            <Card key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: ".9rem" }}>
                  {t.tenant.full_name} — Kamar {t.room.room_number}
                </div>
                <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                  {t.room.room_type.name} · {formatRupiah(t.monthly_rate)}/{t.billing_cycle.toLowerCase()} · Mulai {t.start_date}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: ".78rem",
                    fontWeight: 700,
                    color: t.status === "AKTIF" ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {t.status}
                </span>
                {t.status === "AKTIF" && (
                  <button className="btn-link" style={{ color: "var(--danger)" }} onClick={() => handleEnd(t)}>
                    Akhiri
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r)",
  padding: "12px 14px",
  fontSize: ".95rem",
  color: "var(--text)",
  width: "100%",
};
