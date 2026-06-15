import { describe, expect, it } from "vitest";
import { buildItemSuggestions } from "@/lib/invoice-item-suggestions";

const products = [
  {
    id: "p1",
    name: "veneer jati b panjang 240 up",
    sku: "VJB240",
    unit: "lembar",
    price: 100000,
  },
  {
    id: "p2",
    name: "veneer meranti 122",
    sku: null,
    unit: "lembar",
    price: 80000,
  },
];

const manualItems = [
  {
    item_key: "veneer-jati-b-panjang-240-up",
    display_name: "veneer jati b panjang 240 up",
    unit: "lembar",
  },
];

describe("buildItemSuggestions", () => {
  it("matches middle phrase in product names", () => {
    const results = buildItemSuggestions({
      query: "b panjang",
      products,
      manualItems: [],
      inventoryEnabled: true,
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("product");
    if (results[0].kind === "product") {
      expect(results[0].name).toBe("veneer jati b panjang 240 up");
    }
  });

  it("matches manual items when inventory is disabled", () => {
    const results = buildItemSuggestions({
      query: "240 up",
      products: [],
      manualItems,
      inventoryEnabled: false,
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("manual");
  });

  it("returns recent items when query is empty", () => {
    const results = buildItemSuggestions({
      query: "",
      products,
      manualItems,
      inventoryEnabled: false,
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
  });
});
