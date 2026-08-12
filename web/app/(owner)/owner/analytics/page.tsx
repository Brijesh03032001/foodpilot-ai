import type { Metadata } from "next";
import { SalesAnalytics } from "@/components/owner/sales-analytics";

export const metadata: Metadata = {
  title: "Sales Analytics",
  description: "A deeper slice of the numbers.",
};

export default function SalesAnalyticsPage() {
  return <SalesAnalytics />;
}
