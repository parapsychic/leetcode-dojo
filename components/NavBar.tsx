"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ListChecks, MessageSquareCode, GraduationCap, Compass } from "lucide-react";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sheet", label: "Sheet", icon: ListChecks },
  { href: "/interview", label: "Interview", icon: MessageSquareCode },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/discover", label: "Discover", icon: Compass },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/20 text-accent">⛓️</span>
          <span>
            dx <span className="text-accent">dbye</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:bg-card hover:text-foreground",
                )}
              >
                <Icon size={15} />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
