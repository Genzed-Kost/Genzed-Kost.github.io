// Menerima notifikasi status transaksi dari Midtrans. Signature WAJIB diverifikasi
// di sini — jangan pernah percaya body request begitu saja (siapa pun bisa POST ke
// endpoint publik ini kalau signature tidak dicek).
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { mapMidtransPaymentType, verifyMidtransSignature } from "../_shared/midtrans.ts";
import { confirmPayment } from "../_shared/confirmPayment.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const body = await req.json();
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, payment_type, transaction_id } = body;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return jsonResponse({ error: "Payload notifikasi tidak lengkap." }, 400);
    }

    const isValid = await verifyMidtransSignature({
      orderId: order_id,
      statusCode: String(status_code),
      grossAmount: String(gross_amount),
      signatureKey: signature_key,
    });
    if (!isValid) {
      return jsonResponse({ error: "Signature tidak valid." }, 403);
    }

    const admin = getSupabaseAdmin();
    const { data: payment } = await admin.from("payments").select("id, status").eq("payment_number", order_id).maybeSingle();
    if (!payment) {
      return jsonResponse({ error: "Payment tidak ditemukan." }, 404);
    }

    await admin
      .from("payments")
      .update({
        gateway_transaction_id: transaction_id ?? null,
        gateway_raw_response: body,
        method: payment_type ? mapMidtransPaymentType(payment_type) : undefined,
      })
      .eq("id", payment.id);

    const isSettled = transaction_status === "settlement" || (transaction_status === "capture" && fraud_status === "accept");
    const isFailed = ["expire", "cancel", "deny", "failure"].includes(transaction_status);

    if (isSettled) {
      await confirmPayment(admin, payment.id);
    } else if (isFailed && payment.status === "MENUNGGU") {
      const newStatus = transaction_status === "expire" ? "KEDALUWARSA" : "DIBATALKAN";
      await admin.from("payments").update({ status: newStatus }).eq("id", payment.id);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
