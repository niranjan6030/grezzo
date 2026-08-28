import FavouritesView from "@/components/FavouritesView";
import Recommendations from "@/components/Recommendations";

export const metadata = { title: "Favourites" };

export default function FavouritesPage() {
  return (
    <>
      <FavouritesView />
      <Recommendations title="Based on your favourites" />
    </>
  );
}
