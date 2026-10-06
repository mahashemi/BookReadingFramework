const { test, expect } = require("@playwright/test");

const books = [
  {
    name: "Book 02",
    bookId: "book02",
    path: "/Library/Book%2002%20-%20Survey%20of%20the%20Lives%20of%20the%20Infallible%20Imams",
    units: Array.from({ length: 13 }, (_, i) => "u" + String(i + 1).padStart(2, "0")),
    mindMap: "/Library/Book%2002%20-%20Survey%20of%20the%20Lives%20of%20the%20Infallible%20Imams/mind_maps/book02_interactive.html"
  },
  {
    name: "Book 03",
    bookId: "book03",
    path: "/Library/Book%2003%20-%20Jihad%20al-Nafs",
    units: Array.from({ length: 25 }, (_, i) => "u" + String(i + 1).padStart(2, "0")),
    mindMap: "/Library/Book%2003%20-%20Jihad%20al-Nafs/mind_maps/book03_interactive.html"
  }
];

function attachRuntimeChecks(page) {
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push("console: " + message.text());
  });
  return errors;
}

for (const book of books) {
  test(book.name + " landing page loads learning data", async ({ page }) => {
    const errors = attachRuntimeChecks(page);
    await page.goto(book.path + "/", { waitUntil: "networkidle" });
    await expect(page.locator("body")).not.toContainText("The learning data could not be loaded");
    await expect(page.locator("#units .card.unit")).toHaveCount(book.units.length);
    expect(errors).toEqual([]);
  });

  for (const unit of book.units) {
    test(book.name + " " + unit + " renders without runtime errors", async ({ page }) => {
      const errors = attachRuntimeChecks(page);
      await page.goto(
        book.path + "/unit.html?book_id=" + book.bookId + "&unit=" + unit,
        { waitUntil: "networkidle" }
      );
      await expect(page.locator("h1")).not.toHaveText("");
      await expect(page.locator("#concepts")).toBeVisible();
      expect(await page.locator("#concepts .card.unit").count()).toBeGreaterThan(0);
      await expect(page.locator("body")).not.toContainText("The learning data could not be loaded");
      await expect(page.locator("body")).not.toContainText("undefined");
      expect(errors).toEqual([]);
    });
  }

  test(book.name + " mind map loads cleanly on a phone viewport", async ({ page }) => {
    const errors = attachRuntimeChecks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(book.mindMap, { waitUntil: "networkidle" });
    await expect(page.locator("body")).not.toContainText(/Could not load study data|Could not load/i);
    await expect(page.locator("body")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
