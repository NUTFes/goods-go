import { AdminHeader } from "@/components/layout/admin-header";
import { requireAdminUser } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await requireAdminUser();

  return (
    <div className="min-h-dvh bg-gray-100">
      <AdminHeader userName={currentUser.name} />
      {children}
    </div>
  );
}
