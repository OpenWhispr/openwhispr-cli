import test from "node:test";
import assert from "node:assert/strict";
import { selectLocalBackend } from "../../dist/backends/selector.js";

test("selectLocalBackend rejects --remote instead of silently falling back", async () => {
  await assert.rejects(() => selectLocalBackend({ remote: true }), /--remote is not supported/);
});
