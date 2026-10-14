const { test, expect } = require("@playwright/test");

const bookPath = "/Library/Book%2002%20-%20Survey%20of%20the%20Lives%20of%20the%20Infallible%20Imams";

test.describe("Book 02 Study Guide", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(bookPath + "/study_guide/study.html", { waitUntil: "networkidle" });
  });

  test("loads all reading units and the question bank", async ({ page }) => {
    await expect(page.locator("#title")).toContainText("A Survey into the Lives of the Infallible Imams");
    await expect(page.locator(".unit")).toHaveCount(14);
    await expect(page.locator("#tot")).not.toHaveText("0");
  });

  test("opens a unit and reveals an answer", async ({ page }) => {
    const firstUnit = page.locator(".unit").first();
    await firstUnit.locator(".uh").click();
    await expect(firstUnit).toHaveClass(/open/);
    const firstQuestion = firstUnit.locator(".q").first();
    await firstQuestion.locator(".rev").click();
    await expect(firstQuestion).toHaveClass(/open/);
    await expect(firstQuestion.locator(".ans")).toBeVisible();
  });

  test("marks a question and persists the score", async ({ page }) => {
    await page.locator(".unit").first().locator(".uh").click();
    const question = page.locator(".q").first();
    await question.locator(".n").click();
    await expect(question).toHaveClass(/done/);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".q").first()).toHaveClass(/done/);
  });

  test("theme preference persists", async ({ page }) => {
    await page.locator("button", { hasText: "Theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("Book 02 Interactive Mind Map", () => {
  test("loads and expands a unit node", async ({ page }) => {
    await page.goto(bookPath + "/mind_maps/book02_interactive.html", { waitUntil: "networkidle" });
    await expect(page.locator("#nodes .node")).toHaveCount(1);
    await page.locator("#nodes .node.root").click();
    await expect(page.locator("#nodes .node.unit")).toHaveCount(13);
    await page.locator("#nodes .node.unit").nth(1).evaluate(el => el.click());
    await expect(page.locator("#nodes .node.concept")).toHaveCount(4);
  });

  test("supports a third-level related-unit expansion without page errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(bookPath + "/mind_maps/book02_interactive.html", { waitUntil: "networkidle" });
    await page.locator("#nodes .node.root").click();
    await page.locator("#nodes .node.unit").nth(1).evaluate(el => el.click());
    await page.locator("#nodes .node.concept").first().evaluate(el => el.click());
    await expect(page.locator("#nodes .node.unit")).toHaveCount(15);
    await page.locator("#nodes .node.unit").last().evaluate(el => el.click());
    await expect.poll(() => page.locator("#nodes .node.concept").count()).toBeGreaterThan(4);
    expect(errors).toEqual([]);
  });
});


test.describe("Book 02 Counterfactual Istidlal prerequisites", () => {
  test("shows a human-readable prerequisite concept link that jumps to the concept", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/book/unit.html?book_id=book02&unit=u02", { waitUntil: "networkidle" });
    const card = page.locator(".counterfactual-card").first();
    const prerequisite = card.locator(".prerequisite a");
    await expect(prerequisite).toBeVisible();
    await expect(prerequisite).toContainText("'Uthman's assassination (the problem of hypocrisy) — Political manipulation after the killing");
    await expect(prerequisite).toHaveAttribute("href", "#concept-b02-u02-002");
    await prerequisite.click();
    await expect(page.locator("#concept-b02-u02-002")).toBeVisible();
    expect(errors).toEqual([]);
  });
});


test.describe("Book 02 Session 2 jihad and truce framework", () => {
  test("renders the source-linked decision framework only in Session 2", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/book/unit.html?book_id=book02&unit=u04", { waitUntil: "networkidle" });
    const framework = page.locator("#jihad-truce-framework");
    await expect(framework).toBeVisible();
    await expect(framework).toContainText("Follow the YES/NO branches");
    await expect(framework).toContainText("genuine public interest in a truce");
    await expect(framework).toContainText("IMAM AL-HASAN · DARK GREEN");
    await expect(framework).toContainText("IMAM AL-HUSAYN · BLOOD RED");
    await expect(framework.locator("a[href^=\"#concept-b02-u04-\"]")).toHaveCount(7);
    await expect(framework.locator("svg .jf-node-question")).toHaveCount(7);
    await expect(framework.locator("svg .jf-route-hasan path")).toHaveCount(7);
    await expect(framework.locator("svg .jf-route-husayn path")).toHaveCount(4);
    await expect(framework.locator("svg .jf-node-leaf")).toHaveCount(10);
    await page.goto("/book/unit.html?book_id=book02&unit=u03", { waitUntil: "networkidle" });
    await expect(page.locator("#jihad-truce-framework")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("Session 2 reader questions use natural language and source-linked reasoning", async ({ page }) => {
    await page.goto("/book/unit.html?book_id=book02&unit=u04", { waitUntil: "networkidle" });
    const cards = page.locator(".counterfactual-card");
    await expect(cards).toHaveCount(6);
    await expect(cards.first()).toContainText("Why does Mutahhari insist that we compare the circumstances");
    await expect(cards.nth(3)).toContainText("Why does the demand that al-Husayn pledge allegiance");
    await cards.nth(1).locator("details summary").click();
    await expect(cards.nth(1).locator("details a[href^=\"https://\"]").first()).toHaveAttribute("href", "https://quran.com/4/135");
  });
});
