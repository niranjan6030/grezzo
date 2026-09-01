import OrderTracking from "@/components/OrderTracking";

export const metadata = { title: "Track order" };

export default async function Page({ params }) {
  const { receipt } = await params;
  return <OrderTracking receipt={receipt} />;
}
