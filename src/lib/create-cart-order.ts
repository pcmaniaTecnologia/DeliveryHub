import { CollectionReference, doc, runTransaction } from 'firebase/firestore';

const pendingOrders = new Map<string, { fingerprint: string; id: string }>();

// Keep the same document ID when a checkout is retried, including after reload.
// Cart item IDs distinguish a new purchase from an intentional repeat purchase.
export async function createCartOrder(
  orders: CollectionReference,
  data: Record<string, any>,
  cartItems: { id: string }[],
) {
  const { orderDate, ...details } = data;
  const fingerprint = JSON.stringify({ items: cartItems.map(item => item.id), details });
  const storageKey = `pendingOrder:${orders.path}`;
  let reference = doc(orders);
  let saved = pendingOrders.get(storageKey);
  try {
    saved = saved || JSON.parse(sessionStorage.getItem(storageKey) || 'null');
  } catch {
    // Checkout still works when browser storage is unavailable.
  }
  if (saved?.fingerprint === fingerprint && typeof saved.id === 'string') {
    reference = doc(orders, saved.id);
  }
  const pending = { fingerprint, id: reference.id };
  pendingOrders.set(storageKey, pending);
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(pending));
  } catch {
    // The in-memory entry also protects retries without browser storage.
  }

  const created = await runTransaction(orders.firestore, async transaction => {
    const existing = await transaction.get(reference);
    if (existing.exists()) return false;
    transaction.set(reference, data);
    return true;
  });
  return { reference, created };
}
