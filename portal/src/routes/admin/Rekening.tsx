import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { BANKS, EWALLET_PROVIDERS } from "../../lib/banks";
import { Card, EmptyState } from "../../components/Card";
import type { PaymentAccount, PaymentAccountType } from "../../types/database";

const BUCKET = "payment-account-qris";

const TYPE_LABEL: Record<PaymentAccountType, string> = {
  BANK: "🏦 Bank",
  QRIS: "📱 QRIS",
  EWALLET: "💳 E-Wallet",
};

export default function Rekening() {
  const [accounts, setAccounts] = useState<PaymentAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [accountType, setAccountType] = useState<PaymentAccountType>("BANK");
  const [bankCode, setBankCode] = useState(BANKS[0].code);
  const [bankNameOther, setBankNameOther] = useState("");
  const [ewalletProvider, setEwalletProvider] = useState<string>(EWALLET_PROVIDERS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [instructions, setInstructions] = useState("");
  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const [qrisImagePath, setQrisImagePath] = useState<string | null>(null);

  async function load() {
    const { data, error: fetchErr } = await supabase.from("payment_accounts").select("*").order("sort_order", { ascending: true });
    if (fetchErr) {
      setError("Gagal memuat daftar rekening.");
      return;
    }
    setAccounts(data as PaymentAccount[]);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setAccountType("BANK");
    setBankCode(BANKS[0].code);
    setBankNameOther("");
    setEwalletProvider(EWALLET_PROVIDERS[0]);
    setAccountNumber("");
    setAccountHolder("");
    setInstructions("");
    setQrisFile(null);
    setQrisImagePath(null);
  }

  function startEdit(a: PaymentAccount) {
    setEditingId(a.id);
    setAccountType(a.account_type);
    if (a.account_type === "BANK") {
      const known = BANKS.find((b) => b.code === a.bank_code);
      setBankCode(known ? known.code : "OTHER");
      setBankNameOther(known ? "" : a.bank_name ?? "");
    }
    if (a.account_type === "EWALLET") setEwalletProvider(a.ewallet_provider ?? EWALLET_PROVIDERS[0]);
    setAccountNumber(a.account_number ?? "");
    setAccountHolder(a.account_holder ?? "");
    setInstructions(a.instructions ?? "");
    setQrisImagePath(a.qris_image_path);
    setQrisFile(null);
    setShowForm(true);
  }

  async function logAudit(action: string, targetId: string, metadata: Record<string, unknown>) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_id: user?.id,
      action,
      target_table: "payment_accounts",
      target_id: targetId,
      metadata,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (accountType === "BANK" && accountNumber && !/^\d+$/.test(accountNumber)) {
      setError("Nomor rekening bank cuma boleh angka.");
      return;
    }
    if (accountType === "QRIS" && !qrisFile && !qrisImagePath) {
      setError("Upload gambar QRIS dulu.");
      return;
    }
    if (accountType !== "QRIS" && !accountNumber.trim()) {
      setError("Nomor rekening / nomor e-wallet wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      let finalQrisPath = qrisImagePath;
      if (accountType === "QRIS" && qrisFile) {
        const path = `${crypto.randomUUID()}-${qrisFile.name}`;
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, qrisFile, { upsert: true });
        if (uploadErr) {
          setError("Gagal upload gambar QRIS.");
          return;
        }
        finalQrisPath = path;
      }

      const bankRef = BANKS.find((b) => b.code === bankCode);
      const payload = {
        account_type: accountType,
        bank_code: accountType === "BANK" ? bankCode : null,
        bank_name: accountType === "BANK" ? (bankCode === "OTHER" ? bankNameOther.trim() : bankRef?.name ?? null) : null,
        account_number: accountType === "QRIS" ? null : accountNumber.trim(),
        account_holder: accountType === "QRIS" ? null : accountHolder.trim() || null,
        ewallet_provider: accountType === "EWALLET" ? ewalletProvider : null,
        qris_image_path: accountType === "QRIS" ? finalQrisPath : null,
        instructions: instructions.trim() || null,
      };

      if (editingId) {
        const { error: updateErr } = await supabase.from("payment_accounts").update(payload).eq("id", editingId);
        if (updateErr) {
          setError("Gagal menyimpan perubahan: " + updateErr.message);
          return;
        }
        await logAudit("update_payment_account", editingId, payload);
      } else {
        const maxSort = Math.max(0, ...(accounts ?? []).map((a) => a.sort_order));
        const { data: inserted, error: insertErr } = await supabase
          .from("payment_accounts")
          .insert({ ...payload, sort_order: maxSort + 1 })
          .select("id")
          .single();
        if (insertErr) {
          setError("Gagal menambah rekening: " + insertErr.message);
          return;
        }
        await logAudit("create_payment_account", inserted!.id, payload);
      }

      resetForm();
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(a: PaymentAccount) {
    await supabase.from("payment_accounts").update({ is_active: !a.is_active }).eq("id", a.id);
    await logAudit(a.is_active ? "deactivate_payment_account" : "activate_payment_account", a.id, {});
    await load();
  }

  async function move(a: PaymentAccount, direction: -1 | 1) {
    const list = accounts ?? [];
    const idx = list.findIndex((x) => x.id === a.id);
    const swapWith = list[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("payment_accounts").update({ sort_order: swapWith.sort_order }).eq("id", a.id),
      supabase.from("payment_accounts").update({ sort_order: a.sort_order }).eq("id", swapWith.id),
    ]);
    await load();
  }

  async function handleDelete(a: PaymentAccount) {
    if (!confirm(`Hapus rekening "${a.bank_name ?? a.ewallet_provider ?? "QRIS"}"?`)) return;
    const { error: deleteErr } = await supabase.from("payment_accounts").delete().eq("id", a.id);
    if (deleteErr) {
      setError("Gagal menghapus rekening.");
      return;
    }
    await logAudit("delete_payment_account", a.id, { bank_name: a.bank_name, account_number: a.account_number });
    await load();
  }

  const activeCount = (accounts ?? []).filter((a) => a.is_active).length;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: "1.5rem" }}>Rekening Transfer Manual</h1>
        <button
          className="btn btn-primary"
          style={{ width: "auto" }}
          onClick={() => {
            if (showForm) resetForm();
            setShowForm((v) => !v);
          }}
        >
          {showForm ? "Batal" : "+ Rekening Baru"}
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 24 }}>
        Penghuni pilih salah satu rekening aktif sebelum transfer manual. Minimal 1 rekening harus aktif.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {activeCount === 0 && !error && (
        <div className="alert alert-error">⚠️ Belum ada rekening aktif — penghuni tidak bisa pakai transfer manual sampai ada minimal 1.</div>
      )}

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="accountType">Tipe</label>
              <select
                id="accountType"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as PaymentAccountType)}
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 14px", color: "var(--text)", width: "100%" }}
              >
                <option value="BANK">Bank</option>
                <option value="QRIS">QRIS (gambar statis)</option>
                <option value="EWALLET">E-Wallet</option>
              </select>
            </div>

            {accountType === "BANK" && (
              <>
                <div className="field">
                  <label htmlFor="bankCode">Bank</label>
                  <select
                    id="bankCode"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 14px", color: "var(--text)", width: "100%" }}
                  >
                    {BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                {bankCode === "OTHER" && (
                  <div className="field">
                    <label htmlFor="bankNameOther">Nama Bank</label>
                    <input id="bankNameOther" value={bankNameOther} onChange={(e) => setBankNameOther(e.target.value)} placeholder="mis. Bank NTB Syariah" />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="accountNumber">Nomor Rekening</label>
                  <input id="accountNumber" inputMode="numeric" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="1234567890" />
                </div>
                <div className="field">
                  <label htmlFor="accountHolder">Atas Nama</label>
                  <input id="accountHolder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Nama pemilik rekening" />
                </div>
              </>
            )}

            {accountType === "EWALLET" && (
              <>
                <div className="field">
                  <label htmlFor="ewalletProvider">Provider</label>
                  <select
                    id="ewalletProvider"
                    value={ewalletProvider}
                    onChange={(e) => setEwalletProvider(e.target.value)}
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 14px", color: "var(--text)", width: "100%" }}
                  >
                    {EWALLET_PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="accountNumberEw">Nomor {ewalletProvider}</label>
                  <input id="accountNumberEw" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="08123456789" />
                </div>
                <div className="field">
                  <label htmlFor="accountHolderEw">Atas Nama</label>
                  <input id="accountHolderEw" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Nama pemilik akun" />
                </div>
              </>
            )}

            {accountType === "QRIS" && (
              <div className="field">
                <label>Gambar QRIS</label>
                {qrisImagePath && !qrisFile && (
                  <img
                    src={supabase.storage.from(BUCKET).getPublicUrl(qrisImagePath).data.publicUrl}
                    alt="QRIS saat ini"
                    style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 8, display: "block" }}
                  />
                )}
                <input type="file" accept="image/*" onChange={(e) => setQrisFile(e.target.files?.[0] ?? null)} />
              </div>
            )}

            <div className="field">
              <label htmlFor="instructions">Catatan (opsional)</label>
              <input id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="mis. Transfer sesama Jago gratis admin" />
            </div>

            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "auto" }}>
              {submitting ? <span className="spinner" /> : editingId ? "Simpan Perubahan" : "Tambah"}
            </button>
          </form>
        </Card>
      )}

      {accounts === null ? (
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState icon="🏦" text="Belum ada rekening." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {accounts.map((a, idx) => (
            <Card key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {a.account_type === "QRIS" && a.qris_image_path && (
                  <img
                    src={supabase.storage.from(BUCKET).getPublicUrl(a.qris_image_path).data.publicUrl}
                    alt="QRIS"
                    style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: ".9rem" }}>
                    {TYPE_LABEL[a.account_type]} {a.bank_name ?? a.ewallet_provider ?? ""}
                  </div>
                  <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                    {a.account_number ?? "—"} {a.account_holder ? `· a.n ${a.account_holder}` : ""}
                  </div>
                  {a.instructions && <div style={{ fontSize: ".76rem", color: "var(--muted)", marginTop: 2 }}>{a.instructions}</div>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button className="btn-link" disabled={idx === 0} onClick={() => move(a, -1)} title="Naikkan urutan">
                  ↑
                </button>
                <button className="btn-link" disabled={idx === accounts.length - 1} onClick={() => move(a, 1)} title="Turunkan urutan">
                  ↓
                </button>
                <span
                  style={{ fontSize: ".78rem", fontWeight: 700, color: a.is_active ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
                  onClick={() => toggleActive(a)}
                >
                  {a.is_active ? "Aktif" : "Nonaktif"}
                </span>
                <button className="btn-link" onClick={() => startEdit(a)}>
                  Ubah
                </button>
                <button className="btn-link" style={{ color: "var(--danger)" }} onClick={() => handleDelete(a)}>
                  Hapus
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
