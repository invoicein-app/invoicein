/** User-facing auth errors — generic wording for security. */

export const INVALID_LOGIN_CREDENTIALS_MESSAGE = "Email atau password salah";

function messageLooksLikeInvalidLogin(message: string, code: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("invalid login credentials") ||
    msg === "invalid credentials" ||
    code === "invalid_credentials"
  );
}

export function formatAuthErrorMessage(error: unknown, fallback = "Terjadi error."): string {
  if (!error) return fallback;

  if (typeof error === "string") {
    return messageLooksLikeInvalidLogin(error, "")
      ? INVALID_LOGIN_CREDENTIALS_MESSAGE
      : error.trim() || fallback;
  }

  const record = error as { message?: string; code?: string };
  const message = String(record?.message || "").trim();
  const code = String(record?.code || "").trim().toLowerCase();

  if (messageLooksLikeInvalidLogin(message, code)) {
    return INVALID_LOGIN_CREDENTIALS_MESSAGE;
  }

  return message || fallback;
}
