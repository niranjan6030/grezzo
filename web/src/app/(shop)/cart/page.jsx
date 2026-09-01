import CartView from "@/components/CartView";
import Recommendations from "@/components/Recommendations";

export const metadata = { title: "Shopping bag" };

export default function CartPage() {
  return (
    <>
      <CartView />
      <Recommendations title="Complete the wardrobe" />
    </>
  );
}
