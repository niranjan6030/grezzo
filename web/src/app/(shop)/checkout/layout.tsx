import CheckoutSteps from "@/components/checkout/CheckoutSteps";

export const metadata = { title: "Checkout" };

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-10">
      <CheckoutSteps />
      {children}
    </div>
  );
}
