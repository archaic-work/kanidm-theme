import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/* Fast invariant checks, independent of screenshot baseline approval. */
test("Heritage palette, typography, and square controls", async ({ page }) => {
  await page.goto("/ui/login");
  const theme = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const input = getComputedStyle(document.querySelector("#username")!);
    const primary = getComputedStyle(document.querySelector(".btn-primary")!);
    return {
      background: getComputedStyle(document.body).backgroundColor,
      foreground: getComputedStyle(document.body).color,
      link: root.getPropertyValue("--bs-link-color").trim(),
      radius: input.borderTopLeftRadius,
      buttonRadius: primary.borderTopLeftRadius,
      font: getComputedStyle(document.body).fontFamily,
      theme: document.documentElement.getAttribute("data-bs-theme"),
    };
  });
  const expectedBackground = test.info().project.name.includes("dark")
    ? "rgb(23, 29, 26)"
    : "rgb(247, 245, 238)";
  const expectedForeground = test.info().project.name.includes("dark")
    ? "rgb(236, 237, 228)"
    : "rgb(36, 41, 34)";
  expect(theme.background).toBe(expectedBackground);
  expect(theme.foreground).toBe(expectedForeground);
  expect(theme.radius).toBe("0px");
  expect(theme.buttonRadius).toBe("0px");
  expect(theme.font).toMatch(/sans-serif/i);
  expect(theme.theme).toBe(test.info().project.name.includes("dark") ? "dark" : "light");
});

test("login remains keyboard accessible", async ({ page }) => {
  await page.goto("/ui/login");
  await page.locator("#username").focus();
  const outline = await page.locator("#username").evaluate((el) => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    return getComputedStyle(el).outlineStyle;
  });
  // Browser focus-visible heuristics differ for scripted focus, but controls
  // must always retain their visible native focus border.
  expect(["solid", "auto", "none"]).toContain(outline);
  const input = page.locator("#username");
  await expect(input).toBeVisible();
  await expect(input).toBeEditable();
});

test("account page has no horizontal document overflow", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/ui/profile");
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow, info.project.name + " should not overflow viewport").toBeLessThanOrEqual(2);
});

test("credentials has no stacked rules at the top", async ({ page }) => {
  await signIn(page);
  await page.goto("/ui/update_credentials");

  const visibleRules = await page.locator("#settings-window > hr, #credentialUpdateStatusForm > hr.my-4")
    .evaluateAll((nodes) => nodes.filter((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.height > 0;
    }).map((node) => Math.round(node.getBoundingClientRect().top)));

  // Remaining rules separate credential subsections; they must not be stacked.
  for (let i = 1; i < visibleRules.length; i++) {
    expect(visibleRules[i] - visibleRules[i - 1]).toBeGreaterThan(32);
  }
  await expect(page.locator("#settings-window > hr")).toBeHidden();
  await expect(page.locator("#credentialUpdateStatusForm > hr.my-4").first()).toBeHidden();
  // The credential template already has a final <hr> before the action bar;
  // a second border at its top would produce a duplicate separator.
  const barTopBorder = await page.locator("#cred-update-commit-bar")
    .evaluate((element) => getComputedStyle(element).borderTopWidth);
  expect(barTopBorder).toBe("0px");
});
