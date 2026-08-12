import type { Metadata } from "next";
import { OwnerDashboard } from "@/components/owner/owner-dashboard";

export const metadata: Metadata = {
  title: "Owner Dashboard",
  description: "At-a-glance business health.",
};

export default function OwnerDashboardPage() {
  return <OwnerDashboard />;
}
