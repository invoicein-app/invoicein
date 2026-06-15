import type { AuthError, Session, User } from "@supabase/supabase-js";

export type SignUpAuthData = {
  user: User | null;
  session: Session | null;
};

export const SIGNUP_EXISTING_EMAIL_MESSAGE =
  "Email ini sudah terdaftar. Silakan masuk menggunakan akun tersebut atau gunakan fitur lupa password.";

export const SIGNUP_CONFIRM_EMAIL_MESSAGE =
  "Daftar berhasil. Silakan cek email untuk konfirmasi akun, lalu masuk untuk mengaktifkan organisasi dan trial.";

function errorLooksLikeExistingEmail(error: AuthError | null | undefined): boolean {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = String(error.code || "").toLowerCase();
  return (
    code.includes("user_already_exists") ||
    code.includes("email_exists") ||
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("user already exists") ||
    msg.includes("email address is already registered")
  );
}

/** Supabase may return a user with empty identities when email is already registered. */
export function isSignUpExistingEmail(
  data: SignUpAuthData | null | undefined,
  error: AuthError | null | undefined
): boolean {
  if (errorLooksLikeExistingEmail(error)) return true;

  const user = data?.user;
  if (!user) return false;

  const identities = user.identities;
  return Array.isArray(identities) && identities.length === 0;
}

export function isSignUpNewAccount(data: SignUpAuthData | null | undefined): boolean {
  const user = data?.user;
  if (!user) return false;
  const identities = user.identities;
  return Array.isArray(identities) && identities.length > 0;
}

export function hasSignUpSession(data: SignUpAuthData | null | undefined): boolean {
  return Boolean(data?.session);
}
