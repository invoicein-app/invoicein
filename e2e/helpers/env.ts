export function requireE2ECredentials():
  | { email: string; password: string }
  | null {
  const email = String(process.env.E2E_TEST_EMAIL || "").trim();
  const password = String(process.env.E2E_TEST_PASSWORD || "").trim();
  if (!email || !password) return null;
  return { email, password };
}

export function hasE2ECredentials(): boolean {
  return requireE2ECredentials() !== null;
}
