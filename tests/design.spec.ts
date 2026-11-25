import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";
import { execFileSync } from "node:child_process";

test("deployed tokens match canonical Heritage source", () => {
  execFileSync(process.execPath, ["ci/sync-theme.mjs", "--check"]);
});

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
    ? "rgb(0, 0, 0)"
    : "rgb(247, 245, 238)";
  const expectedForeground = test.info().project.name.includes("dark")
    ? "rgb(236, 237, 228)"
    : "rgb(36, 41, 34)";
  expect(theme.background).toBe(expectedBackground);
  expect(theme.foreground).toBe(expectedForeground);
  expect(theme.radius).toBe("0px");
  expect(theme.buttonRadius).toBe("0px");
  expect(theme.font).toBe("sans-serif");
  expect(theme.theme).toBe(test.info().project.name.includes("dark") ? "dark" : "light");
});

test("login fields and buttons retain a visible keyboard focus indicator", async ({ page }) => {
  await page.goto("/ui/login");
  const username = page.locator("#username");
  const begin = page.getByRole("button", { name: /^Begin$/ });
  const blue = test.info().project.name.includes("dark") ? "rgb(147, 197, 223)" : "rgb(40, 91, 120)";
  // Traverse with real keyboard events, not scripted focus.
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    if (await username.evaluate(el => document.activeElement === el)) break;
  }
  await expect(username).toBeFocused();
  await expect(username).toBeEditable();
  const field = await username.evaluate(el => {
    const style = getComputedStyle(el);
    return { outline: style.outlineStyle, border: style.borderColor, shadow: style.boxShadow };
  });
  expect(field.outline).toBe("none");
  expect(field.border).toBe(blue);
  expect(field.shadow).toContain(blue);
  await username.fill("theme_user");
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    if (await begin.evaluate(el => document.activeElement === el)) break;
  }
  await expect(begin).toBeFocused();
  const button = await begin.evaluate(el => {
    const style = getComputedStyle(el);
    return { outline: style.outlineStyle, color: style.outlineColor, width: style.outlineWidth };
  });
  expect(button.outline).toBe("solid");
  expect(button.color).toBe(blue);
  expect(parseFloat(button.width)).toBeGreaterThanOrEqual(2);
});

test("explicit Heritage theme overrides system and restores it when removed", async ({ page }) => {
  await page.goto("/ui/login");
  const osDark = test.info().project.name.includes("dark");
  for (const host of ["html", "body"]) {
    const target = page.locator(host);
    await target.evaluate((el, mode) => el.setAttribute("data-theme", mode), osDark ? "light" : "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", osDark ? "rgb(247, 245, 238)" : "rgb(0, 0, 0)");
    await expect(page.locator("#username")).toHaveCSS("border-color", osDark ? "rgb(93, 98, 89)" : "rgb(137, 155, 145)");
    await target.evaluate(el => el.removeAttribute("data-theme"));
    await expect(page.locator("body")).toHaveCSS("background-color", osDark ? "rgb(0, 0, 0)" : "rgb(247, 245, 238)");
  }
});

test("login fits at 200% root text size", async ({ page }) => {
  await page.goto("/ui/login");
  // Text-size simulation, not a claim of native browser zoom coverage.
  await page.locator("html").evaluate(el => el.style.fontSize = "200%");
  await expect(page.locator("#username")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Begin$/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test("application directory uses unboxed rows with one separator", async ({ page }) => {
  await signIn(page);
  const directory = page.locator("#main > main.container-lg > .row:has(.oauth2-img)");
  await expect(directory).toHaveCSS("flex-direction", "column");
  const row = directory.locator(".card:has(.oauth2-img)").first();
  await expect(row).toBeVisible();
  await expect(row).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(row).toHaveCSS("border-top-width", "0px");
  await expect(row).toHaveCSS("border-bottom-width", "1px");
  await expect(page.getByText("Theme Demo Application")).toBeVisible();
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
  const disabledColor = dark ? "rgb(16, 21, 18)" : "rgb(237, 240, 235)";

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
  expect(typography.headingFamily).toBe("sans-serif");
  expect(typography.proseFamily).toBe("sans-serif");
  expect(typography.explanatoryFamily).toBe("sans-serif");
  expect(typography.actionFamily).toBe("sans-serif");

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
    const menuIcons = page.locator("#main > main.container-xxl .list-group.side-menu img");
    expect(await menuIcons.count()).toBeGreaterThan(0);
    await expect(menuIcons.first()).toBeHidden();
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
