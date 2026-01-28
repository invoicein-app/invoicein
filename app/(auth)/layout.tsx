// app/(auth)/layout.tsx
export const runtime = "nodejs";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f7f9" }}>
      {children}
    </div>
  );
}