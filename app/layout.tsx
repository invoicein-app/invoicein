// app/layout.tsx
import { SpeedInsights } from "@vercel/speed-insights/next";

export const runtime = "nodejs";

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