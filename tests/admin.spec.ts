import { test, expect } from "@playwright/test";
import { capture, signIn } from "./helpers";

test("admin persons", async ({ page }, info) => {
  await signIn(page, "admin");
  await page.goto("/ui/admin/persons");
  await expect(page.getByRole("heading", { name: "Create new person" })).toBeVisible();
  await capture(page, info, "admin-persons");
});

test("admin groups", async ({ page }, info) => {
  await signIn(page, "admin");
  await page.goto("/ui/admin/groups");
  await expect(page.getByRole("heading", { name: "Create new group" })).toBeVisible();
  await capture(page, info, "admin-groups");
});
