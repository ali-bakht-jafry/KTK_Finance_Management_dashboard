"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DoorOpen,
  LayoutDashboard,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { can, PERMISSIONS, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: LucideIcon; permission: Permission };
type NavSection = { title: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: PERMISSIONS.dashboard },
      { label: "Residents", href: "/residents", icon: Users, permission: PERMISSIONS.manageResidents },
    ],
  },
  {
    title: "Hostel",
    items: [
      { label: "Rooms & beds", href: "/rooms", icon: DoorOpen, permission: PERMISSIONS.manageStructure },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payments", href: "/payments", icon: Wallet, permission: PERMISSIONS.manageFinance },
      { label: "Money due", href: "/dues", icon: Wallet, permission: PERMISSIONS.viewDues },
    ],
  },
];

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((section) => {
        const items = section.items.filter((i) => can(role, i.permission));
        if (items.length === 0) return null;
        return (
          <div key={section.title}>
            <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
