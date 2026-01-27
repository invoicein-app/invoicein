// ===============================
// 3) FULL REPLACE: app/layout.tsx
// Hybrid shell: Navbar top + Sidebar kiri + content kanan
// ===============================
import "./globals.css";
import Navbar from "./components/navbar";
import Sidebar from "./components/sidebar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, background: "#fafafa" }}>
        <Navbar />

        <div style={shell()}>
          <div style={grid()}>
            <div style={leftCol()}>
              <Sidebar />
            </div>

            <main style={main()}>
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

function shell(): React.CSSProperties {
  return {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "14px 18px 28px",
  };
}

function grid(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: 14,
    alignItems: "start",
  };
}

function leftCol(): React.CSSProperties {
  return {
    display: "block",
  };
}

function main(): React.CSSProperties {
  return {
    minWidth: 0,
  };
}