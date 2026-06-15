import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  allocateDocumentNumber,
  coerceDateOrToday,
  formatDocumentNumber,
  padSequence,
  releaseDocumentNumberAllocation,
} from "@/lib/document-numbering";

describe("coerceDateOrToday", () => {
  it("returns valid YYYY-MM-DD input unchanged", () => {
    expect(coerceDateOrToday("2026-06-15")).toBe("2026-06-15");
  });

  it("falls back to today for invalid input", () => {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, "0");
    const d = String(today.getUTCDate()).padStart(2, "0");
    expect(coerceDateOrToday("invalid")).toBe(`${y}-${m}-${d}`);
  });
});

describe("formatDocumentNumber", () => {
  it("formats invoice number with public code", () => {
    expect(
      formatDocumentNumber({
        prefix: "INV",
        publicCode: "ABC",
        documentDate: "2026-06-07",
        sequence: 12,
      })
    ).toBe("INV-ABC-20260607-0012");
  });

  it("formats invoice number without public code", () => {
    expect(
      formatDocumentNumber({
        prefix: "INV",
        publicCode: null,
        documentDate: "2026-06-07",
        sequence: 1,
      })
    ).toBe("INV-20260607-0001");
  });
});

describe("padSequence", () => {
  it("pads to 4 digits", () => {
    expect(padSequence(1)).toBe("0001");
    expect(padSequence(1234)).toBe("1234");
  });
});

const rpcMock = vi.fn();
const orgSingleMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              single: orgSingleMock,
            }),
          }),
        };
      }
      return {};
    },
    rpc: rpcMock,
  })),
}));

describe("allocateDocumentNumber + releaseDocumentNumberAllocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";

    orgSingleMock.mockResolvedValue({
      data: {
        public_document_code: "DEMO",
        invoice_prefix: "INV",
        po_prefix: "PO",
        quotation_prefix: "QUO",
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allocates formatted document number from rpc sequence", async () => {
    rpcMock.mockResolvedValueOnce({ data: 7, error: null });

    const allocation = await allocateDocumentNumber({
      orgId: "org-1",
      docType: "invoice",
      documentDate: "2026-06-07",
    });

    expect(allocation).toEqual({
      orgId: "org-1",
      docType: "invoice",
      periodKey: "2026",
      sequence: 7,
      documentNumber: "INV-DEMO-20260607-0007",
    });
    expect(rpcMock).toHaveBeenCalledWith("next_document_sequence", {
      p_org_id: "org-1",
      p_doc_type: "invoice",
      p_period_key: "2026",
    });
  });

  it("releases allocation via rpc rollback", async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null });

    const ok = await releaseDocumentNumberAllocation({
      orgId: "org-1",
      docType: "invoice",
      periodKey: "2026",
      sequence: 7,
      documentNumber: "INV-DEMO-20260607-0007",
    });

    expect(ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("release_document_sequence", {
      p_org_id: "org-1",
      p_doc_type: "invoice",
      p_period_key: "2026",
      p_sequence: 7,
    });
  });

  it("returns false when allocation is missing", async () => {
    await expect(releaseDocumentNumberAllocation(null)).resolves.toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
