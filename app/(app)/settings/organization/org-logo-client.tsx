"use client";

import { useState } from "react";

const TEAL = "#1D7A73";
const PLACEHOLDER_BG = "#f3f4f6";

export default function OrgLogoClient({
  currentUrl,
  embedded,
}: {
  currentUrl?: string;
  embedded?: boolean;
}) {
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

  const wrapStyle: React.CSSProperties = embedded
    ? { margin: 0, padding: 0 }
    : {
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 20,
        background: "#fff",
        boxSizing: "border-box",
      };

  return (
    <div style={wrapStyle}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#333", marginBottom: 16 }}>Logo Usaha</div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: PLACEHOLDER_BG,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="Logo usaha" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <CameraIcon />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <label
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: loading ? "#8fb3af" : TEAL,
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              display: "inline-block",
            }}
          >
            {loading ? "Mengunggah…" : "Upload Logo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              onChange={onPickFile}
              disabled={loading}
              style={{ display: "none" }}
            />
          </label>
          <span style={{ color: "#A0A0A0", fontSize: 13 }}>JPG/PNG/WebP up to 2MB</span>
        </div>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"
        stroke="#9ca3af"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3.5" stroke="#9ca3af" strokeWidth="1.5" />
    </svg>
  );
}
