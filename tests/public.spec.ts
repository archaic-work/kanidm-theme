import { test, expect } from "@playwright/test";
import { capture, beginLogin } from "./helpers";

test("login username and password stages", async ({ page }, info) => {
  await page.goto("/ui/login");
  await expect(page.locator("#username")).toBeVisible();
  await capture(page, info, "login-username");
  await beginLogin(page, "theme_user");
  await capture(page, info, "login-password");
});

test("credential reset token entry", async ({ page }, info) => {
  await page.goto("/ui/reset");
  await expect(page.locator("#token")).toBeVisible();
  await capture(page, info, "credential-reset-entry");
});

test("signup availability", async ({ page }, info) => {
  await page.goto("/ui/signup");
  await expect(page.locator("main")).toBeVisible();
  await capture(page, info, "signup");
});

test("account recovery availability", async ({ page }, info) => {
  await page.goto("/ui/recover");
  await expect(page.locator("main")).toBeVisible();
  await capture(page, info, "recovery");
});
