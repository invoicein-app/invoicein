"use client";

import { useState } from "react";

export default function OrgLogoClient({ currentUrl }: { currentUrl?: string }) {
  const [loading, setLoading] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/org/logo", {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || `Gagal (${res.status})`);
        return;
      }

      alert("Logo tersimpan ✅");
      window.location.reload();
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Logo Usaha</div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 14,
            border: "1px solid #eee",
            background: "#fafafa",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <div style={{ fontSize: 12, color: "#666" }}>No Logo</div>
          )}
        </div>

        <label
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #111",
            background: loading ? "#333" : "#111",
            color: "white",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Uploading..." : "Upload Logo"}
          <input
            type="file"
            accept="image/*"
            onChange={onPickFile}
            disabled={loading}
            style={{ display: "none" }}
          />
        </label>

        <div style={{ color: "#666", fontSize: 13 }}>
          PNG/JPG/WebP, max 2MB.
        </div>
      </div>
    </div>
  );
}