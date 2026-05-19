// app/(auth)/layout.tsx
export const runtime = "nodejs";

/** Full-bleed wrapper; each auth page controls its own layout (e.g. split login). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", width: "100%", margin: 0, padding: 0, boxSizing: "border-box" }}>
      {children}
    </div>
  );
}
