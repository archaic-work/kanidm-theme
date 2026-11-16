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

test("Bouncer branding follows heading colors and hides the upstream footer", async ({ page }) => {
  const headingColor = test.info().project.name.includes("dark")
    ? "rgb(236, 237, 228)"
    : "rgb(36, 41, 34)";

  await page.goto("/ui/login");
  await expect(page.locator("#main.form-signin > h3")).toHaveText("archaic.work");
  await expect(page.locator("#main.form-signin > img.kanidm_logo")).toBeHidden();
  await expect(page.locator("footer.footer")).toBeHidden();

  const loginMark = await page.locator("#main.form-signin").evaluate((el) => {
    const style = getComputedStyle(el, "::before");
    return {
      content: style.content,
      color: style.backgroundColor,
      mask: style.maskImage,
      width: style.width,
    };
  });
  expect(loginMark.content).toBe('""');
  expect(loginMark.color).toBe(headingColor);
  expect(loginMark.mask).toContain("data:image/svg+xml");
  expect(loginMark.width).toBe("56px");

  await page.goto("/ui/reset");
  await expect(page.locator("#cred-reset-form center > img.kanidm_logo")).toBeHidden();
  const resetColor = await page.locator("#cred-reset-form center").evaluate(
    (el) => getComputedStyle(el, "::before").backgroundColor,
  );
  expect(resetColor).toBe(headingColor);

  await signIn(page);
  await expect(page.locator("nav.navbar a.navbar-brand > img.navbar-toggler-img")).toBeHidden();
  const navMark = await page.locator("nav.navbar a.navbar-brand").evaluate((el) => {
    const style = getComputedStyle(el, "::before");
    return { color: style.backgroundColor, mask: style.maskImage };
  });
  expect(navMark.color).toBe(headingColor);
  expect(navMark.mask).toContain("data:image/svg+xml");
});

test("Heritage type roles, title separator and primary Save semantics", async ({ page }) => {
  const dark = test.info().project.name.includes("dark");
  const primaryColor = dark ? "rgb(147, 197, 223)" : "rgb(40, 91, 120)";
  const disabledColor = dark ? "rgb(35, 43, 39)" : "rgb(237, 240, 235)";

  await page.goto("/ui/login");
  const loginRule = await page.locator("#main.form-signin").evaluate((el) => ({
    top: getComputedStyle(el).borderTopWidth,
    bottom: getComputedStyle(el.querySelector("h3")!).borderBottomWidth,
  }));
  expect(loginRule).toEqual({ top: "0px", bottom: "3px" });

  await page.goto("/ui/reset");
  const resetRule = await page.locator("#cred-reset-form center h3").evaluate(
    (el) => getComputedStyle(el).borderBottomWidth,
  );
  expect(resetRule).toBe("3px");

  await signIn(page);
  await page.goto("/ui/update_credentials");
  const typography = await page.evaluate(() => ({
    heading: getComputedStyle(document.querySelector("#settings-window h2")!).fontWeight,
    headingFamily: getComputedStyle(document.querySelector("#settings-window h2")!).fontFamily,
    proseFamily: getComputedStyle(document.querySelector(".form-cred-reset-body > div > p")!).fontFamily,
    explanatoryFamily: getComputedStyle(document.querySelector("#credentialUpdateStatusForm p")!).fontFamily,
    actionFamily: getComputedStyle(document.querySelector("#cred-update-commit-bar button")!).fontFamily,
  }));
  expect(typography.heading).toBe("500");
  expect(typography.headingFamily).toContain("sans-serif");
  expect(typography.proseFamily).toContain("serif");
  expect(typography.explanatoryFamily).toContain("serif");
  expect(typography.actionFamily).toContain("sans-serif");

  // Kanidm names this action btn-success, but its role is primary rather than
  // successful status. Check both enabled and disabled theme tokens.
  const colors = await page.locator('#cred-update-commit-bar button[hx-post="/ui/api/cu_commit"]').evaluate((el) => {
    // Resolve the inherited Bootstrap custom properties as actual colors.
    const swatch = document.createElement("span");
    swatch.style.backgroundColor = "var(--bs-btn-bg)";
    el.append(swatch);
    const normal = getComputedStyle(swatch).backgroundColor;
    swatch.style.backgroundColor = "var(--bs-btn-disabled-bg)";
    const disabled = getComputedStyle(swatch).backgroundColor;
    swatch.remove();
    return { normal, disabled };
  });
  expect(colors.normal).toBe(primaryColor);
  expect(colors.disabled).toBe(disabledColor);
});

test("admin overview row actions remain reachable at 320px", async ({ page }) => {
  await signIn(page, "admin");
  await page.setViewportSize({ width: 320, height: 800 });

  for (const [route, rows] of [
    ["/ui/admin/persons", "#persons"],
    ["/ui/admin/groups", "#groups"],
  ] as const) {
    await page.goto(route);
    const table = page.locator(`#settings-window table:has(> tbody${rows})`);
    await expect(table).toBeVisible();
    await expect(table.locator("tbody tr button").first()).toBeVisible();
    const hierarchy = await page.locator('#settings-window > nav[aria-label="breadcrumb"]').evaluate((nav) => ({
      title: Number.parseFloat(getComputedStyle(nav.querySelector('[aria-current="page"]')!).fontSize),
      section: Number.parseFloat(getComputedStyle(nav.parentElement!.querySelector("h4")!).fontSize),
      rule: getComputedStyle(nav).borderBottomWidth,
    }));
    expect(hierarchy.title).toBeGreaterThan(hierarchy.section);
    expect(hierarchy.rule).toBe("3px");

    const geometry = await table.evaluate((element) => {
      const panel = element.closest("#settings-window")! as HTMLElement;
      const actionCell = element.querySelector("tbody tr td:last-child")! as HTMLElement;
      const action = actionCell.querySelector("button")!;
      const first = action.getBoundingClientRect();
      const sticky = getComputedStyle(actionCell).position;
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      panel.scrollLeft = panel.scrollWidth;
      const scrolled = action.getBoundingClientRect();
      return { sticky, firstRight: first.right, scrolledRight: scrolled.right, viewport: innerWidth, overflow };
    });

    expect(geometry.sticky).toBe("sticky");
    expect(geometry.firstRight).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.scrolledRight).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.overflow).toBeLessThanOrEqual(2);
  }
});
