import { notFound } from "next/navigation";

import { readAdminData } from "@/lib/admin/store";
import { mergeCatalogue } from "@/lib/catalogue";
import ProductDetail from "@/components/ProductDetail";
import Recommendations from "@/components/Recommendations";

/* Deliberately not statically generated: prices, offers and colourways are
   all editable in the admin, and a stale build would show the wrong ones. */

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = mergeCatalogue(await readAdminData()).find((x) => x.slug === slug);
  if (!p) return { title: "Not found" };
  return {
    title: p.name,
    description: `${p.fit} fit, ${p.rise} rise, ${p.wash}. ${p.fabric}. ${p.story}`,
  };
}

export default async function ProductPage({ params, searchParams }) {
  const { slug } = await params;
  const { c } = await searchParams;
  const product = mergeCatalogue(await readAdminData()).find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <>
      <ProductDetail product={product} initialColour={c} />
      <Recommendations title="Similar cuts" exclude={[product.id]} />
    </>
  );
}
