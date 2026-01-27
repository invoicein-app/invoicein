"use client";

import React from "react";

type Props = {
  phone?: string | null;        // nomor customer (bebas format)
  customerName?: string | null; // nama customer
  invoiceNo: string;            // INV-xxx
  sjNo?: string | null;         // SJ-xxx (optional)
  totalText: string;            // "Rp 920.000" (sudah diformat)
  invoiceUrl?: string | null;   // link invoice (optional). Misal: https://domain.com/invoice/<id>
};

function normalizeTo62(phoneRaw?: string | null) {
  if (!phoneRaw) return null;
  // ambil digit saja
  let p = phoneRaw.replace(/[^\d]/g, "");

  // kalau mulai 0 -> ganti 62
  if (p.startsWith("0")) p = "62" + p.slice(1);

  // kalau mulai 62 sudah ok
  if (p.startsWith("62")) return p;

  // kalau user nulis 8xxxx tanpa 0/62
  if (p.startsWith("8")) return "62" + p;

  // fallback: balikin apa adanya (tetap angka)
  return p.length >= 8 ? p : null;
}

export function buildWhatsappInvoiceMessage(args: {
  customerName?: string | null;
  invoiceNo: string;
  sjNo?: string | null;
  totalText: string;
  invoiceUrl?: string | null;
}) {
  const name = args.customerName?.trim() || "";
  const greet = name ? `Halo ${name},` : "Halo,";

  const sjLine = args.sjNo ? `No Surat Jalan: ${args.sjNo}\n` : "";
  const urlLine = args.invoiceUrl ? `\nLink Invoice: ${args.invoiceUrl}\n` : "";

  return (
`${greet}

Berikut kami kirimkan invoice:
No Invoice: ${args.invoiceNo}
${sjLine}Total: ${args.totalText}${urlLine}
Mohon dibantu pembayarannya ya.
Terima kasih 🙏`
  ).trim();
}

export default function SendWhatsappInvoiceButton(props: Props) {
  const onClick = () => {
    const phone62 = normalizeTo62(props.phone);
    const message = buildWhatsappInvoiceMessage({
      customerName: props.customerName,
      invoiceNo: props.invoiceNo,
      sjNo: props.sjNo,
      totalText: props.totalText,
      invoiceUrl: props.invoiceUrl,
    });

    // kalau nomor kosong, tetap bisa: buka wa.me tanpa nomor -> user pilih kontak manual
    const base = phone62 ? `https://wa.me/${phone62}` : `https://wa.me/`;
    const url = `${base}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #ddd",
        cursor: "pointer",
        fontWeight: 600,
      }}
      title="Kirim invoice via WhatsApp"
    >
      Kirim via WhatsApp
    </button>
  );
}

