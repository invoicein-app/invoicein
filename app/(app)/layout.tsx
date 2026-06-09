// app/(app)/layout.tsx
export const runtime = "nodejs";

import "./components/app-mobile-pages.css";
import "./components/unified-list-table.css";
import Navbar from "@/app/components/navbar";
import SubscriptionBanner from "@/app/components/subscription-banner";
import AppShell from "@/app/components/app-shell";
import FeedbackWidget from "@/app/components/feedback/feedback-widget";
import AppToaster from "@/app/components/app-toaster";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FA" }}>
      <SubscriptionBanner />
      <Navbar />
      <AppShell>{children}</AppShell>
      <FeedbackWidget />
      <AppToaster />
    </div>
  );
}