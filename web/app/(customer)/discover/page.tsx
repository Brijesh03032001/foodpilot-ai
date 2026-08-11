import type { Metadata } from "next";
import { Discover } from "@/components/customer/discover";

export const metadata: Metadata = {
  title: "Discover",
  description: "Find food trucks and dishes in plain language.",
};

export default function DiscoverPage() {
  return <Discover />;
}
