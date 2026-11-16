import { expect, test, type Locator } from "@playwright/test";
import { capture, signIn } from "./helpers";

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "The field or attached action must be visible").not.toBeNull();
  const b = box!;
  return { left: b.x, right: b.x + b.width, top: b.y, bottom: b.y + b.height };
}

async function expectActionAtFieldEnd(field: Locator, action: Locator, stacked: boolean) {
  const input = await bounds(field);
  const button = await bounds(action);

  if (stacked) {
    // The action remains right-aligned beneath its input when the row wraps.
    expect(button.top).toBeGreaterThanOrEqual(input.bottom - 2);
    expect(Math.abs(button.right - input.right)).toBeLessThanOrEqual(3);
  } else {
    // A direct field action sits to the right, on the same row.
    expect(button.left).toBeGreaterThanOrEqual(input.right - 2);
    expect(Math.abs(button.top - input.top)).toBeLessThanOrEqual(3);
  }
}

test("person creation action follows both inputs and aligns right on phones", async ({ page }, info) => {
  await signIn(page, "admin");
  await page.goto("/ui/admin/persons");
  const form = page.locator('form[hx-post="/ui/api/admin/person/create"]');
  const first = form.locator("#add-person-name-input");
  const last = form.locator("#add-person-displayname-input");
  const action = form.locator("#add-person-button");
  await expect(first).toBeVisible();
  await expect(last).toBeVisible();
  await expect(action).toBeVisible();

  const mobile = info.project.name.startsWith("mobile-");
  await expectActionAtFieldEnd(last, action, mobile);
  if (mobile) {
    const firstBox = await bounds(first);
    const lastBox = await bounds(last);
    expect(lastBox.top).toBeGreaterThanOrEqual(firstBox.bottom - 2);
  }
  await capture(page, info, "admin-person-action-alignment");
});

test("group creation action remains attached to its input", async ({ page }, info) => {
  await signIn(page, "admin");
  await page.goto("/ui/admin/groups");
  const form = page.locator('form[hx-post="/ui/api/admin/group/create"]');
  const input = form.locator("#add-group-input");
  const action = form.locator("#add-person-button");
  await expect(input).toBeVisible();
  await expect(action).toBeVisible();
  await expectActionAtFieldEnd(input, action, false);
  await capture(page, info, "admin-group-action-alignment");

  // Even at 320px, the button remains end-aligned after stacking.
  await page.setViewportSize({ width: 320, height: 780 });
  await expectActionAtFieldEnd(input, action, true);
});

test("email Remove action follows the editable input, including at 320px", async ({ page }, info) => {
  await signIn(page);
  await page.goto("/ui/profile");

  // Normal fixture sessions are read-only. Supply a *presentation-only*
  // example of the exact upstream editable-email markup, so CSS can be
  // checked without unlocking a privileged account or changing its emails.
  await page.evaluate(() => {
    const host = document.querySelector("#emailAddresses");
    if (!host) throw new Error("Kanidm email editor container is absent");
    const fixture = document.createElement("div");
    fixture.id = "email-edit-visual-fixture";
    fixture.className = "email-entry";
    fixture.innerHTML = [
      '<div class="input-group mb-1">',
      '  <div class="input-group-text">',
      '    <input class="form-check-input mt-0" type="radio" checked aria-label="Primary email">',
      "  </div>",
      '  <input type="email" class="form-control" value="design@example.test" aria-label="Demo email">',
      '  <button type="button" class="btn btn-secondary kanidm-remove-list-entry">Remove</button>',
      "</div>",
    ].join("");
    host.appendChild(fixture);
  });

  const fixture = page.locator("#email-edit-visual-fixture");
  const input = fixture.locator('input[type="email"]');
  const action = fixture.getByRole("button", { name: "Remove" });
  await expectActionAtFieldEnd(input, action, false);
  await capture(page, info, "email-edit-layout-fixture");

  await page.setViewportSize({ width: 320, height: 780 });
  await expectActionAtFieldEnd(input, action, true);
  await capture(page, info, "email-edit-320-fixture");
});
