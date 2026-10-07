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
    await page.locator("#nodes .node.unit").nth(1).click();
    await page.locator("#nodes .node.concept").first().click();
    await expect(page.locator("#nodes .node.unit")).toHaveCount(15);
    await page.locator("#nodes .node.unit").last().click();
    await expect.poll(() => page.locator("#nodes .node.concept").count()).toBeGreaterThan(4);
    expect(errors).toEqual([]);
  });
});
