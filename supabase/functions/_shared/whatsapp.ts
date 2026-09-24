// Pengirim notifikasi WhatsApp — modular per provider, default Fonnte.
// Untuk ganti provider: implementasikan fungsi sendVia<Provider>() baru,
// lalu tambahkan case-nya di sendWhatsApp(). Provider aktif diatur lewat
// secret WA_PROVIDER (default 'fonnte').

async function sendViaFonnte(phone: string, message: string): Promise<void> {
  const token = Deno.env.get("FONNTE_TOKEN");
  if (!token) throw new Error("FONNTE_TOKEN belum di-set di Supabase secrets");

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ target: normalizePhone(phone), message }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fonnte gagal kirim WA (${res.status}): ${text}`);
  }
}

function normalizePhone(phone: string): string {
  let p = phone.trim().replace(/[^\d+]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  return p;
}

export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const provider = Deno.env.get("WA_PROVIDER") ?? "fonnte";
  switch (provider) {
    case "fonnte":
      return sendViaFonnte(phone, message);
    default:
      throw new Error(`WA_PROVIDER tidak dikenal: ${provider}`);
  }
}
