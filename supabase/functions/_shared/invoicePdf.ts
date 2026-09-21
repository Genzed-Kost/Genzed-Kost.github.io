// Generate PDF invoice sederhana begitu tagihan lunas, upload ke Storage,
// lalu kirim link-nya via WhatsApp (selalu) dan email (kalau RESEND_API_KEY di-set).
// Kegagalan di sini TIDAK BOLEH menggagalkan proses pelunasan pembayaran itu sendiri
// — makanya dipanggil di dalam try/catch oleh confirmPayment.ts.
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsApp } from "./whatsapp.ts";
import { sendEmail } from "./email.ts";

const BUCKET = "invoices";

function rupiah(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function invoicePdfPath(tenantId: string, invoiceNumber: string): string {
  return `${tenantId}/${invoiceNumber}.pdf`;
}

async function buildPdf(invoice: {
  invoice_number: string;
  period_start: string;
  period_end: string;
  due_date: string;
  subtotal: number;
  discount_total: number;
  penalty_total: number;
  total: number;
  paid_total: number;
}, tenant: { full_name: string; email: string }, items: Array<{ description: string; amount: number }>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.05, 0.05, 0.05);
  const gray = rgb(0.45, 0.45, 0.45);
  const accent = rgb(0.09, 0.55, 0.15);

  let y = 800;
  const left = 50;

  page.drawText("GENZED KOST", { x: left, y, size: 22, font: bold, color: black });
  y -= 16;
  page.drawText("Serang, Banten", { x: left, y, size: 9, font, color: gray });

  y -= 40;
  page.drawText(`INVOICE ${invoice.invoice_number}`, { x: left, y, size: 14, font: bold, color: black });
  y -= 18;
  page.drawText(`Ditagihkan kepada: ${tenant.full_name}`, { x: left, y, size: 10, font, color: black });
  y -= 14;
  page.drawText(`Periode: ${invoice.period_start} s/d ${invoice.period_end}`, { x: left, y, size: 10, font, color: gray });
  y -= 14;
  page.drawText(`Jatuh tempo: ${invoice.due_date}`, { x: left, y, size: 10, font, color: gray });
  y -= 14;
  page.drawText("Status: LUNAS", { x: left, y, size: 10, font: bold, color: accent });

  y -= 30;
  page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 1, color: gray });
  y -= 20;

  for (const item of items) {
    page.drawText(item.description, { x: left, y, size: 10, font, color: black, maxWidth: 350 });
    page.drawText(rupiah(item.amount), { x: 460, y, size: 10, font, color: black });
    y -= 18;
  }

  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 0.5, color: gray });
  y -= 20;

  const row = (label: string, value: string, isBold = false) => {
    page.drawText(label, { x: 350, y, size: 10, font: isBold ? bold : font, color: black });
    page.drawText(value, { x: 460, y, size: 10, font: isBold ? bold : font, color: black });
    y -= 16;
  };

  row("Subtotal", rupiah(invoice.subtotal));
  if (invoice.discount_total > 0) row("Diskon", "-" + rupiah(invoice.discount_total));
  if (invoice.penalty_total > 0) row("Denda", "+" + rupiah(invoice.penalty_total));
  row("Total", rupiah(invoice.total), true);
  row("Dibayar", rupiah(invoice.paid_total));

  y -= 30;
  page.drawText("Terima kasih sudah tinggal di Genzed Kost!", { x: left, y, size: 9, font, color: gray });
  y -= 12;
  page.drawText(`Invoice ini dibuat otomatis untuk ${tenant.email}.`, { x: left, y, size: 8, font, color: gray });

  return pdfDoc.save();
}

export async function generateInvoicePdfAndNotify(admin: SupabaseClient, invoiceId: string): Promise<void> {
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, invoice_number, tenant_id, period_start, period_end, due_date, subtotal, discount_total, penalty_total, total, paid_total")
    .eq("id", invoiceId)
    .single();
  if (!invoice) return;

  const { data: tenant } = await admin
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", invoice.tenant_id)
    .single();
  if (!tenant) return;

  const { data: items } = await admin
    .from("invoice_items")
    .select("description, amount")
    .eq("invoice_id", invoiceId);

  const pdfBytes = await buildPdf(invoice, tenant, items ?? []);
  const path = invoicePdfPath(invoice.tenant_id, invoice.invoice_number);

  await admin.storage.from(BUCKET).upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  const link = signed?.signedUrl;

  const rupiahTotal = rupiah(invoice.total);
  const waBody = `Tagihan ${invoice.invoice_number} sebesar ${rupiahTotal} sudah LUNAS. Terima kasih! 🎉${link ? `\n\nInvoice PDF: ${link}` : ""}`;

  await admin.from("notifications").insert({
    tenant_id: invoice.tenant_id,
    channel: "whatsapp",
    category: "pembayaran",
    title: `Tagihan ${invoice.invoice_number} lunas`,
    body: waBody,
  });

  try {
    await sendWhatsApp(tenant.phone, `Halo ${tenant.full_name}! 👋\n\n${waBody}`);
  } catch {
    // gagal kirim WA tidak boleh menggagalkan proses
  }

  if (link) {
    try {
      await sendEmail({
        to: tenant.email,
        subject: `Invoice ${invoice.invoice_number} — Lunas`,
        html: `<p>Halo ${tenant.full_name},</p><p>Tagihan <strong>${invoice.invoice_number}</strong> sebesar <strong>${rupiahTotal}</strong> sudah lunas.</p><p><a href="${link}">Unduh invoice PDF</a></p><p>Terima kasih sudah tinggal di Genzed Kost!</p>`,
      });
    } catch {
      // email opsional, kegagalan diabaikan
    }
  }
}
