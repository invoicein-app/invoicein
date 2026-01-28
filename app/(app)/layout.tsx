// app/(app)/layout.tsx
export const runtime = "nodejs";

import Navbar from "@/app/components/navbar";
import Sidebar from "@/app/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9" }}>
      <Navbar />

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 18px 28px",
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        <Sidebar />
        <main style={{ minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}