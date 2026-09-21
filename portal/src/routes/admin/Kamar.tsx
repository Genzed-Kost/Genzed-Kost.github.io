import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";
import type { RoomType } from "../../types/database";

type RoomRow = { id: string; room_number: string; floor: number | null; is_occupied: boolean; room_type_id: string; room_types: { name: string } };

export default function Kamar() {
  const [roomTypes, setRoomTypes] = useState<RoomType[] | null>(null);
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typePrice, setTypePrice] = useState("");
  const [typeDesc, setTypeDesc] = useState("");

  const [showRoomForm, setShowRoomForm] = useState(false);
  const [roomNumber, setRoomNumber] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomFloor, setRoomFloor] = useState("");

  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [typeRes, roomRes] = await Promise.all([
      supabase.from("room_types").select("*").order("base_price"),
      supabase.from("rooms").select("id, room_number, floor, is_occupied, room_type_id, room_types(name)").order("room_number"),
    ]);
    if (typeRes.error || roomRes.error) {
      setError("Gagal memuat data kamar.");
      return;
    }
    setRoomTypes(typeRes.data as RoomType[]);
    setRooms(roomRes.data as unknown as RoomRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddType(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!typeName.trim() || !typePrice) {
      setError("Nama dan harga tipe kamar wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from("room_types").insert({
        name: typeName.trim(),
        base_price: Number(typePrice),
        description: typeDesc.trim() || null,
      });
      if (insertErr) {
        setError("Gagal menambah tipe kamar: " + insertErr.message);
        return;
      }
      setTypeName("");
      setTypePrice("");
      setTypeDesc("");
      setShowTypeForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddRoom(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!roomNumber.trim() || !roomTypeId) {
      setError("Nomor kamar dan tipe kamar wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from("rooms").insert({
        room_number: roomNumber.trim(),
        room_type_id: roomTypeId,
        floor: roomFloor ? Number(roomFloor) : null,
      });
      if (insertErr) {
        setError("Gagal menambah kamar: " + insertErr.message);
        return;
      }
      setRoomNumber("");
      setRoomFloor("");
      setShowRoomForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 24 }}>Kamar & Tipe Kamar</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: "1rem" }}>Tipe Kamar</h3>
        <button className="btn-link" onClick={() => setShowTypeForm((v) => !v)}>
          {showTypeForm ? "Batal" : "+ Tambah Tipe"}
        </button>
      </div>
      {showTypeForm && (
        <Card style={{ marginBottom: 16 }}>
          <form onSubmit={handleAddType}>
            <div className="field">
              <label htmlFor="typeName">Nama Tipe</label>
              <input id="typeName" value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="mis. Big Mood Suite" />
            </div>
            <div className="field">
              <label htmlFor="typePrice">Harga per Bulan (Rp)</label>
              <input id="typePrice" type="number" value={typePrice} onChange={(e) => setTypePrice(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="typeDesc">Deskripsi</label>
              <input id="typeDesc" value={typeDesc} onChange={(e) => setTypeDesc(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "auto" }}>
              {submitting ? <span className="spinner" /> : "Simpan"}
            </button>
          </form>
        </Card>
      )}
      {roomTypes === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : roomTypes.length === 0 ? (
        <Card style={{ marginBottom: 24 }}>
          <EmptyState icon="🛏️" text="Belum ada tipe kamar." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {roomTypes.map((t) => (
            <Card key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{t.name}</div>
                <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>{t.description}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{formatRupiah(t.base_price)}</div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: "1rem" }}>Daftar Kamar</h3>
        <button className="btn-link" onClick={() => setShowRoomForm((v) => !v)}>
          {showRoomForm ? "Batal" : "+ Tambah Kamar"}
        </button>
      </div>
      {showRoomForm && (
        <Card style={{ marginBottom: 16 }}>
          <form onSubmit={handleAddRoom}>
            <div className="field">
              <label htmlFor="roomNumber">Nomor Kamar</label>
              <input id="roomNumber" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="mis. 12" />
            </div>
            <div className="field">
              <label htmlFor="roomTypeId">Tipe Kamar</label>
              <select
                id="roomTypeId"
                value={roomTypeId}
                onChange={(e) => setRoomTypeId(e.target.value)}
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r)",
                  padding: "12px 14px",
                  fontSize: ".95rem",
                  color: "var(--text)",
                  width: "100%",
                }}
              >
                <option value="">— Pilih tipe —</option>
                {(roomTypes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="roomFloor">Lantai (opsional)</label>
              <input id="roomFloor" type="number" value={roomFloor} onChange={(e) => setRoomFloor(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "auto" }}>
              {submitting ? <span className="spinner" /> : "Simpan"}
            </button>
          </form>
        </Card>
      )}
      {rooms === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : rooms.length === 0 ? (
        <Card>
          <EmptyState icon="🚪" text="Belum ada kamar." />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {rooms.map((r) => (
            <Card key={r.id}>
              <div style={{ fontWeight: 700, fontSize: ".95rem" }}>Kamar {r.room_number}</div>
              <div style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 2 }}>{r.room_types.name}</div>
              <div style={{ fontSize: ".78rem", fontWeight: 700, marginTop: 6, color: r.is_occupied ? "var(--warn)" : "var(--accent)" }}>
                {r.is_occupied ? "Terisi" : "Kosong"}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
