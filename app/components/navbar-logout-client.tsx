"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        const t = await res.text();
        alert(`Logout gagal: ${t}`);
        return;
      }
      window.location.href = "/login";
    } catch (e: any) {
      alert(`Failed to fetch: ${e?.message || "unknown"}`);
    } finally {
      setLoading(false);
    }
    
  }

  return (
    <button
      onClick={onLogout}
      disabled={loading}
      style={{
        padding: "8px 12px",
        borderRadius: 12,
        border: "1px solid #111",
        background: loading ? "#333" : "#111",
        color: "white",
        cursor: loading ? "not-allowed" : "pointer",
        fontWeight: 900,
        height: 36,
      }}
    >
      {loading ? "..." : "Logout"}
    </button>
  );
}