import { describe, expect, it } from "vitest";
import {
  formatAuthErrorMessage,
  INVALID_LOGIN_CREDENTIALS_MESSAGE,
} from "@/lib/auth-error-messages";

describe("formatAuthErrorMessage", () => {
  it("maps Supabase invalid login credentials", () => {
    expect(
      formatAuthErrorMessage({ message: "Invalid login credentials", code: "invalid_credentials" })
    ).toBe(INVALID_LOGIN_CREDENTIALS_MESSAGE);
  });

  it("keeps other auth errors unchanged", () => {
    expect(formatAuthErrorMessage({ message: "Email not confirmed" })).toBe("Email not confirmed");
  });

  it("uses fallback for empty errors", () => {
    expect(formatAuthErrorMessage(null, "Gagal login.")).toBe("Gagal login.");
  });
});
