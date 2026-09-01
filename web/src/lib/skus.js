/** SKU helpers safe to import from client components — no server imports. */
export const skuFor = (productId, colour, size) => `${productId}-${colour}-${size}`;

/** Opening depth for a SKU nobody has counted yet. Mirrors DEFAULT_DEPTH
 *  in lib/inventory, which is server-only. */
export const DEFAULT_DEPTH_CLIENT = 12;
