const test = require("node:test");
const assert = require("node:assert/strict");

test("temporary ruleset gate test", () => {
  assert.fail("Intentional temporary failure: verifying that the main ruleset blocks a failing PR.");
});
