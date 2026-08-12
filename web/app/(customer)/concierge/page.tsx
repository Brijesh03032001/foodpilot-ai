import type { Metadata } from "next";
import { Concierge } from "@/components/customer/concierge";

export const metadata: Metadata = {
  title: "Concierge",
  description: "Chat with the FoodPilot AI concierge.",
};

export default function ConciergePage() {
  return <Concierge />;
}
