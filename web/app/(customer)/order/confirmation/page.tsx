import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/customer/order-confirmation";

export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "Your order is on its way.",
};

export default function OrderConfirmationPage() {
  return <OrderConfirmation />;
}
