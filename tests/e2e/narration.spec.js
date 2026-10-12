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


test("long audiobook narration is queued in multiple speech-safe segments", async ({ page }) => {
  await page.addInitScript(() => {
    window.__narrationSpoken = [];
    window.SpeechSynthesisUtterance = function(text) { this.text = text; };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak(utterance) { window.__narrationSpoken.push(utterance.text); },
        cancel() {}
      }
    });
  });
  await page.goto("/book/unit.html?book_id=book02&unit=u12", { waitUntil: "networkidle" });
  const narration = page.locator(".listen-learn");
  await expect(narration).toBeVisible();
  await narration.getByRole("button", { name: "▶ Listen & Learn" }).click();
  const segments = await page.evaluate(() => window.__narrationSpoken);
  expect(segments.length).toBeGreaterThan(1);
  expect(segments.join(" ")).not.toContain("b02-u12-");
  expect(segments.join(" ")).not.toContain("Source map");
});


test("changing the selected unit stops old speech and replaces the narration panel", async ({ page }) => {
  await page.addInitScript(() => {
    window.__cancelCount = 0;
    window.SpeechSynthesisUtterance = function(text) { this.text = text; };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak() {}, cancel() { window.__cancelCount += 1; } } });
  });
  await page.goto("/book/unit.html?book_id=book02&unit=u02", { waitUntil: "networkidle" });
  await expect(page.locator(".listen-learn")).toContainText("Chapter 1");
  await page.evaluate(() => {
    const url = new URL(location.href); url.searchParams.set("unit", "u03"); history.pushState({}, "", url);
    document.querySelector(".unit-hero")?.remove();
    const hero = document.createElement("section"); hero.className = "unit-hero"; hero.innerHTML = "<h1>Chapter 2</h1>";
    document.querySelector("#app").prepend(hero);
  });
  await expect(page.locator(".listen-learn")).toContainText("Chapter 2");
  await expect(page.locator(".listen-learn")).not.toContainText("Chapter 1");
  expect(await page.evaluate(() => window.__cancelCount)).toBeGreaterThan(0);
});
