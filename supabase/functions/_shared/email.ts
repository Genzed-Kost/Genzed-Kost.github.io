// Pengirim email — opsional, OFF secara default. Aktif otomatis kalau secret
// RESEND_API_KEY di-set (daftar gratis di resend.com). Kalau tidak di-set,
// fungsi ini cuma no-op supaya fitur lain (pembayaran, PDF) tetap jalan normal.

export async function sendEmail(params: { to: string; subject: string; html: string; attachment?: { filename: string; contentBase64: string } }): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return; // email belum dikonfigurasi, lewati diam-diam

  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Genzed Kost <noreply@genzed-kost.github.io>";

  const body: Record<string, unknown> = {
    from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (params.attachment) {
    body.attachments = [{ filename: params.attachment.filename, content: params.attachment.contentBase64 }];
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gagal kirim email (${res.status}): ${await res.text()}`);
  }
}
