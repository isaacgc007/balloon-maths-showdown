import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMatchQuestions, generateQuestion, QUESTION_TYPES, validateQuestion } from '../js/questions.js';

function seeded(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function equationIsCorrect(question) {
  const text = question.display.replace(/−/g, '-');
  let match;
  if ((match = text.match(/^(\d+) \+ (\d+) = \?$/))) return Number(match[1]) + Number(match[2]) === question.answer;
  if ((match = text.match(/^(\d+) - (\d+) = \?$/))) return Number(match[1]) - Number(match[2]) === question.answer;
  if ((match = text.match(/^\? \+ (\d+) = (\d+)$/))) return question.answer + Number(match[1]) === Number(match[2]);
  if ((match = text.match(/^(\d+) \+ \? = (\d+)$/))) return Number(match[1]) + question.answer === Number(match[2]);
  if ((match = text.match(/^(\d+) - \? = (\d+)$/))) return Number(match[1]) - question.answer === Number(match[2]);
  if ((match = text.match(/^\? - (\d+) = (\d+)$/))) return question.answer - Number(match[1]) === Number(match[2]);
  return false;
}

test('thousands of generated questions are valid at every level', () => {
  const random = seeded(42);
  for (const limit of [20, 30, 40, 50, 60]) {
    for (let index = 0; index < 3000; index += 1) {
      const type = Object.values(QUESTION_TYPES)[index % 4];
      const question = generateQuestion(type, limit, random, `${limit}-${index}`);
      assert.equal(validateQuestion(question), true);
      assert.equal(equationIsCorrect(question), true, question.display);
      assert.ok(question.choices.every(choice => choice >= 0 && choice <= limit));
    }
  }
});

test('each five-question match covers all four learning categories', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const questions = generateMatchQuestions(40, seeded(seed));
    assert.equal(questions.length, 5);
    const types = new Set(questions.map(question => question.type));
    for (const type of Object.values(QUESTION_TYPES)) assert.equal(types.has(type), true);
    assert.equal(new Set(questions.map(question => question.display)).size, 5);
  }
});
