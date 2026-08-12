import type { Metadata } from "next";
import { ReviewIntelligence } from "@/components/owner/review-intelligence";

export const metadata: Metadata = {
  title: "Review Intelligence",
  description: "Turn every review into a ranked complaint report.",
};

export default function ReviewIntelligencePage() {
  return <ReviewIntelligence />;
}
