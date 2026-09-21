import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah } from "../../lib/format";
import { Card, EmptyState } from "../../components/Card";
import type { Penalty } from "../../types/database";

export default function Denda() {
  const [penalties, setPenalties] = useState<Penalty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [calcType, setCalcType] = useState<"NOMINAL_PER_HARI" | "PERSEN_PER_HARI">("NOMINAL_PER_HARI");
  const [value, setValue] = useState("");
  const [gracePeriod, setGracePeriod] = useState("3");
  const [maxAmount, setMaxAmount] = useState("");

  async function load() {
    const { data, error: fetchErr } = await supabase.from("penalties").select("*").order("created_at", { ascending: false });
    if (fetchErr) {
      setError("Gagal memuat aturan denda.");
      return;
    }
    setPenalties(data as Penalty[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !value) {
      setError("Nama dan nilai denda wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from("penalties").insert({
        name: name.trim(),
        calc_type: calcType,
        value: Number(value),
        grace_period_days: Number(gracePeriod || 0),
        max_amount: maxAmount ? Number(maxAmount) : null,
      });
      if (insertErr) {
        setError("Gagal menambah aturan: " + insertErr.message);
        return;
      }
      setName("");
      setValue("");
      setMaxAmount("");
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  // Cuma boleh 1 aturan aktif sekaligus (mesin denda otomatis ambil yang is_active=true).
  async function activate(target: Penalty) {
    await Promise.all((penalties ?? []).filter((p) => p.id !== target.id && p.is_active).map((p) => supabase.from("penalties").update({ is_active: false }).eq("id", p.id)));
    await supabase.from("penalties").update({ is_active: true }).eq("id", target.id);
    await load();
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: "1.5rem" }}>Aturan Denda Keterlambatan</h1>
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Batal" : "+ Aturan Baru"}
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>
        Cuma 1 aturan yang bisa aktif sekaligus — itu yang dipakai mesin denda otomatis tiap hari.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="name">Nama Aturan</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Denda Standar" />
            </div>
            <div className="field">
              <label htmlFor="calcType">Tipe Perhitungan</label>
              <select
                id="calcType"
                value={calcType}
                onChange={(e) => setCalcType(e.target.value as typeof calcType)}
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 14px", color: "var(--text)", width: "100%" }}
              >
                <option value="NOMINAL_PER_HARI">Nominal per Hari (Rp)</option>
                <option value="PERSEN_PER_HARI">Persen per Hari (%)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="value">Nilai {calcType === "PERSEN_PER_HARI" ? "(%/hari)" : "(Rp/hari)"}</label>
              <input id="value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="gracePeriod">Masa Tenggang (hari)</label>
              <input id="gracePeriod" type="number" value={gracePeriod} onChange={(e) => setGracePeriod(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="maxAmount">Denda Maksimal (Rp, opsional)</label>
              <input id="maxAmount" type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "auto" }}>
              {submitting ? <span className="spinner" /> : "Simpan"}
            </button>
          </form>
        </Card>
      )}

      {penalties === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : penalties.length === 0 ? (
        <Card>
          <EmptyState icon="⏰" text="Belum ada aturan denda." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {penalties.map((p) => (
            <Card key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{p.name}</div>
                <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                  {p.calc_type === "NOMINAL_PER_HARI" ? formatRupiah(p.value) : `${p.value}%`}/hari · tenggang {p.grace_period_days} hari
                  {p.max_amount ? ` · maks ${formatRupiah(p.max_amount)}` : ""}
                </div>
              </div>
              {p.is_active ? (
                <span style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--accent)" }}>Aktif</span>
              ) : (
                <button className="btn-link" onClick={() => activate(p)}>
                  Aktifkan
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
