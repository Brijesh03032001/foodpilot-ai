import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** FoodPilot wordmark with the food-truck logo mark. */
export function Logo({
  href = "/",
  className,
  onDark = false,
}: {
  href?: string;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2", className)}
      aria-label="FoodPilot home"
    >
      <span className="relative transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[-4deg]">
        <Image
          src="/images/logo.png"
          alt="FoodPilot"
          width={80}
          height={64}
          priority
          className="h-9 w-auto object-contain drop-shadow-[0_4px_10px_rgba(18,60,74,0.18)]"
        />
      </span>
      <span
        className={cn(
          "text-[19px] font-extrabold tracking-tight",
          onDark ? "text-white" : "text-petrol",
        )}
      >
        Food<span className="text-tangerine">Pilot</span>
      </span>
    </Link>
  );
}
