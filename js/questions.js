export const QUESTION_TYPES = Object.freeze({
  ADD: 'addition',
  SUBTRACT: 'subtraction',
  MISSING_ADD: 'missing-addition',
  MISSING_SUBTRACT: 'missing-subtraction',
});

const TYPE_LABELS = Object.freeze({
  [QUESTION_TYPES.ADD]: 'Addition',
  [QUESTION_TYPES.SUBTRACT]: 'Subtraction',
  [QUESTION_TYPES.MISSING_ADD]: 'Missing number',
  [QUESTION_TYPES.MISSING_SUBTRACT]: 'Missing number',
});

const randomInt = (min, max, random = Math.random) =>
  Math.floor(random() * (max - min + 1)) + min;

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [copy[index], copy[swapWith]] = [copy[swapWith], copy[index]];
  }
  return copy;
}

function makeChoices(answer, limit, random) {
  const choices = new Set([answer]);
  const offsets = shuffle([-1, 1, -2, 2, -3, 3, -5, 5, -10, 10], random);

  for (const offset of offsets) {
    const candidate = answer + offset;
    if (candidate >= 0 && candidate <= limit) choices.add(candidate);
    if (choices.size === 4) break;
  }

  while (choices.size < 4) choices.add(randomInt(0, limit, random));
  return shuffle([...choices], random);
}

function makeEquation(type, limit, random) {
  if (type === QUESTION_TYPES.ADD) {
    const left = randomInt(1, Math.max(1, limit - 1), random);
    const right = randomInt(1, Math.max(1, limit - left), random);
    return { display: `${left} + ${right} = ?`, answer: left + right };
  }

  if (type === QUESTION_TYPES.SUBTRACT) {
    const left = randomInt(1, limit, random);
    const right = randomInt(0, left, random);
    return { display: `${left} − ${right} = ?`, answer: left - right };
  }

  if (type === QUESTION_TYPES.MISSING_ADD) {
    const total = randomInt(1, limit, random);
    const left = randomInt(0, total, random);
    const right = total - left;
    return random() < 0.5
      ? { display: `? + ${right} = ${total}`, answer: left }
      : { display: `${left} + ? = ${total}`, answer: right };
  }

  const minuend = randomInt(1, limit, random);
  const subtrahend = randomInt(0, minuend, random);
  const result = minuend - subtrahend;
  return random() < 0.5
    ? { display: `${minuend} − ? = ${result}`, answer: subtrahend }
    : { display: `? − ${subtrahend} = ${result}`, answer: minuend };
}

export function generateQuestion(type, limit, random = Math.random, id = crypto.randomUUID?.() ?? `${Date.now()}-${random()}`) {
  const equation = makeEquation(type, limit, random);
  const choices = makeChoices(equation.answer, limit, random);
  return {
    id,
    type,
    typeLabel: TYPE_LABELS[type],
    display: equation.display,
    answer: equation.answer,
    choices,
    intact: [...choices],
    limit,
  };
}

export function generateMatchQuestions(limit, random = Math.random) {
  const base = [
    QUESTION_TYPES.ADD,
    QUESTION_TYPES.SUBTRACT,
    QUESTION_TYPES.MISSING_ADD,
    QUESTION_TYPES.MISSING_SUBTRACT,
  ];
  const types = shuffle([...base, base[randomInt(0, base.length - 1, random)]], random);
  const used = new Set();

  return types.map((type, index) => {
    let question;
    let attempts = 0;
    do {
      question = generateQuestion(type, limit, random, `q-${index}-${attempts}`);
      attempts += 1;
    } while (used.has(question.display) && attempts < 30);
    used.add(question.display);
    return question;
  });
}

export function validateQuestion(question) {
  if (!Object.values(QUESTION_TYPES).includes(question.type)) return false;
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > question.limit) return false;
  if (question.choices.length !== 4 || new Set(question.choices).size !== 4) return false;
  if (!question.choices.includes(question.answer)) return false;
  return question.intact.length === 4 && question.intact.every(choice => question.choices.includes(choice));
}
