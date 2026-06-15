import Link from "next/link";
import BcaEstatementClient from "./bca-estatement-client";

export default function BcaEstatementPage() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 40px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/tools"
          style={{ fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 600 }}
        >
          ← Tools
        </Link>
        <h1 style={{ margin: "10px 0 0", fontSize: 26, color: "#1e293b" }}>Konversi BCA e-Statement</h1>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Upload PDF mutasi rekening BCA, preview transaksi terstruktur, lalu export ke Excel untuk
          keperluan admin / finance.
        </p>
      </div>
      <BcaEstatementClient />
    </div>
  );
}
