import { describe, expect, it } from "vitest";
import {
  buildManualItemSearchHaystack,
  buildProductSearchHaystack,
  itemKeyToSearchText,
  manualItemMatchesItemSearch,
  matchesItemSearch,
  normalizeItemSearchText,
  productMatchesItemSearch,
} from "@/lib/item-search";

const SAMPLE_PRODUCT = {
  name: "veneer jati b panjang 240 up",
  sku: "VJB240",
  unit: "lembar",
};

describe("normalizeItemSearchText", () => {
  it("lowercases, trims, and collapses spaces", () => {
    expect(normalizeItemSearchText("  B   Panjang  ")).toBe("b panjang");
  });
});

describe("matchesItemSearch", () => {
  const haystack = buildProductSearchHaystack(SAMPLE_PRODUCT);

  it("matches full item name", () => {
    expect(matchesItemSearch(haystack, "veneer jati b panjang 240 up")).toBe(true);
  });

  it("matches middle phrase", () => {
    expect(matchesItemSearch(haystack, "b panjang")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesItemSearch(haystack, "JATI B")).toBe(true);
  });

  it("tolerates extra spaces in query", () => {
    expect(matchesItemSearch(haystack, "  b   panjang ")).toBe(true);
  });

  it("matches non-consecutive tokens", () => {
    expect(matchesItemSearch(haystack, "jati 240")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesItemSearch(haystack, "meranti")).toBe(false);
  });
});

describe("productMatchesItemSearch", () => {
  it("searches name, sku, and unit", () => {
    expect(productMatchesItemSearch(SAMPLE_PRODUCT, "vjb240")).toBe(true);
    expect(productMatchesItemSearch(SAMPLE_PRODUCT, "lembar")).toBe(true);
  });
});

describe("manualItemMatchesItemSearch", () => {
  it("matches display name and hyphenated item key", () => {
    const manual = {
      display_name: "veneer jati b panjang 240 up",
      item_key: "veneer-jati-b-panjang-240-up",
    };

    expect(manualItemMatchesItemSearch(manual, "b panjang")).toBe(true);
    expect(buildManualItemSearchHaystack(manual)).toContain("b panjang");
    expect(itemKeyToSearchText("veneer-jati-b-panjang-240-up")).toBe(
      "veneer jati b panjang 240 up"
    );
  });
});
