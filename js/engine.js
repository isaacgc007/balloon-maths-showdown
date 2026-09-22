export const PLAYER_TURN_MS = 20_000;
export const OPPONENT_TURN_MS = 1_000;

export const turnDuration = actor => actor === 'opponent' ? OPPONENT_TURN_MS : PLAYER_TURN_MS;

const clone = state => ({
  ...state,
  scores: { ...state.scores },
  popped: [...state.popped],
  questions: [...state.questions],
});

export function createMatch({ heroId, limit, questions, now = Date.now() }) {
  return {
    heroId,
    limit,
    questions,
    questionIndex: 0,
    scores: { player: 0, opponent: 0 },
    actor: 'player',
    deadline: now + PLAYER_TURN_MS,
    popped: [],
    targeted: questions[0].choices[0],
    phase: 'playing',
    feedback: 'Your turn! Drag your hero and choose a balloon.',
    suddenDeath: false,
  };
}

export const currentQuestion = state => state.questions[state.questionIndex];

export function setTarget(state, choice) {
  if (state.phase !== 'playing' || state.actor !== 'player') return state;
  const question = currentQuestion(state);
  if (!question.choices.includes(choice) || state.popped.includes(choice)) return state;
  return { ...state, targeted: choice };
}

export function applyShot(state, actor, choice, now = Date.now()) {
  if (state.phase !== 'playing' || state.actor !== actor || state.popped.includes(choice)) return state;
  const question = currentQuestion(state);
  if (!question.choices.includes(choice)) return state;
  const next = clone(state);

  if (choice === question.answer) {
    next.scores[actor] += 1;
    next.phase = 'round-result';
    next.deadline = null;
    next.feedback = actor === 'player'
      ? `Correct! ${choice} is the answer.`
      : `Pop-Bot found it! ${choice} is the answer.`;
    return next;
  }

  next.popped.push(choice);
  next.actor = actor === 'player' ? 'opponent' : 'player';
  next.deadline = now + turnDuration(next.actor);
  const remaining = question.choices.filter(value => !next.popped.includes(value));
  next.targeted = remaining.includes(next.targeted) ? next.targeted : remaining[0];
  next.feedback = actor === 'player'
    ? 'That balloon was not it. Pop-Bot is thinking!'
    : 'Pop-Bot missed. Your turn again!';
  return next;
}

export function expirePlayerTurn(state, now = Date.now()) {
  if (state.phase !== 'playing' || state.actor !== 'player' || now < state.deadline) return state;
  return {
    ...state,
    actor: 'opponent',
    deadline: now + OPPONENT_TURN_MS,
    feedback: 'Time is up. Pop-Bot is thinking!',
  };
}

export function chooseOpponentShot(state, random = Math.random) {
  const question = currentQuestion(state);
  const remaining = question.choices.filter(choice => !state.popped.includes(choice));
  return remaining[Math.floor(random() * remaining.length)];
}

export function advanceRound(state, now = Date.now(), suddenQuestion = null) {
  if (state.phase !== 'round-result') return state;
  const nextIndex = state.questionIndex + 1;

  if (nextIndex >= state.questions.length) {
    if (state.scores.player === state.scores.opponent && suddenQuestion) {
      return {
        ...state,
        questions: [...state.questions, suddenQuestion],
        questionIndex: nextIndex,
        actor: 'player',
        deadline: now + PLAYER_TURN_MS,
        popped: [],
        targeted: suddenQuestion.choices[0],
        phase: 'playing',
        feedback: 'Sudden death! Your turn first.',
        suddenDeath: true,
      };
    }
    return { ...state, phase: 'finished', deadline: null };
  }

  const question = state.questions[nextIndex];
  return {
    ...state,
    questionIndex: nextIndex,
    actor: 'player',
    deadline: now + PLAYER_TURN_MS,
    popped: [],
    targeted: question.choices[0],
    phase: 'playing',
    feedback: 'Your turn! Drag your hero and choose a balloon.',
  };
}
