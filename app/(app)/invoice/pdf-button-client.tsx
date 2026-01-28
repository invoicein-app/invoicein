"use client";

type Props = {
  href: string;          // contoh: `/api/invoice/pdf/${id}`
  label?: string;        // default: "Download PDF"
};

export default function PdfButtonClient({ href, label = "Download PDF" }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #111",
        background: "#111",
        color: "white",
        cursor: "pointer",
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 36,
      }}
    >
      📄 {label}
    </button>
  );
}