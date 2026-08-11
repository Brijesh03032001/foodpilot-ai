import type { Metadata } from "next";
import { OrderBuilder } from "@/components/customer/order-builder";

export const metadata: Metadata = {
  title: "Order Builder",
  description: "Turn a messy request into a validated, priced order.",
};

export default function OrderPage() {
  return <OrderBuilder />;
}
