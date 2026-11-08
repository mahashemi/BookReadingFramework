const { test, expect } = require("@playwright/test");

const bookPath = "/Library/Book%2002%20-%20Survey%20of%20the%20Lives%20of%20the%20Infallible%20Imams";

test.describe("Book 02 attempt-first unit practice", () => {
  test("opens on the final reading unit and presents a balanced unit paper", async ({ page }) => {
    await page.goto(bookPath + "/exam_bank/unit_tests.html", { waitUntil: "networkidle" });
    await expect(page.locator("#unitTitle")).toContainText("Chapter 8, Part 2");
    await expect(page.locator(".question")).toHaveCount(12);
    await expect(page.locator(".question .tag").filter({ hasText: "MCQ" }).or(page.locator(".question .tag").filter({ hasText: "FILL" })).first()).toBeVisible();
    await expect(page.locator("#progressText")).toContainText("0 of 12");
  });

  test("requires an attempt before revealing a written model answer", async ({ page }) => {
    await page.goto(bookPath + "/exam_bank/unit_tests.html", { waitUntil: "networkidle" });
    const written = page.locator(".question:has(textarea)").first();
    await written.locator("button.reveal").click();
    await expect(written.locator(".feedback")).toContainText("Attempt this question first");
    await expect(written.locator(".answer")).toBeHidden();
    await written.locator("textarea").fill("My answer: the key point is...");
    await written.locator("button.reveal").click();
    await expect(written.locator(".answer")).toBeVisible();
  });

  test("marks objective answers and updates attempt progress", async ({ page }) => {
    await page.goto(bookPath + "/exam_bank/unit_tests.html", { waitUntil: "networkidle" });
    const objective = page.locator(".question:has(input[type=radio])").first();
    await objective.locator('input[type="radio"]').first().check();
    await page.locator("#checkObjective").click();
    await expect(page.locator("#score")).toContainText("Objective score:");
    await expect(page.locator("#progressText")).toContainText("1 of 12");
  });

  test("switches to earlier units and creates a fresh practice set", async ({ page }) => {
    await page.goto(bookPath + "/exam_bank/unit_tests.html", { waitUntil: "networkidle" });
    await page.locator("#unitNav button").filter({ hasText: "Chapter 8, Part 1" }).click();
    await expect(page.locator("#unitTitle")).toContainText("Chapter 8, Part 1");
    await page.locator("#newTest").click();
    await expect(page.locator(".question")).toHaveCount(12);
  });
});

test.describe("Book 02 attempt-first mock generator", () => {
  test("creates a mock with answer entry and objective scoring", async ({ page }) => {
    await page.goto(bookPath + "/exam_bank/full_book_exam_generator.html", { waitUntil: "networkidle" });
    await expect(page.locator(".question")).toHaveCount(11);
    await expect(page.locator(".question textarea").first()).toBeVisible();
    await expect(page.locator(".question .answer").first()).toBeHidden();
    await expect(page.locator("button", { hasText: "Mark objective answers" })).toBeVisible();
  });

  test("latest-three-unit mock is scoped to the last three reading units", async ({ page }) => {
    await page.goto(bookPath + "/exam_bank/full_book_exam_generator.html", { waitUntil: "networkidle" });
    await page.locator("button", { hasText: "Last 3 units" }).click();
    await expect(page.locator(".paper h2")).toContainText("Latest Three Units");
    await expect(page.locator(".question")).toHaveCount(11);
  });
});
