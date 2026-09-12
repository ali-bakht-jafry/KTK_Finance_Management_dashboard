import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { Sidebar } from "@/components/app/sidebar";
import { AppHeader } from "@/components/app/header";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, hostelName] = await Promise.all([
    requireUser(),
    getSetting("hostel.name"),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar hostelName={hostelName} role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          hostelName={hostelName}
          role={user.role}
          name={user.name}
          email={user.email}
        />
        <main className="min-w-0 flex-1 p-3 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
