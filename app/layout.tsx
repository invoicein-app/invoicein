// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { APP_LOGO_SRC, APP_NAME } from "./components/app-brand";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Kelola stok, invoice, purchase order, surat jalan, dan pembayaran.",
  icons: {
    icon: APP_LOGO_SRC,
    apple: APP_LOGO_SRC,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}