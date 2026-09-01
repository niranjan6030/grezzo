import OrderConfirmation from "@/components/checkout/OrderConfirmation";

export const metadata = { title: "Order placed" };

export default async function Page({ params }) {
  const { receipt } = await params;
  return <OrderConfirmation receipt={receipt} />;
}
