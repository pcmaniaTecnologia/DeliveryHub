// Products created before this setting remain available by default.
export function isProductAvailableForDelivery(product: { deliveryEnabled?: boolean }): boolean {
  return product.deliveryEnabled !== false;
}
