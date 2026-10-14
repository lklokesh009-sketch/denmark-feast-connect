export type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
  sort_order: number;
};

export type Cart = Record<string, number>;

export function cartTotal(cart: Cart, items: Pick<MenuItem, "id" | "price">[]): number {
  return items.reduce((sum, i) => sum + (cart[i.id] ?? 0) * Number(i.price), 0);
}

export function cartCount(cart: Cart): number {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}

export const formatINR = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
