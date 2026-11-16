import { test, expect } from "@playwright/test";
import { capture, signIn } from "./helpers";

test("application launcher", async ({ page }, info) => {
  await signIn(page);
  await expect(page.getByText("Theme Demo Application")).toBeVisible();
  await capture(page, info, "applications");
});

test("user profile", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/ui/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await capture(page, info, "profile");
});

test("credential management", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/ui/update_credentials");
  await expect(page.getByRole("heading", { name: "Credentials" })).toBeVisible();
  await capture(page, info, "credentials");
});

test("device enrolment", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/ui/enrol");
  await expect(page.getByRole("heading", { name: "Enrol Another Device" })).toBeVisible();
  await capture(page, info, "enrol-device");
});

test("RADIUS settings", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/ui/radius");
  await expect(page.getByRole("heading", { name: "RADIUS" })).toBeVisible();
  await capture(page, info, "radius");
});
