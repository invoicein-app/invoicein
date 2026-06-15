import Link from "next/link";
import { APP_BORDER, APP_TEAL } from "../components/app-ui-tokens";

const tools = [
  {
    href: "/tools/bca-estatement",
    title: "Konversi BCA e-Statement",
    description:
      "Upload PDF mutasi rekening BCA, preview transaksi terstruktur, lalu export ke Excel.",
  },
];

export default function ToolsPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 40px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, color: "#1e293b" }}>Tools</h1>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Utilitas admin dan finance untuk mempercepat pekerjaan operasional.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            style={{
              display: "block",
              padding: "18px 20px",
              borderRadius: 12,
              border: `1px solid ${APP_BORDER}`,
              background: "#fff",
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: APP_TEAL, marginBottom: 6 }}>
              {tool.title}
            </div>
            <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>{tool.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
