import { describe, expect, it } from "vitest";
import { customerMatchesSearch, filterCustomersForSearch } from "@/lib/customer-search";

const sample = [
  { id: "1", name: "Darni Susanti", phone: "08123456789", address: "Jakarta" },
  { id: "2", name: "Budi Hartono", phone: "08111111111", address: "Bandung" },
  { id: "3", name: "CV Maju Jaya", phone: "021999888", address: "Surabaya" },
];

describe("customerMatchesSearch", () => {
  it("matches substring in name case-insensitively", () => {
    expect(customerMatchesSearch(sample[0], "darni")).toBe(true);
    expect(customerMatchesSearch(sample[0], "SUSAN")).toBe(true);
  });

  it("does not match phone when searching by digits", () => {
    expect(customerMatchesSearch(sample[1], "811111")).toBe(false);
  });

  it("returns all when query empty via filter helper", () => {
    expect(filterCustomersForSearch(sample, "").map((c) => c.id)).toEqual(["1", "2", "3"]);
  });

  it("filters by partial name", () => {
    expect(filterCustomersForSearch(sample, "darni").map((c) => c.id)).toEqual(["1"]);
  });
});
