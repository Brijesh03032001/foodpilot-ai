import { OwnerSidebarContent } from "@/components/shell/owner-sidebar";
import { OwnerTopbar } from "@/components/shell/owner-topbar";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Persistent petrol sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <OwnerSidebarContent />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <OwnerTopbar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
