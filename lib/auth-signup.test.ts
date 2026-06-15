import { describe, expect, it } from "vitest";
import { isSignUpExistingEmail, isSignUpNewAccount, hasSignUpSession } from "@/lib/auth-signup";

describe("isSignUpExistingEmail", () => {
  it("detects empty identities without error", () => {
    expect(
      isSignUpExistingEmail(
        {
          user: { identities: [] } as any,
          session: null,
        },
        null
      )
    ).toBe(true);
  });

  it("detects explicit Supabase error", () => {
    expect(
      isSignUpExistingEmail(null, {
        message: "User already registered",
        code: "user_already_exists",
      } as any)
    ).toBe(true);
  });

  it("does not flag a real new signup", () => {
    expect(
      isSignUpExistingEmail(
        {
          user: { identities: [{ id: "email" }] } as any,
          session: null,
        },
        null
      )
    ).toBe(false);
  });
});

describe("isSignUpNewAccount", () => {
  it("returns true when identities exist", () => {
    expect(
      isSignUpNewAccount({
        user: { identities: [{ id: "email" }] } as any,
        session: null,
      })
    ).toBe(true);
  });
});

describe("hasSignUpSession", () => {
  it("returns true when session is present", () => {
    expect(
      hasSignUpSession({
        user: null,
        session: { access_token: "x" } as any,
      })
    ).toBe(true);
  });
});
