import Link from "next/link";
import { Building2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { SidebarNav } from "@/components/app/sidebar-nav";

export function Sidebar({
  hostelName,
  role,
}: {
  hostelName: string;
  role: Role;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <Link href="/dashboard" className="truncate text-sm font-semibold">
          {hostelName}
        </Link>
      </div>
      <SidebarNav role={role} />
    </aside>
  );
}
