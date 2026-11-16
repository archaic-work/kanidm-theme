import { expect, type Page, type TestInfo } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export async function capture(page: Page, info: TestInfo, name: string) {
  const file = path.join("screenshots", info.project.name, name + ".png");
  await mkdir(path.dirname(file), { recursive: true });

  // Avoid changing values breaking every fresh-database reference image.
  // Enrolment QR codes, links and secrets are redacted in all artifacts.
  const masks = [
    page.locator("footer .text-muted"),
    page.locator("#intentInfo"),
    page.locator("td").filter({
      hasText: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    }),
  ];
  const options = {
    fullPage: true,
    animations: "disabled" as const,
    caret: "hide" as const,
    mask: masks,
  };
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, ...options });

  const basename = name + ".png";
  const baseline = info.snapshotPath(basename);
  if (existsSync(baseline) || process.env.UPDATE_BASELINES === "1") {
    // To approve references run: UPDATE_BASELINES=1 npx playwright test --update-snapshots
    await expect(page).toHaveScreenshot(basename, options);
  } else if (process.env.STRICT_VISUAL_BASELINES === "1") {
    throw new Error("Missing approved snapshot: " + baseline);
  } else {
    console.warn("No reference for " + basename + ": captured but not visually compared yet");
  }
}

export async function beginLogin(page: Page, username: string) {
  await page.goto("/ui/login");
  await expect(page.locator("#username")).toBeVisible();
  await page.locator("#username").fill(username);
  await page.getByRole("button", { name: /^Begin$/ }).click();

  if (await page.locator('input[name="mech"]').count()) {
    await page.getByRole("button", { name: /password/i }).first().click();
  }
  await expect(page.locator("form#login input#password:visible")).toBeVisible();
}

export async function signIn(page: Page, role: "user" | "admin" = "user") {
  const username = role === "user" ? "theme_user" : "idm_admin";
  const password = role === "user"
    ? process.env.KANIDM_THEME_USER_PASSWORD
    : process.env.KANIDM_THEME_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Missing fixture password for " + role + "; run ci/seed.sh");
  }
  await beginLogin(page, username);
  await page.locator("form#login input#password:visible").fill(password);
  await page.locator('form#login button[type="submit"]').click();
  await expect(page).toHaveURL(/\/ui\/apps(?:[?#]|$)/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();
}
