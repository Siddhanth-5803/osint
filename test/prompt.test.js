import { test } from "node:test";
import assert from "node:assert/strict";
import { PERSONAS, CASE_SCHEMA, buildSystemPrompt } from "../server/prompt.js";

test("every investigator has a label, voice and speciality", () => {
  assert.deepEqual(Object.keys(PERSONAS), ["sherlock", "cupid", "aunty", "gossip", "osho"]);
  for (const [k, p] of Object.entries(PERSONAS)) {
    assert.ok(p.label && p.voice && p.focus, k);
    assert.match(buildSystemPrompt({ persona: k, spice: "spicy" }), /SPECIALITY:/);
  }
});

test("schema follows structured-output rules", () => {
  const walk = (node, path) => {
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false, path);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), path);
      for (const [k, v] of Object.entries(node.properties)) walk(v, `${path}.${k}`);
    } else if (node.type === "array") walk(node.items, `${path}[]`);
  };
  walk(CASE_SCHEMA, "case");
  assert.ok(CASE_SCHEMA.properties.focus_report);
});
