// FIX: show_note kamu belum ikut di page settings, jadi pas upsert dia ga pernah ngirim show_note
// ✅ FULL REPLACE FILE
// app/(app)/settings/invoice-template/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type TemplateKey =
  | "clean"
  | "dotmatrix"
  | "template_1"
  | "template_2"
  | "template_3"
  | "template_4"
  | "template_5";

type TemplateItem = {
  key: TemplateKey;
  title: string;
  desc: string;
  previewSrc: string;
};

const TEMPLATES: TemplateItem[] = [
  {
    key: "clean",
    title: "Clean (Default)",
    desc: "Modern, rapi, cocok untuk mayoritas UMKM.",
    previewSrc: "/invoice-templates/clean.png",
  },
  {
    key: "dotmatrix",
    title: "Dotmatrix",
    desc: "Hitam putih, gaya dot-matrix (printing friendly).",
    previewSrc: "/invoice-templates/dotmatrix.png",
  },
  { key: "template_1", title: "Template 1", desc: "Placeholder.", previewSrc: "/invoice-templates/template-1.png" },
  { key: "template_2", title: "Template 2", desc: "Placeholder.", previewSrc: "/invoice-templates/template-2.png" },
  { key: "template_3", title: "Template 3", desc: "Placeholder.", previewSrc: "/invoice-templates/template-3.png" },
  { key: "template_4", title: "Template 4", desc: "Placeholder.", previewSrc: "/invoice-templates/template-4.png" },
  { key: "template_5", title: "Template 5", desc: "Placeholder.", previewSrc: "/invoice-templates/template-5.png" },
];

function isAdminRole(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "super_admin";
}

type Toggles = {
  show_tax: boolean;
  show_discount: boolean;
  show_delivery_note: boolean;
  show_terbilang: boolean;
  show_bank_info: boolean;
  show_note: boolean; // ✅ NEW
};

const DEFAULT_TOGGLES: Toggles = {
  show_tax: true,
  show_discount: true,
  show_delivery_note: true,
  show_terbilang: true,
  show_bank_info: true,
  show_note: true, // ✅ NEW
};

export default function InvoiceTemplateSettingsPage() {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orgId, setOrgId] = useState<string>("");
  const [role, setRole] = useState<string>("");

  const [activeKey, setActiveKey] = useState<TemplateKey>("clean");
  const [selectedKey, setSelectedKey] = useState<TemplateKey>("clean");

  const [activeToggles, setActiveToggles] = useState<Toggles>(DEFAULT_TOGGLES);
  const [draftToggles, setDraftToggles] = useState<Toggles>(DEFAULT_TOGGLES);

  const canEdit = useMemo(() => isAdminRole(role), [role]);

  const hasToggleChanges = useMemo(() => {
    const a = activeToggles;
    const d = draftToggles;
    return (
      a.show_tax !== d.show_tax ||
      a.show_discount !== d.show_discount ||
      a.show_delivery_note !== d.show_delivery_note ||
      a.show_terbilang !== d.show_terbilang ||
      a.show_bank_info !== d.show_bank_info ||
      a.show_note !== d.show_note
    );
  }, [activeToggles, draftToggles]);

  const hasChanges = useMemo(
    () => selectedKey !== activeKey || hasToggleChanges,
    [selectedKey, activeKey, hasToggleChanges]
  );

  async function load() {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      const m: any = membership || {};
      const org_id = String(m.org_id || "");
      const r = String(m.role || "");

      setOrgId(org_id);
      setRole(r);

      if (!org_id) {
        setActiveKey("clean");
        setSelectedKey("clean");
        setActiveToggles(DEFAULT_TOGGLES);
        setDraftToggles(DEFAULT_TOGGLES);
        return;
      }

      // ✅ fetch invoice_settings (include show_note)
      const { data: row } = await supabase
        .from("invoice_settings")
        .select("active_template_key, show_tax, show_discount, show_delivery_note, show_terbilang, show_bank_info, show_note")
        .eq("organization_id", org_id)
        .maybeSingle();

      const key = String((row as any)?.active_template_key || "clean").toLowerCase() as TemplateKey;

      const toggles: Toggles = {
        show_tax: (row as any)?.show_tax ?? true,
        show_discount: (row as any)?.show_discount ?? true,
        show_delivery_note: (row as any)?.show_delivery_note ?? true,
        show_terbilang: (row as any)?.show_terbilang ?? true,
        show_bank_info: (row as any)?.show_bank_info ?? true,
        show_note: (row as any)?.show_note ?? true, // ✅ NEW
      };

      setActiveKey(key);
      setSelectedKey(key);

      setActiveToggles(toggles);
      setDraftToggles(toggles);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!orgId) return;
    if (!canEdit) return;

    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        active_template_key: selectedKey,
        ...draftToggles, // ✅ now includes show_note
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("invoice_settings").upsert(payload as any, { onConflict: "organization_id" });
      if (error) throw error;

      setActiveKey(selectedKey);
      setActiveToggles(draftToggles);
    } catch (err: any) {
      alert(err?.message || "Gagal simpan pengaturan invoice.");
    } finally {
      setSaving(false);
    }
  }

  const current = useMemo(() => TEMPLATES.find((t) => t.key === selectedKey) || TEMPLATES[0], [selectedKey]);

  return (
    <div style={wrap()}>
      <div style={header()}>
        <div>
          <h1 style={h1()}>Invoice Template</h1>
          <p style={sub()}>
            Berlaku untuk <b>1 organisasi</b> (biar hasil print semua sama).
          </p>
        </div>

        <button
          onClick={save}
          disabled={loading || saving || !canEdit || !hasChanges}
          style={btnPrimary(loading || saving || !canEdit || !hasChanges)}
          title={!canEdit ? "Hanya admin yang bisa mengubah template" : "Simpan pilihan template"}
        >
          {saving ? "Menyimpan..." : !hasChanges ? "Tersimpan" : "Simpan"}
        </button>
      </div>

      {!canEdit ? (
        <div style={warn()}>
          Kamu login sebagai <b>{role || "-"}</b>. Hanya <b>ADMIN</b> yang bisa mengganti template & opsi.
        </div>
      ) : null}

      {loading ? (
        <div style={card()}>
          <div style={{ fontWeight: 900 }}>Loading...</div>
          <div style={{ color: "#6b7280", marginTop: 6 }}>Mengambil pengaturan organisasi.</div>
        </div>
      ) : !orgId ? (
        <div style={card()}>
          <div style={{ fontWeight: 900 }}>Organisasi belum terdeteksi</div>
          <div style={{ color: "#6b7280", marginTop: 6 }}>Pastikan membership aktif sudah terbentuk (init-org).</div>
        </div>
      ) : (
        <div style={grid()}>
          <div style={left()}>
            <div style={sectionTitle()}>Pilih Template</div>

            <div style={{ display: "grid", gap: 10 }}>
              {TEMPLATES.map((t) => {
                const isSelected = selectedKey === t.key;
                const isSaved = activeKey === t.key;

                return (
                  <button key={t.key} type="button" onClick={() => setSelectedKey(t.key)} style={tplBtn(isSelected)}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={radio(isSelected)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 950, color: isSelected ? "white" : "#111827" }}>
                            {t.title} {isSaved ? <span style={pill(isSelected)}>Aktif</span> : null}
                          </div>
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            color: isSelected ? "rgba(255,255,255,0.85)" : "#6b7280",
                            fontSize: 13,
                            lineHeight: 1.35,
                          }}
                        >
                          {t.desc}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={dividerLine()} />

            <div style={sectionTitle()}>Opsi di PDF</div>

            <div style={{ display: "grid", gap: 10 }}>
              <ToggleRow
                label="Tampilkan Pajak"
                desc="Kalau off, baris Pajak tidak muncul di total."
                value={draftToggles.show_tax}
                disabled={!canEdit}
                onChange={(v) => setDraftToggles((p) => ({ ...p, show_tax: v }))}
              />
              <ToggleRow
                label="Tampilkan Diskon"
                desc="Kalau off, baris Diskon tidak muncul di total."
                value={draftToggles.show_discount}
                disabled={!canEdit}
                onChange={(v) => setDraftToggles((p) => ({ ...p, show_discount: v }))}
              />
              <ToggleRow
                label="Tampilkan No. Surat Jalan"
                desc="Kalau off, info NO SJ disembunyikan."
                value={draftToggles.show_delivery_note}
                disabled={!canEdit}
                onChange={(v) => setDraftToggles((p) => ({ ...p, show_delivery_note: v }))}
              />
              <ToggleRow
                label="Tampilkan Terbilang"
                desc="Biasanya dipakai di dotmatrix."
                value={draftToggles.show_terbilang}
                disabled={!canEdit}
                onChange={(v) => setDraftToggles((p) => ({ ...p, show_terbilang: v }))}
              />
              <ToggleRow
                label="Tampilkan Info Rekening"
                desc="Kalau off, bagian rekening/transfer disembunyikan."
                value={draftToggles.show_bank_info}
                disabled={!canEdit}
                onChange={(v) => setDraftToggles((p) => ({ ...p, show_bank_info: v }))}
              />
              <ToggleRow
                label="Tampilkan Catatan"
                desc="Kalau off, box catatan tidak muncul (clean & dotmatrix)."
                value={draftToggles.show_note}
                disabled={!canEdit}
                onChange={(v) => setDraftToggles((p) => ({ ...p, show_note: v }))}
              />
            </div>

            <div style={hint()}>
              Setelah disimpan, tombol PDF sebaiknya arahkan ke <b>/api/invoice/pdf-auto/[id]</b> supaya invoice lama & baru ikut setting ini.
            </div>
          </div>

          <div style={right()}>
            <div style={sectionTitle()}>Preview</div>

            <div style={previewCard()}>
              <div style={{ fontWeight: 950, marginBottom: 8 }}>{current.title}</div>
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>{current.desc}</div>

              <div style={imgWrap()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.previewSrc}
                  alt={`Preview ${current.title}`}
                  style={img()}
                  onError={(e) => {
                    (e.currentTarget as any).style.display = "none";
                    const parent = (e.currentTarget as any).parentElement;
                    if (parent) {
                      parent.innerHTML =
                        '<div style="padding:14px; color:#6b7280; font-size:13px;">Preview belum ada. Taruh screenshot di <b>/public/invoice-templates/</b>.</div>';
                    }
                  }}
                />
              </div>

              <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
                File preview: <b>{current.previewSrc}</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow(props: {
  label: string;
  desc: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const { label, desc, value, disabled, onChange } = props;

  return (
    <div style={toggleRow()}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 950, color: "#111827" }}>{label}</div>
        <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12.5, lineHeight: 1.35 }}>{desc}</div>
      </div>

      <button
        type="button"
        onClick={() => onChange(!value)}
        disabled={!!disabled}
        style={switchBtn(value, !!disabled)}
        aria-pressed={value}
        title={disabled ? "Hanya admin yang bisa mengubah" : "Toggle"}
      >
        <span style={knob(value)} />
      </button>
    </div>
  );
}

/** Styles */
function wrap(): React.CSSProperties { return { padding: 6 }; }
function header(): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 };
}
function h1(): React.CSSProperties { return { margin: 0, fontSize: 20, fontWeight: 1000, color: "#111827" }; }
function sub(): React.CSSProperties { return { margin: "6px 0 0", color: "#6b7280", fontSize: 13, lineHeight: 1.4 }; }

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: disabled ? "#9ca3af" : "#111827",
    color: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 950,
    whiteSpace: "nowrap",
    minWidth: 110,
  };
}

function warn(): React.CSSProperties {
  return { marginBottom: 12, borderRadius: 14, border: "1px solid #fde68a", background: "#fffbeb", padding: 12, color: "#92400e", fontSize: 13 };
}

function card(): React.CSSProperties {
  return { border: "1px solid #e5e7eb", background: "white", borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" };
}

function grid(): React.CSSProperties { return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }; }
function left(): React.CSSProperties { return { ...card() }; }
function right(): React.CSSProperties { return { ...card() }; }
function sectionTitle(): React.CSSProperties { return { fontSize: 12, fontWeight: 950, color: "#6b7280", marginBottom: 10, letterSpacing: 0.2 }; }

function tplBtn(active: boolean): React.CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    borderRadius: 14,
    border: active ? "1px solid #111827" : "1px solid #e5e7eb",
    background: active ? "#111827" : "white",
    padding: 12,
    cursor: "pointer",
    boxShadow: active ? "0 10px 24px rgba(17,24,39,0.12)" : "none",
    color: active ? "white" : "#111827",
  };
}

function radio(active: boolean): React.CSSProperties {
  return { width: 18, height: 18, borderRadius: 999, border: active ? "5px solid white" : "2px solid #9ca3af", background: active ? "#111827" : "white", marginTop: 2, flexShrink: 0 };
}

function pill(activeBg: boolean): React.CSSProperties {
  return {
    marginLeft: 8,
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: activeBg ? "white" : "white",
    color: "#111827",
    fontSize: 11,
    fontWeight: 950,
  };
}

function hint(): React.CSSProperties { return { marginTop: 12, color: "#6b7280", fontSize: 12.5, lineHeight: 1.45 }; }

function previewCard(): React.CSSProperties { return { borderRadius: 14, border: "1px solid #e5e7eb", background: "#f9fafb", padding: 12 }; }
function imgWrap(): React.CSSProperties { return { width: "100%", borderRadius: 14, border: "1px solid #e5e7eb", background: "white", overflow: "hidden" }; }
function img(): React.CSSProperties { return { width: "100%", height: "auto", display: "block" }; }

function dividerLine(): React.CSSProperties {
  return { height: 1, background: "#e5e7eb", margin: "14px 0" };
}

function toggleRow(): React.CSSProperties {
  return { display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", padding: 12, border: "1px solid #e5e7eb", borderRadius: 14, background: "white" };
}

function switchBtn(on: boolean, disabled: boolean): React.CSSProperties {
  return {
    width: 48,
    height: 28,
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: disabled ? "#e5e7eb" : on ? "#111827" : "#9ca3af",
    cursor: disabled ? "not-allowed" : "pointer",
    position: "relative",
    padding: 0,
  };
}

function knob(on: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: 999,
    background: "white",
    position: "absolute",
    top: 2.5,
    left: on ? 24 : 2.5,
    transition: "left 140ms ease",
  };
}