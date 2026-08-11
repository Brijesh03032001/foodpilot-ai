import type { Metadata } from "next";
import { OrderReview } from "@/components/customer/order-review";

export const metadata: Metadata = {
  title: "Review & Confirm",
  description: "Approve your order before it's sent to the kitchen.",
};

export default function OrderReviewPage() {
  return <OrderReview />;
}
