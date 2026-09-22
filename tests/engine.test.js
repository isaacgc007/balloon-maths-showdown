import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_TURN_MS,
  OPPONENT_TURN_MS,
  createMatch,
  applyShot,
  expirePlayerTurn,
  chooseOpponentShot,
  advanceRound,
  setTarget,
} from '../js/engine.js';

const question = (id, answer = 2) => ({
  id,
  type: 'addition',
  display: '1 + 1 = ?',
  answer,
  choices: [1, 2, 3, 4],
  intact: [1, 2, 3, 4],
  limit: 20,
});

test('a wrong player shot pops one balloon and gives Pop-Bot a fresh turn', () => {
  const state = createMatch({ heroId: 'sky', limit: 20, questions: [question('a')], now: 1000 });
  const next = applyShot(state, 'player', 1, 2500);
  assert.deepEqual(next.popped, [1]);
  assert.equal(next.actor, 'opponent');
  assert.equal(next.deadline, 2500 + OPPONENT_TURN_MS);
  assert.deepEqual(next.scores, { player: 0, opponent: 0 });
});

test('a wrong opponent shot returns a fresh turn to the player', () => {
  let state = createMatch({ heroId: 'sky', limit: 20, questions: [question('a')], now: 0 });
  state = applyShot(state, 'player', 1, 10);
  state = applyShot(state, 'opponent', 3, 20);
  assert.equal(state.actor, 'player');
  assert.deepEqual(state.popped, [1, 3]);
  assert.equal(state.deadline, 20 + PLAYER_TURN_MS);
});

test('a correct shot awards one point and prevents duplicate input', () => {
  let state = createMatch({ heroId: 'sky', limit: 20, questions: [question('a')], now: 0 });
  state = applyShot(state, 'player', 2, 100);
  assert.equal(state.phase, 'round-result');
  assert.equal(state.scores.player, 1);
  const duplicate = applyShot(state, 'player', 2, 200);
  assert.equal(duplicate, state);
});

test('player timeout changes actor only after the absolute deadline', () => {
  const state = createMatch({ heroId: 'sky', limit: 20, questions: [question('a')], now: 500 });
  assert.equal(expirePlayerTurn(state, 500 + PLAYER_TURN_MS - 1), state);
  const expired = expirePlayerTurn(state, 500 + PLAYER_TURN_MS);
  assert.equal(expired.actor, 'opponent');
  assert.equal(expired.deadline, 500 + PLAYER_TURN_MS + OPPONENT_TURN_MS);
});

test('opponent only chooses from intact balloons', () => {
  let state = createMatch({ heroId: 'sky', limit: 20, questions: [question('a')], now: 0 });
  state = applyShot(state, 'player', 1, 10);
  assert.equal(chooseOpponentShot(state, () => 0), 2);
  assert.equal(chooseOpponentShot(state, () => 0.999), 4);
});

test('target selection rejects popped balloons and non-player turns', () => {
  let state = createMatch({ heroId: 'sky', limit: 20, questions: [question('a')], now: 0 });
  state = setTarget(state, 3);
  assert.equal(state.targeted, 3);
  state = applyShot(state, 'player', 3, 10);
  assert.equal(setTarget(state, 3), state);
});

test('round advance starts each question with the player and finishes the match', () => {
  const questions = [question('a'), question('b', 3)];
  let state = createMatch({ heroId: 'sky', limit: 20, questions, now: 0 });
  state = applyShot(state, 'player', 2, 10);
  state = advanceRound(state, 20);
  assert.equal(state.questionIndex, 1);
  assert.equal(state.actor, 'player');
  assert.equal(state.deadline, 20 + PLAYER_TURN_MS);
  state = applyShot(state, 'player', 3, 30);
  state = advanceRound(state, 40);
  assert.equal(state.phase, 'finished');
});

test('defensive tie starts a sudden-death question', () => {
  let state = createMatch({ heroId: 'sky', limit: 20, questions: [question('a')], now: 0 });
  state = { ...state, phase: 'round-result', scores: { player: 2, opponent: 2 } };
  const sudden = question('sudden', 4);
  state = advanceRound(state, 50, sudden);
  assert.equal(state.phase, 'playing');
  assert.equal(state.suddenDeath, true);
  assert.equal(state.questions.length, 2);
  assert.equal(state.actor, 'player');
});
