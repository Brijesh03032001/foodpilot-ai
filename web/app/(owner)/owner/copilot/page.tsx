import type { Metadata } from "next";
import { OwnerCopilot } from "@/components/owner/owner-copilot";

export const metadata: Metadata = {
  title: "Owner Copilot",
  description: "Ask your business anything — numbers fused with review themes.",
};

export default function OwnerCopilotPage() {
  return <OwnerCopilot />;
}
