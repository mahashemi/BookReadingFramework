const { test, expect } = require("@playwright/test");

const books = [
  {
    name: "Book 02",
    path: "/Library/Book%2002%20-%20Survey%20of%20the%20Lives%20of%20the%20Infallible%20Imams",
    unit: "u01"
  },
  {
    name: "Book 03",
    path: "/Library/Book%2003%20-%20Jihad%20al-Nafs",
    unit: "u01"
  }
];

for (const book of books) {
  test(`${book.name} landing page loads learning data`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(book.path + "/", { waitUntil: "networkidle" });
    await expect(page.locator("body")).not.toContainText("The learning data could not be loaded");
    expect(errors).toEqual([]);
  });

  test(`${book.name} first unit renders without runtime errors`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(book.path + "/unit.html?book_id=" + (book.name === "Book 02" ? "book02" : "book03") + "&unit=" + book.unit, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).not.toHaveText("");
    await expect(page.locator("#concepts")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("The learning data could not be loaded");
    expect(errors).toEqual([]);
  });
}
