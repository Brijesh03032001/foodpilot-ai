import { CustomerNav } from "@/components/shell/customer-nav";
import { CustomerBottomNav } from "@/components/shell/customer-bottom-nav";

export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerNav />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <CustomerBottomNav />
    </div>
  );
}
