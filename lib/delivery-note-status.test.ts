import { describe, expect, it } from "vitest";
import {
  deliveryNoteStatusBadge,
  deliveryNoteStatusLabel,
  isLegacyDraftDeliveryNote,
} from "@/lib/delivery-note-status";

describe("deliveryNoteStatusLabel", () => {
  it("shows user-friendly labels", () => {
    expect(deliveryNoteStatusLabel("posted")).toBe("TERCATAT");
    expect(deliveryNoteStatusLabel("draft")).toBe("DRAFT");
    expect(deliveryNoteStatusLabel("cancelled")).toBe("DIBATALKAN");
  });
});

describe("deliveryNoteStatusBadge", () => {
  it("marks posted as tercatat", () => {
    expect(deliveryNoteStatusBadge("posted").label).toBe("TERCATAT");
  });
});

describe("isLegacyDraftDeliveryNote", () => {
  it("detects legacy draft records", () => {
    expect(isLegacyDraftDeliveryNote("draft")).toBe(true);
    expect(isLegacyDraftDeliveryNote("posted")).toBe(false);
  });
});
