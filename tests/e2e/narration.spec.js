const { test, expect } = require("@playwright/test");

test("Listen & Learn transcript omits source maps and presents natural section transitions", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/book/unit.html?book_id=book02&unit=u03", { waitUntil: "networkidle" });

  const narration = page.locator(".listen-learn");
  await expect(narration).toBeVisible();
  await narration.getByRole("button", { name: "Show transcript" }).click();

  const transcript = narration.locator(".narration-body");
  await expect(transcript).toBeVisible();
  await expect(transcript).toContainText("A broader point to consider.");
  await expect(transcript).toContainText("Now, pause and reflect.");
  await expect(transcript).toContainText("As we move forward, keep this question in mind.");
  await expect(transcript).not.toContainText("Source map");
  await expect(transcript).not.toContainText(/b02-u03-\d{3}/);
  await expect(transcript).not.toContainText("## Narration");
  expect(errors).toEqual([]);
});


test("Persian Book 03 narration excludes its Persian source map and redundant editorial headings", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/book/unit.html?book_id=book03&unit=u18", { waitUntil: "networkidle" });

  const narration = page.locator(".listen-learn");
  await expect(narration).toBeVisible();
  await narration.getByRole("button", { name: "Show transcript" }).click();

  const transcript = narration.locator(".narration-body");
  await expect(transcript).toBeVisible();
  await expect(transcript).toContainText("نماز شب");
  await expect(transcript).not.toContainText("نقشه منبع");
  await expect(transcript).not.toContainText("b03-u18-");
  await expect(transcript).not.toContainText("عنوان شنیداری");
  expect(errors).toEqual([]);
});
