import { PRODUCTS } from "./products";

/** Is this offer live right now? */
export function offerActive(o, now = Date.now()) {
  if (!o.active) return false;
  if (o.startsAt && Date.parse(o.startsAt) > now) return false;
  if (o.endsAt && Date.parse(o.endsAt) < now) return false;
  return true;
}

function offerApplies(o, p) {
  switch (o.scope.type) {
    case "all":
      return true;
    case "collection":
      return p.collection === o.scope.value;
    case "product":
      return p.id === o.scope.value;
    case "fit":
      return p.fit === o.scope.value;
  }
}

function discounted(paise, o) {
  const off =
    o.kind === "percent"
      ? Math.round((paise * Math.min(Math.max(o.value, 1), 90)) / 100)
      : Math.min(o.value, paise - 100);
  return Math.max(paise - off, 100);
}

/**
 * The single place the base catalogue, the admin's overrides and live offers
 * are combined. Both the storefront and the checkout price through this, so
 * a shopper can never see one price and be charged another.
 */
export function mergeCatalogue(data, now = Date.now()) {
  const live = data.offers.filter((o) => offerActive(o, now));

  return PRODUCTS.map((base) => {
    const ov = data.products[base.id] ?? {};
    const colours = ov.colours?.length ? ov.colours : base.colours;

    // Photos ride on the colourway so the right image shows per colour.
    const withPhotos = colours.map((c) => ({ ...c, photo: ov.photos?.[c.code] ?? c.photo }));

    const merged = {
      ...base,
      name: ov.name ?? base.name,
      story: ov.story ?? base.story,
      fit: ov.fit ?? base.fit,
      rise: ov.rise ?? base.rise,
      fabric: ov.fabric ?? base.fabric,
      tags: ov.tags ?? base.tags,
      pricePaise: ov.pricePaise ?? base.pricePaise,
      comparePaise: ov.comparePaise === null ? undefined : (ov.comparePaise ?? base.comparePaise),
      colours: withPhotos,
      wash: withPhotos[0].wash,
      ramp: withPhotos[0].ramp,
      active: ov.active ?? true,
    };

    // Best offer wins — never stack, that is how margin disappears.
    let best = null;
    for (const o of live) {
      if (!offerApplies(o, merged)) continue;
      const price = discounted(merged.pricePaise, o);
      if (!best || price < best.price) best = { offer: o, price };
    }

    if (best && best.price < merged.pricePaise) {
      merged.offer = { id: best.offer.id, name: best.offer.name, wasPaise: merged.pricePaise };
      merged.comparePaise = merged.pricePaise;
      merged.pricePaise = best.price;
    }

    return merged;
  }).filter((p) => p.active !== false);
}
