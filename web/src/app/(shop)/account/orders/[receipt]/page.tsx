import OrderTracking from "@/components/OrderTracking";

export const metadata = { title: "Track order" };

export default async function Page({ params }: { params: Promise<{ receipt: string }> }) {
  const { receipt } = await params;
  return <OrderTracking receipt={receipt} />;
}
