"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductForm from "../product-form";

const TEAL = "#2D7D71";
const BG = "#F8F9FA";
const BORDER = "#e5e7eb";

export default function ProductNewPage() {
  const router = useRouter();

  return (
    <div style={{ width: "100%", boxSizing: "border-box", background: BG, minHeight: "100%", padding: "16px 20px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Link
            href="/products"
            title="Kembali"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: `1px solid ${BORDER}`,
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
              color: TEAL,
              background: "#fff",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 18l-6-6 6-6" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#333" }}>Tambah Barang Baru</h1>
            <div style={{ fontSize: 13, color: "#A0A0A0", marginTop: 6 }}>Barang / Tambah Barang Baru</div>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <ProductForm
          variant="page"
          mode="create"
          initial={null}
          onCancel={() => router.push("/products")}
          onSuccess={() => router.push("/products")}
        />
      </div>
    </div>
  );
}
