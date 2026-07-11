"use strict";

const assert = require("node:assert/strict");
const Core = require("../core.js");

assert.equal(Core.DEFAULTS.language, "en");
assert.equal(Core.FIXED_FOOTER, "View your BCH tip at tipbot.cash");
assert.equal(Core.normalizeLanguage("ES"), "es");
assert.equal(Core.normalizeLanguage("fr"), "en");
assert.equal(Core.normalizeHandle("@@AlanM1989bch_"), "AlanM1989bch_");
assert.equal(Core.normalizeHandle(" bad-name! "), "badname");
assert.deepEqual(Core.parseStatusPath("https://x.com/AlanM1989bch_/status/2075675648165572944"), {
  username: "AlanM1989bch_",
  statusId: "2075675648165572944"
});
assert.equal(Core.parseStatusPath("/home"), null);
assert.equal(Core.normalizeAmount("0,00100000"), "0.001");
assert.equal(Core.normalizeAmount("0"), null);
assert.equal(Core.normalizeAmount("1e-4"), null);
assert.equal(Core.normalizeAmount("0.000000001"), null);
assert.equal(
  Core.buildCommand(Core.DEFAULTS, "AlanM1989bch_", "0.001"),
  "@bchtip tip @AlanM1989bch_ 0.001 BCH\n\nView your BCH tip at tipbot.cash"
);
assert.deepEqual(Core.parsePresets("0.0001, 0.001 0.001;0.005"), ["0.0001", "0.001", "0.005"]);

console.log("Todos los tests de core.js pasaron.");
