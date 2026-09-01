import { AdminProvider } from "@/components/admin/AdminProvider";
import AdminShell from "@/components/admin/AdminShell";

export const metadata = {
  title: { default: "Console · GREZZO", template: "%s · Grezzo Console" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
