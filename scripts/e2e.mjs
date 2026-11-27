/**
 * End-to-end smoke test driven through a real browser.
 *
 * Covers the flows a person actually performs: signing in as each role, the
 * quick +/- control, add/edit/delete, search and filters, and the redirect a
 * viewer gets when they type an admin URL.
 *
 *   npm run build && npm run start   # in one terminal
 *   npm run test:e2e                 # in another
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import nextEnv from "@next/env";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ADMIN = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
const VIEWER = { email: process.env.VIEWER_EMAIL, password: process.env.VIEWER_PASSWORD };

const passed = [];
const failed = [];

/** A genuine 2x2 PNG, used to exercise the photo upload path. */
const FIXTURE_DIR = mkdtempSync(path.join(tmpdir(), "drawer-e2e-"));
const FIXTURE_PNG = path.join(FIXTURE_DIR, "item.png");
writeFileSync(
  FIXTURE_PNG,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAF0lEQVR42mP8z8BQz0AEYBxVSF+FAAsuBRUZOwYRAAAAAElFTkSuQmCC",
    "base64",
  ),
);

function check(name, ok, detail = "") {
  (ok ? passed : failed).push(name);
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
}

async function signIn(page, { email, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

/**
 * Visible text of the main region.
 *
 * `body.textContent` is not usable for this: Next.js inlines the RSC payload
 * into <script> tags, so the serialised name of every item shows up in it even
 * when the item is filtered out of the UI. Stripping scripts first means an
 * "is not shown" assertion tests what the user actually sees.
 */
async function mainText(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const clone = main.cloneNode(true);
    for (const node of clone.querySelectorAll("script, style, template")) node.remove();
    return clone.textContent;
  });
}

/** Names of the item cards currently rendered. */
async function visibleItemNames(page) {
  return page.$$eval("article h3", (nodes) => nodes.map((node) => node.textContent.trim()));
}

/** Names of the rows on the categories page. */
async function visibleCategoryNames(page) {
  return page.$$eval("main ul li p:first-child", (nodes) =>
    nodes.map((node) => node.textContent.trim()),
  );
}

/** Reads the number shown inside a card's quantity control. */
async function quantityOf(page, itemName) {
  const output = page.getByLabel(`${itemName} quantity`).first();
  return Number((await output.textContent()).trim());
}

const browser = await chromium.launch();

try {
  // -------------------------------------------------------------------------
  console.log("\n--- AUTHENTICATION ---");
  // -------------------------------------------------------------------------
  {
    const page = await browser.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    check("signed-out user is redirected to /login", page.url().includes("/login"), page.url());

    await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
    check(
      "redirect remembers the requested page",
      page.url().includes("next=%2Finventory"),
      page.url(),
    );

    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForSelector('[role="alert"]', { timeout: 10000 });
    check("wrong password shows an error and does not sign in", page.url().includes("/login"));
    await page.close();
  }

  // -------------------------------------------------------------------------
  console.log("\n--- VIEWER: READ ONLY ---");
  // -------------------------------------------------------------------------
  {
    const page = await browser.newPage();
    await signIn(page, VIEWER);
    check("viewer signs in and lands on the dashboard", page.url().endsWith("/dashboard"));

    // Still on the dashboard here, which lists items as rows rather than cards.
    const dashboardText = await mainText(page);
    check(
      "viewer sees the inventory",
      dashboardText.includes("Biscuits") && dashboardText.includes("Maggi"),
    );
    check("viewer sees no Activity nav link", !(await page.getByRole("link", { name: "Activity" }).count()));
    check("viewer sees no Recently updated card", !dashboardText.includes("Recently updated"));
    check("viewer sees no Categories nav link", !(await page.getByRole("link", { name: "Categories" }).count()));
    check("viewer sees no Settings nav link", !(await page.getByRole("link", { name: "Settings" }).count()));
    check("viewer sees no Add item button", !(await page.getByRole("button", { name: "Add item" }).count()));

    await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
    // Inventory is a read-only catalogue for everyone: name, quantity, status.
    check("inventory cards carry no minus button", !(await page.getByLabel("Use one Biscuits").count()));
    check("inventory cards carry no plus button", !(await page.getByLabel("Add one Biscuits").count()));
    check("viewer has no edit buttons", !(await page.getByLabel("Edit Biscuits").count()));
    check("viewer has no delete buttons", !(await page.getByLabel("Delete Biscuits").count()));

    // Deducting happens on the dashboard. A viewer eats the snacks, so they may
    // record what they used - but only downwards.
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    check("viewer HAS the minus button on the dashboard", (await page.getByLabel("Use one Biscuits").count()) > 0);
    check("viewer has no plus button on the dashboard", !(await page.getByLabel("Add one Biscuits").count()));

    const viewerBefore = await quantityOf(page, "Biscuits");
    await page.getByLabel("Use one Biscuits").first().click();
    await page.waitForFunction(
      (expected) => {
        const el = document.querySelector('[aria-label="Biscuits quantity"]');
        return el && Number(el.textContent.trim()) === expected;
      },
      viewerBefore - 1,
      { timeout: 10000 },
    );
    await page.reload({ waitUntil: "networkidle" });
    check(
      "a viewer's deduction is really saved",
      (await quantityOf(page, "Biscuits")) === viewerBefore - 1,
    );

    // The important one: typing an admin URL directly must not get through.
    await page.goto(`${BASE}/categories`, { waitUntil: "networkidle" });
    check("viewer typing /categories is redirected to the dashboard", page.url().endsWith("/dashboard"), page.url());

    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
    check("viewer typing /settings is redirected to the dashboard", page.url().endsWith("/dashboard"), page.url());

    await page.goto(`${BASE}/activity`, { waitUntil: "networkidle" });
    check("viewer typing /activity is redirected to the dashboard", page.url().endsWith("/dashboard"), page.url());
    await page.close();
  }

  // -------------------------------------------------------------------------
  console.log("\n--- ADMIN: QUICK QUANTITY CONTROLS ---");
  // -------------------------------------------------------------------------
  const page = await browser.newPage();
  await signIn(page, ADMIN);
  check("admin signs in and lands on the dashboard", page.url().endsWith("/dashboard"));
  check("admin sees the Categories nav link", (await page.getByRole("link", { name: "Categories" }).count()) > 0);
  check("admin sees the Settings nav link", (await page.getByRole("link", { name: "Settings" }).count()) > 0);

  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });

  const before = await quantityOf(page, "Biscuits");
  await page.getByLabel("Use one Biscuits").first().click();
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelector('[aria-label="Biscuits quantity"]');
      return el && Number(el.textContent.trim()) === expected;
    },
    before - 1,
    { timeout: 5000 },
  );
  check(`minus decrements without a reload (${before} -> ${before - 1})`, true);

  await page.getByLabel("Add one Biscuits").first().click();
  await page.waitForFunction(
    (expected) => {
      const el = document.querySelector('[aria-label="Biscuits quantity"]');
      return el && Number(el.textContent.trim()) === expected;
    },
    before,
    { timeout: 5000 },
  );
  check(`plus increments without a reload (${before - 1} -> ${before})`, true);

  // The card updates optimistically, so wait for the write to actually land
  // before reloading, or the reload races the in-flight request.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  const afterReload = await quantityOf(page, "Biscuits");
  check("quantity persisted across a reload", afterReload === before, `got ${afterReload}, expected ${before}`);

  // Chocolate starts at 1: take it to 0 and confirm it moves to Finished.
  await page.getByLabel("Use one Chocolate").first().click();
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[aria-label="Chocolate quantity"]');
      return el && Number(el.textContent.trim()) === 0;
    },
    null,
    { timeout: 5000 },
  );
  await page.waitForLoadState("networkidle");
  check("reaching 0 shows Finished on the card", (await mainText(page)).includes("Finished"));
  check(
    "minus is disabled at zero, so quantity cannot go negative",
    await page.getByLabel("Use one Chocolate").first().isDisabled(),
  );

  await page.getByLabel("Add one Chocolate").first().click();
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[aria-label="Chocolate quantity"]');
      return el && Number(el.textContent.trim()) === 1;
    },
    null,
    { timeout: 5000 },
  );
  check("going 0 -> 1 makes the item Available again", true);

  // -------------------------------------------------------------------------
  console.log("\n--- ADMIN: ADD / EDIT / DELETE ---");
  // -------------------------------------------------------------------------
  await page.getByRole("button", { name: "Add item" }).click();

  // Regression: the dialog used to re-run its focus effect on every render, so
  // each keystroke knocked focus out of the field -- which dismissed the
  // on-screen keyboard on phones after a single character. `fill()` sets the
  // value in one shot and cannot catch it, so type this one key by key.
  const nameField = page.getByLabel("Item name");
  await nameField.click();
  await nameField.pressSequentially("Cornflakes", { delay: 30 });
  check(
    "typing keeps focus in the name field",
    await nameField.evaluate((el) => el === document.activeElement),
  );
  check(
    "every typed character lands in the name field",
    (await nameField.inputValue()) === "Cornflakes",
    `got ${JSON.stringify(await nameField.inputValue())}`,
  );

  await page.getByLabel("Item name").fill("");
  await page.getByRole("button", { name: "Add item", exact: true }).last().click();
  check("empty name is rejected", (await page.textContent('[role="dialog"]')).includes("Item name is required"));

  await page.getByLabel("Item name").fill("E2E Test Cereal");
  await page.getByRole("spinbutton", { name: "Quantity" }).fill("-3");
  await page.getByRole("button", { name: "Add item", exact: true }).last().click();
  check("negative quantity is rejected", (await page.textContent('[role="dialog"]')).includes("Quantity cannot be negative"));

  await page.getByRole("spinbutton", { name: "Quantity" }).fill("3");
  await page.getByLabel("Unit").fill("boxes");

  // Photo upload: the same input the "Choose file" button opens.
  await page.locator('input[type="file"]:not([capture])').setInputFiles(FIXTURE_PNG);
  await page.waitForFunction(
    () => document.querySelector('[role="dialog"] img') !== null,
    null,
    { timeout: 15000 },
  );
  const uploadedSrc = await page.locator('[role="dialog"] img').first().getAttribute("src");
  check(
    "uploaded photo is stored in the item-images bucket",
    /\/storage\/v1\/object\/public\/item-images\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(
      uploadedSrc ?? "",
    ),
    String(uploadedSrc),
  );
  check(
    "the camera input requests the rear camera on mobile",
    (await page.locator('input[type="file"][capture]').getAttribute("capture")) === "environment",
  );

  await page.getByRole("button", { name: "Add item", exact: true }).last().click();
  await page.waitForSelector('[role="status"]', { timeout: 10000 });
  check("adding an item shows a success notification", (await page.textContent('[role="status"]')).includes('Added "E2E Test Cereal"'));
  check("new item appears immediately", (await visibleItemNames(page)).includes("E2E Test Cereal"));
  check(
    "the item card shows the uploaded photo",
    (await page
      .locator('article:has(h3:text-is("E2E Test Cereal")) img')
      .first()
      .getAttribute("src")) === uploadedSrc,
  );
  check(
    "the uploaded file is actually served",
    (await page.evaluate(async (u) => (await fetch(u)).status, uploadedSrc)) === 200,
  );

  await page.getByLabel("Edit E2E Test Cereal").click();
  await page.getByLabel("Item name").fill("E2E Test Muesli");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForFunction(
    () => [...document.querySelectorAll("article h3")].some((h) => h.textContent.trim() === "E2E Test Muesli"),
    null,
    { timeout: 10000 },
  );
  check("editing an item updates it in place", true);

  // -------------------------------------------------------------------------
  console.log("\n--- DROPPED CONNECTION DURING SAVE ---");
  // -------------------------------------------------------------------------
  // A phone that loses Wi-Fi mid-save (or suspends the tab while the camera is
  // open) makes the server action reject rather than resolve. The form must
  // recover and say so instead of spinning for ever with the dialog stuck.
  {
    const net = await browser.newPage();
    await signIn(net, ADMIN);
    await net.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
    await net.getByRole("button", { name: "Add item" }).first().click();
    await net.getByLabel("Item name").fill("E2E Dropped Save");
    await net.getByRole("spinbutton", { name: "Quantity" }).fill("1");

    await net.route("**/inventory", async (route) => {
      if (route.request().method() === "POST") await route.abort("connectionfailed");
      else await route.continue();
    });
    await net.getByRole("button", { name: "Add item", exact: true }).last().click();
    await net.waitForTimeout(2000);

    check(
      "a dropped save stops the spinner instead of hanging",
      !(await net.locator('[role="dialog"] [aria-busy="true"]').count()),
    );
    check(
      "a dropped save explains what happened",
      (await net.textContent('[role="dialog"]')).includes("Lost connection"),
    );
    await net.unroute("**/inventory");
    await net.close();
  }

  // -------------------------------------------------------------------------
  console.log("\n--- SEARCH AND FILTERS ---");
  // -------------------------------------------------------------------------
  const search = page.getByPlaceholder("Search inventory...");
  await search.fill("choc");
  await page.waitForTimeout(300);
  let visible = await visibleItemNames(page);
  check('searching "choc" finds Chocolate', visible.includes("Chocolate"), visible.join());
  check('searching "choc" hides Maggi', !visible.includes("Maggi"), visible.join());

  await search.fill("Snacks");
  await page.waitForTimeout(300);
  visible = await visibleItemNames(page);
  check(
    "search also matches the category name",
    visible.includes("Biscuits") && visible.includes("Peanuts") && !visible.includes("Maggi"),
    visible.join(),
  );

  await search.fill("zzzznothing");
  await page.waitForTimeout(300);
  check("a search with no matches shows the empty state", (await mainText(page)).includes("No items found"));

  await search.fill("");
  await page.getByRole("button", { name: "Finished", exact: true }).first().click();
  await page.waitForTimeout(300);
  visible = await visibleItemNames(page);
  check("Finished filter hides available items", !visible.includes("Peanuts"), visible.join());
  check(
    "Finished filter shows finished items",
    visible.includes("Chips") && visible.includes("Juice"),
    visible.join(),
  );

  await page.getByRole("button", { name: "Low stock", exact: true }).first().click();
  await page.waitForTimeout(300);
  visible = await visibleItemNames(page);
  check(
    "Low stock filter shows only nearly-empty items",
    visible.includes("Chocolate") && !visible.includes("Peanuts") && !visible.includes("Chips"),
    visible.join(),
  );

  await page.getByRole("button", { name: "All", exact: true }).first().click();
  await page.waitForTimeout(300);

  // -------------------------------------------------------------------------
  console.log("\n--- DELETE CONFIRMATION ---");
  // -------------------------------------------------------------------------
  await page.getByLabel("Delete E2E Test Muesli").click();
  check("a confirmation dialog appears first", (await page.textContent('[role="dialog"]')).includes("This action cannot be undone"));

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);
  check("cancelling keeps the item", (await visibleItemNames(page)).includes("E2E Test Muesli"));

  await page.getByLabel("Delete E2E Test Muesli").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForFunction(
    () => ![...document.querySelectorAll("article h3")].some((h) => h.textContent.trim() === "E2E Test Muesli"),
    null,
    { timeout: 10000 },
  );
  check("confirming deletes the item", true);

  await page.waitForTimeout(1000);
  check(
    // Storage answers 400 for a missing object rather than 404, so assert on
    // "no longer served" rather than on one exact status code.
    "deleting an item also removes its photo from storage",
    (await page.evaluate(async (u) => (await fetch(u)).status, uploadedSrc)) >= 400,
  );

  // -------------------------------------------------------------------------
  console.log("\n--- CATEGORIES ---");
  // -------------------------------------------------------------------------
  await page.goto(`${BASE}/categories`, { waitUntil: "networkidle" });
  check("admin can open the categories page", page.url().endsWith("/categories"));

  await page.getByRole("button", { name: "New category" }).first().click();
  await page.getByLabel("Category name").fill("E2E Spices");
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForFunction(
    () => [...document.querySelectorAll("main ul li p:first-child")].some((p) => p.textContent.trim() === "E2E Spices"),
    null,
    { timeout: 10000 },
  );
  check("creating a category works", (await visibleCategoryNames(page)).includes("E2E Spices"));

  await page.getByLabel("Rename E2E Spices").click();
  await page.getByLabel("Category name").fill("E2E Herbs");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForFunction(
    () => [...document.querySelectorAll("main ul li p:first-child")].some((p) => p.textContent.trim() === "E2E Herbs"),
    null,
    { timeout: 10000 },
  );
  check("renaming a category works", (await visibleCategoryNames(page)).includes("E2E Herbs"));

  await page.getByLabel("Delete Snacks").click();
  check(
    "deleting an in-use category offers to move the items instead",
    (await page.textContent('[role="dialog"]')).includes("Move items to"),
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);

  await page.getByLabel("Delete E2E Herbs").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForFunction(
    () => ![...document.querySelectorAll("main ul li p:first-child")].some((p) => p.textContent.trim() === "E2E Herbs"),
    null,
    { timeout: 10000 },
  );
  check("an empty category can be deleted", !(await visibleCategoryNames(page)).includes("E2E Herbs"));

  // -------------------------------------------------------------------------
  console.log("\n--- DASHBOARD AND ACTIVITY ---");
  // -------------------------------------------------------------------------
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const dashboard = await mainText(page);
  check("dashboard greets the user", /Good (morning|afternoon|evening|night)/.test(dashboard));
  check("dashboard shows the summary cards", dashboard.includes("Total items") && dashboard.includes("Low stock"));
  check("dashboard shows recent activity", dashboard.includes("Recently updated"));
  check("activity records the quantity change", dashboard.includes("Quantity changed from"));
  check("activity records the deletion", dashboard.includes("Deleted from inventory"));

  // -------------------------------------------------------------------------
  console.log("\n--- RESPONSIVE LAYOUT ---");
  // -------------------------------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  check("no horizontal overflow on a phone-sized viewport", !overflows);
  check("mobile menu button is present", (await page.getByLabel("Open menu").count()) > 0);

  await page.getByLabel("Open menu").click();
  await page.waitForTimeout(400);
  check("mobile menu opens", (await page.getByLabel("Close menu").count()) > 0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  check("desktop sidebar is visible", await page.getByRole("navigation", { name: "Main" }).first().isVisible());

  // -------------------------------------------------------------------------
  console.log("\n--- SIGN OUT ---");
  // -------------------------------------------------------------------------
  await page.getByRole("button", { name: "Logout" }).first().click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login", { timeout: 15000 });
  check("signing out returns to the login page", page.url().includes("/login"));

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("the session is really gone after signing out", page.url().includes("/login"), page.url());

  await page.close();
} finally {
  await browser.close();
}

console.log(`\n===== ${passed.length} passed, ${failed.length} failed =====`);
if (failed.length) {
  console.log("FAILED:\n  - " + failed.join("\n  - "));
  process.exit(1);
}
