import { Suspense } from "react";
import AccountView from "@/components/AccountView";

export const metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <AccountView />
    </Suspense>
  );
}
