import { expect, test } from "@playwright/test";
import { hasE2ECredentials, requireE2ECredentials } from "./helpers/env";

test.describe("Invoice money flow", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !hasE2ECredentials(),
      "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run this flow."
    );
    testInfo.setTimeout(120_000);
  });

  test("login → create invoice → record payment", async ({ page }) => {
    const creds = requireE2ECredentials();
    if (!creds) return;

    const customerName = `E2E Customer ${Date.now()}`;
    const itemName = `E2E Item ${Date.now()}`;
    const itemPrice = 150_000;

    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill(creds.password);
    await page.getByRole("button", { name: "MASUK" }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await page.goto("/invoice/new");
    await expect(page.getByRole("heading", { name: "Invoice Baru" })).toBeVisible();

    await page.getByLabel(/Nama Customer/i).fill(customerName);

    const itemNameInput = page.locator(".inv-form-item-product input").first();
    await itemNameInput.fill(itemName);

    await page.locator(".inv-form-item-qty input").first().fill("1.5");

    const priceInput = page.locator(".inv-form-item-price input").first();
    await priceInput.fill(String(itemPrice));

    await page.getByRole("button", { name: "Simpan Invoice" }).click();

    await page.waitForURL(/\/invoice\/[0-9a-f-]{36}$/i, { timeout: 45_000 });

    const expectedTotal = 225_000;
    await expect(page.getByText(/Total Invoice/i)).toBeVisible();

    const nominalInput = page.getByPlaceholder("Rp 0");
    await nominalInput.click();
    await nominalInput.fill(String(expectedTotal));

    await page.getByRole("button", { name: "Tambah" }).click();

    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/PAID|Lunas|Terbayar/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
