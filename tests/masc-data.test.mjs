import { test } from "node:test";
import assert from "node:assert/strict";
import { AGES, POS, SECT, CRITERIA, SCORE_VALUES, categoryRawScore, isEvaluationComplete, scoreToGrade } from "../js/masc-data.js";

test("categoryRawScore: 40% core + 20% each of three support items", () => {
  assert.equal(categoryRawScore([9, 9, 9, 9]), 0.4 * 9 + 0.2 * 27);
  assert.ok(Math.abs(categoryRawScore([1, 1, 1, 1]) - 1) < 1e-9);
  assert.ok(Math.abs(categoryRawScore([7, 3, 3, 3]) - (2.8 + 1.8)) < 1e-9);
});

test("categoryRawScore: null unless all four items are scored", () => {
  assert.equal(categoryRawScore(null), null);
  assert.equal(categoryRawScore(undefined), null);
  assert.equal(categoryRawScore([9, 9, 9, null]), null);
  assert.equal(categoryRawScore([9, 9, 9, undefined]), null);
  assert.equal(categoryRawScore([null, null, null, null]), null);
});

test("isEvaluationComplete: needs all 4 categories fully scored; tolerates missing data", () => {
  const full = [1, 3, 7, 9];
  const all = { M: full, A: full, S: full, C: full };
  assert.equal(isEvaluationComplete({ scores: all }), true);
  assert.equal(isEvaluationComplete({ scores: { ...all, C: [1, 3, 7, null] } }), false);
  assert.equal(isEvaluationComplete({ scores: { ...all, C: undefined } }), false);
  assert.equal(isEvaluationComplete({ scores: { M: full, A: full, S: full } }), false);
  assert.equal(isEvaluationComplete({ scores: {} }), false);
  assert.equal(isEvaluationComplete({}), false);
  assert.equal(isEvaluationComplete(null), false);
  assert.equal(isEvaluationComplete(undefined), false);
});

test("scoreToGrade: boundaries are inclusive at the upper end (2, 5, 8)", () => {
  assert.equal(scoreToGrade(null), null);
  assert.equal(scoreToGrade(1), 1);
  assert.equal(scoreToGrade(2.0), 1);
  assert.equal(scoreToGrade(2.01), 3);
  assert.equal(scoreToGrade(5.0), 3);
  assert.equal(scoreToGrade(5.01), 7);
  assert.equal(scoreToGrade(8.0), 7);
  assert.equal(scoreToGrade(8.01), 9);
  assert.equal(scoreToGrade(9), 9);
});

test("every allowed score value maps to a grade equal to itself", () => {
  for (const v of SCORE_VALUES) assert.equal(scoreToGrade(categoryRawScore([v, v, v, v])), v);
});

test("CRITERIA covers every position x age bracket x category with four [th, en] items", () => {
  for (const pos of Object.keys(POS)) {
    assert.ok(CRITERIA[pos], `missing position ${pos}`);
    for (const age of Object.keys(AGES)) {
      assert.ok(CRITERIA[pos][age], `missing ${pos} / ${age}`);
      for (const cat of Object.keys(SECT)) {
        const items = CRITERIA[pos][age][cat];
        assert.ok(Array.isArray(items) && items.length === 4, `${pos} / ${age} / ${cat} must have 4 items`);
        for (const item of items) {
          assert.ok(Array.isArray(item) && item.length === 2 && item.every((s) => typeof s === "string" && s.length > 0),
            `${pos} / ${age} / ${cat} has a malformed item`);
        }
      }
    }
  }
});
