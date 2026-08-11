import type { Metadata } from "next";
import { getTruck, trucks } from "@/lib/data";
import { TruckDetail } from "@/components/customer/truck-detail";
import { TruckDetailLive } from "@/components/customer/truck-detail-live";

export function generateStaticParams() {
  return trucks.map((t) => ({ id: t.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/trucks/[id]">): Promise<Metadata> {
  const { id } = await params;
  const truck = getTruck(id);
  return {
    title: truck ? truck.name : "Truck",
    description: truck?.blurb ?? "Food truck menu and details.",
  };
}

export default async function TruckPage({ params }: PageProps<"/trucks/[id]">) {
  const { id } = await params;
  const truck = getTruck(id);
  // curated (featured) trucks render instantly; any other truck loads live
  // from the gateway so concierge links to all 107 trucks work.
  if (truck) return <TruckDetail truck={truck} />;
  return <TruckDetailLive id={id} />;
}
