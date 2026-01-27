// invoiceku/app/invoice/dotmatrix-button-client.tsx
"use client";

export default function DotmatrixButtonClient({ href }: { href: string }) {
  return (
    <a
      href={href}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #ddd",
        background: "white",
        textDecoration: "none",
        color: "#111",
        fontWeight: 600,
      }}
    >
      Download Dotmatrix
    </a>
  );
}