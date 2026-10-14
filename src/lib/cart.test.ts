import { describe, it, expect } from "vitest";
import { cartTotal, cartCount } from "./cart";

describe("cart", () => {
  it("totals quantity times price", () => {
    expect(cartTotal({ a: 2, b: 1 }, [{ id: "a", price: 180 }, { id: "b", price: 30 }])).toBe(390);
  });
  it("counts items", () => {
    expect(cartCount({ a: 2, b: 3 })).toBe(5);
  });
});
