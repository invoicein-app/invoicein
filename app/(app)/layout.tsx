// app/(app)/layout.tsx
export const runtime = "nodejs";

import "./components/app-mobile-pages.css";
import Navbar from "@/app/components/navbar";
import AppShell from "@/app/components/app-shell";
import FeedbackWidget from "@/app/components/feedback/feedback-widget";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FA" }}>
      <Navbar />
      <AppShell>{children}</AppShell>
      <FeedbackWidget />
    </div>
  );
}