import { generateMatchQuestions, generateQuestion, QUESTION_TYPES } from './questions.js';
import {
  turnDuration,
  createMatch,
  currentQuestion,
  setTarget,
  applyShot,
  expirePlayerTurn,
  chooseOpponentShot,
  advanceRound,
} from './engine.js';
import { loadSettings, saveSettings, recordBest } from './storage.js';
import { GameSound } from './sound.js';

const HEROES = Object.freeze({
  sky: { name: 'Sky', image: './assets/characters/sky.png' },
  sunny: { name: 'Sunny', image: './assets/characters/sunny.png' },
  blaze: { name: 'Blaze', image: './assets/characters/blaze.png' },
});

const $ = selector => document.querySelector(selector);
const elements = {
  homeButton: $('#homeButton'), soundButton: $('#soundButton'),
  setupScreen: $('#setupScreen'), gameScreen: $('#gameScreen'), resultScreen: $('#resultScreen'),
  heroPicker: $('#heroPicker'), levelPicker: $('#levelPicker'), selectionSummary: $('#selectionSummary'), startButton: $('#startButton'),
  scoreHeroImage: $('#scoreHeroImage'), scoreHeroName: $('#scoreHeroName'), playerScore: $('#playerScore'), opponentScore: $('#opponentScore'),
  roundLabel: $('#roundLabel'), roundDots: $('#roundDots'), questionType: $('#questionType'), questionText: $('#questionText'),
  timer: $('#timer'), timerValue: $('#timerValue'), turnPanel: $('#turnPanel'), turnEyebrow: $('#turnEyebrow'), turnText: $('#turnText'),
  balloonField: $('#balloonField'), arena: $('#arena'), flightLayer: $('#flightLayer'), botPlatform: $('#botPlatform'), botThought: $('#botThought'),
  heroTrack: $('#heroTrack'), heroMover: $('#heroMover'), gameHeroImage: $('#gameHeroImage'), dragHint: $('#dragHint'),
  leftButton: $('#leftButton'), rightButton: $('#rightButton'), shootButton: $('#shootButton'), message: $('#message'),
  resultEyebrow: $('#resultEyebrow'), resultTitle: $('#resultTitle'), resultMessage: $('#resultMessage'), resultHeroImage: $('#resultHeroImage'), resultHeroName: $('#resultHeroName'),
  finalPlayerScore: $('#finalPlayerScore'), finalOpponentScore: $('#finalOpponentScore'), bestBadge: $('#bestBadge'), confetti: $('#confetti'),
  changeButton: $('#changeButton'), replayButton: $('#replayButton'),
};

let settings = loadSettings();
let selectedHero = settings.heroId;
let selectedLimit = 20;
let match = null;
let shotInProgress = false;
let timerFrame = null;
let dragPointer = null;
let mouseDragging = false;
const sound = new GameSound(settings.soundOn);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function showScreen(screen) {
  [elements.setupScreen, elements.gameScreen, elements.resultScreen].forEach(item => item.classList.toggle('active', item === screen));
  if (screen !== elements.gameScreen && timerFrame) cancelAnimationFrame(timerFrame);
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

function syncSetup() {
  elements.heroPicker.querySelectorAll('[data-hero]').forEach(card => {
    const selected = card.dataset.hero === selectedHero;
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-checked', String(selected));
  });
  elements.levelPicker.querySelectorAll('[data-limit]').forEach(card => {
    const selected = Number(card.dataset.limit) === selectedLimit;
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-checked', String(selected));
  });
  document.querySelectorAll('[data-best]').forEach(node => { node.textContent = settings.bestScores[node.dataset.best] ?? 0; });
  elements.selectionSummary.textContent = `${HEROES[selectedHero].name} · within ${selectedLimit}`;
  syncSoundButton();
}

function syncSoundButton() {
  const icon = elements.soundButton.querySelector('[aria-hidden]');
  const label = elements.soundButton.querySelector('.sound-label');
  icon.textContent = settings.soundOn ? '🔊' : '🔇';
  label.textContent = settings.soundOn ? 'Sound on' : 'Sound off';
  elements.soundButton.setAttribute('aria-label', settings.soundOn ? 'Turn sound off' : 'Turn sound on');
  elements.soundButton.setAttribute('aria-pressed', String(settings.soundOn));
}

function selectHero(heroId) {
  selectedHero = heroId;
  settings = saveSettings({ ...settings, heroId });
  syncSetup();
}

function selectLimit(limit) {
  selectedLimit = limit;
  syncSetup();
}

function startMatch() {
  sound.ensureContext();
  match = createMatch({ heroId: selectedHero, limit: selectedLimit, questions: generateMatchQuestions(selectedLimit) });
  const hero = HEROES[selectedHero];
  elements.scoreHeroImage.src = hero.image;
  elements.scoreHeroName.textContent = hero.name;
  elements.gameHeroImage.src = hero.image;
  elements.gameHeroImage.alt = `${hero.name}, your selected hero`;
  elements.resultHeroImage.src = hero.image;
  elements.resultHeroName.textContent = hero.name;
  shotInProgress = false;
  showScreen(elements.gameScreen);
  renderQuestion();
  startTimerLoop();
}

function renderQuestion() {
  const question = currentQuestion(match);
  elements.questionType.textContent = question.typeLabel;
  elements.questionText.textContent = question.display;
  elements.playerScore.textContent = match.scores.player;
  elements.opponentScore.textContent = match.scores.opponent;
  elements.roundLabel.textContent = match.suddenDeath ? 'SUDDEN DEATH' : `ROUND ${Math.min(match.questionIndex + 1, 5)} OF 5`;
  elements.roundDots.replaceChildren(...Array.from({ length: 5 }, (_, index) => {
    const dot = document.createElement('i');
    if (index < Math.min(match.questionIndex, 5)) dot.className = 'done';
    if (index === Math.min(match.questionIndex, 4)) dot.classList.add('current');
    return dot;
  }));

  elements.balloonField.replaceChildren(...question.choices.map((choice, index) => makeBalloon(choice, index)));
  updateTurnUI();
  updateHeroPosition();
}

function makeBalloon(choice, index) {
  const balloon = document.createElement('div');
  balloon.className = `answer-balloon balloon-${index + 1}`;
  balloon.dataset.choice = String(choice);
  balloon.dataset.index = String(index);
  balloon.setAttribute('role', 'option');
  balloon.setAttribute('aria-label', `Answer ${choice}`);
  balloon.setAttribute('aria-selected', String(match.targeted === choice));
  if (match.popped.includes(choice)) balloon.classList.add('popped');
  if (match.targeted === choice && !match.popped.includes(choice)) balloon.classList.add('targeted');
  balloon.innerHTML = `<span class="balloon-shine" aria-hidden="true"></span><strong>${choice}</strong><i aria-hidden="true"></i><span class="balloon-string" aria-hidden="true"></span>`;
  return balloon;
}

function updateTurnUI() {
  if (!match) return;
  const playerTurn = match.actor === 'player' && match.phase === 'playing';
  elements.turnPanel.classList.toggle('bot-turn', !playerTurn);
  elements.turnEyebrow.textContent = playerTurn ? 'YOUR TURN' : "POP-BOT'S TURN";
  elements.turnText.textContent = playerTurn ? `Drag ${HEROES[selectedHero].name} under a balloon` : 'Pop-Bot is choosing a balloon';
  elements.message.textContent = match.feedback;
  elements.shootButton.disabled = !playerTurn || shotInProgress;
  elements.leftButton.disabled = !playerTurn || shotInProgress;
  elements.rightButton.disabled = !playerTurn || shotInProgress;
  elements.heroMover.classList.toggle('disabled', !playerTurn);
  elements.botPlatform.classList.toggle('active', !playerTurn && match.phase === 'playing');
  elements.botThought.textContent = playerTurn ? 'Ready!' : 'Thinking…';
  elements.dragHint.textContent = playerTurn ? '↔ DRAG ME' : 'WAITING';
  updateBalloonSelection();
}

function updateBalloonSelection() {
  if (!match) return;
  elements.balloonField.querySelectorAll('.answer-balloon').forEach(balloon => {
    const choice = Number(balloon.dataset.choice);
    const selected = choice === match.targeted && !match.popped.includes(choice);
    balloon.classList.toggle('targeted', selected);
    balloon.classList.toggle('popped', match.popped.includes(choice));
    balloon.setAttribute('aria-selected', String(selected));
  });
}

function updateHeroPosition() {
  if (!match) return;
  const question = currentQuestion(match);
  const index = Math.max(0, question.choices.indexOf(match.targeted));
  elements.heroMover.style.setProperty('--hero-x', 12.5 + index * 25);
  updateBalloonSelection();
}

function moveTarget(direction) {
  if (!match || match.actor !== 'player' || match.phase !== 'playing' || shotInProgress) return;
  const question = currentQuestion(match);
  const intact = question.choices.filter(choice => !match.popped.includes(choice));
  const current = intact.indexOf(match.targeted);
  const next = current < 0 ? 0 : (current + direction + intact.length) % intact.length;
  match = setTarget(match, intact[next]);
  updateHeroPosition();
}

function targetFromPointer(clientX) {
  if (!match || match.actor !== 'player' || match.phase !== 'playing' || shotInProgress) return;
  const rect = elements.balloonField.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const question = currentQuestion(match);
  const available = question.choices
    .map((choice, index) => ({ choice, index, distance: Math.abs(x - rect.width * ((index + 0.5) / 4)) }))
    .filter(item => !match.popped.includes(item.choice))
    .sort((a, b) => a.distance - b.distance);
  if (available[0]) {
    match = setTarget(match, available[0].choice);
    updateHeroPosition();
  }
}

async function shoot(actor, choice) {
  if (!match || match.phase !== 'playing' || match.actor !== actor || shotInProgress || match.popped.includes(choice)) return;
  shotInProgress = true;
  updateTurnUI();
  sound.shoot();
  const target = elements.balloonField.querySelector(`[data-choice="${choice}"]`);
  const source = actor === 'player' ? elements.gameHeroImage : elements.botPlatform.querySelector('img');
  source.closest('.hero-mover, .bot-platform')?.classList.add('firing');
  animateProjectile(source, target, actor);
  await wait(reduceMotion ? 40 : 340);
  source.closest('.hero-mover, .bot-platform')?.classList.remove('firing');
  target?.classList.add('bursting');
  sound.pop();
  await wait(reduceMotion ? 20 : 240);
  const wasCorrect = choice === currentQuestion(match).answer;
  match = applyShot(match, actor, choice, Date.now());
  shotInProgress = false;

  if (wasCorrect) {
    sound.correct();
    updateTurnUI();
    elements.playerScore.textContent = match.scores.player;
    elements.opponentScore.textContent = match.scores.opponent;
    target?.classList.add('correct');
    await wait(reduceMotion ? 80 : 900);
    const suddenQuestion = match.questionIndex + 1 >= match.questions.length && match.scores.player === match.scores.opponent
      ? generateQuestion([QUESTION_TYPES.ADD, QUESTION_TYPES.SUBTRACT, QUESTION_TYPES.MISSING_ADD, QUESTION_TYPES.MISSING_SUBTRACT][Math.floor(Math.random() * 4)], match.limit)
      : null;
    match = advanceRound(match, Date.now(), suddenQuestion);
    if (match.phase === 'finished') finishMatch();
    else {
      renderQuestion();
      startTimerLoop();
    }
    return;
  }

  renderQuestion();
}

function animateProjectile(source, target, actor) {
  if (!source || !target || reduceMotion) return;
  const arenaRect = elements.arena.getBoundingClientRect();
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const startX = sourceRect.left + sourceRect.width * (actor === 'player' ? 0.62 : 0.35) - arenaRect.left;
  const startY = sourceRect.top + sourceRect.height * 0.38 - arenaRect.top;
  const endX = targetRect.left + targetRect.width / 2 - arenaRect.left;
  const endY = targetRect.top + targetRect.height / 2 - arenaRect.top;
  const projectile = document.createElement('i');
  projectile.className = `projectile ${actor}`;
  projectile.style.setProperty('--start-x', `${startX}px`);
  projectile.style.setProperty('--start-y', `${startY}px`);
  projectile.style.setProperty('--travel-x', `${endX - startX}px`);
  projectile.style.setProperty('--travel-y', `${endY - startY}px`);
  elements.flightLayer.append(projectile);
  setTimeout(() => projectile.remove(), 500);
}

function wait(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

function startTimerLoop() {
  if (timerFrame) cancelAnimationFrame(timerFrame);
  const tick = () => {
    if (!match || match.phase !== 'playing' || !elements.gameScreen.classList.contains('active')) return;
    const now = Date.now();
    const remainingMs = Math.max(0, match.deadline - now);
    const seconds = Math.ceil(remainingMs / 1000);
    elements.timerValue.textContent = seconds;
    elements.timer.style.setProperty('--time-left', `${remainingMs / turnDuration(match.actor)}`);
    elements.timer.setAttribute('aria-label', `${seconds} seconds left`);
    elements.timer.classList.toggle('urgent', seconds <= 5);

    if (remainingMs <= 0 && !shotInProgress) {
      if (match.actor === 'player') {
        match = expirePlayerTurn(match, now);
        updateTurnUI();
      } else {
        void shoot('opponent', chooseOpponentShot(match));
      }
    }
    timerFrame = requestAnimationFrame(tick);
  };
  timerFrame = requestAnimationFrame(tick);
}

function finishMatch() {
  const oldBest = settings.bestScores[match.limit] || 0;
  settings = saveSettings(recordBest(settings, match.limit, match.scores.player));
  const won = match.scores.player > match.scores.opponent;
  elements.resultEyebrow.textContent = won ? 'BALLOON CHAMPION' : 'SHOWDOWN COMPLETE';
  elements.resultTitle.textContent = won ? 'You won!' : 'Pop-Bot wins this time!';
  elements.resultMessage.textContent = won ? 'Brilliant maths and brilliant balloon popping!' : 'Great try! Every round makes your maths stronger.';
  elements.finalPlayerScore.textContent = match.scores.player;
  elements.finalOpponentScore.textContent = match.scores.opponent;
  elements.bestBadge.hidden = match.scores.player <= oldBest;
  elements.bestBadge.textContent = `★ New best for Level ${match.limit / 10 - 1}!`;
  if (won) {
    sound.victory();
    burstConfetti();
  } else {
    elements.confetti.replaceChildren();
  }
  showScreen(elements.resultScreen);
  syncSetup();
}

function burstConfetti() {
  const colors = ['#ff5d72', '#ffcc4d', '#35c6c9', '#6f5ce7', '#ffffff'];
  elements.confetti.replaceChildren(...Array.from({ length: reduceMotion ? 0 : 36 }, (_, index) => {
    const piece = document.createElement('i');
    piece.style.left = `${(index * 31) % 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty('--delay', `${(index % 8) * 0.06}s`);
    piece.style.setProperty('--drift', `${(index % 2 ? 1 : -1) * (30 + (index % 5) * 14)}px`);
    return piece;
  }));
}

function returnToSetup() {
  match = null;
  shotInProgress = false;
  showScreen(elements.setupScreen);
  syncSetup();
}

elements.heroPicker.addEventListener('click', event => {
  const card = event.target.closest('[data-hero]');
  if (card) selectHero(card.dataset.hero);
});
elements.levelPicker.addEventListener('click', event => {
  const card = event.target.closest('[data-limit]');
  if (card) selectLimit(Number(card.dataset.limit));
});
elements.startButton.addEventListener('click', startMatch);
elements.replayButton.addEventListener('click', startMatch);
elements.changeButton.addEventListener('click', returnToSetup);
elements.homeButton.addEventListener('click', returnToSetup);
elements.soundButton.addEventListener('click', () => {
  settings = saveSettings({ ...settings, soundOn: !settings.soundOn });
  sound.setEnabled(settings.soundOn);
  syncSoundButton();
});
elements.leftButton.addEventListener('click', () => moveTarget(-1));
elements.rightButton.addEventListener('click', () => moveTarget(1));
elements.shootButton.addEventListener('click', () => match && void shoot('player', match.targeted));

elements.heroMover.addEventListener('pointerdown', event => {
  if (!match || match.actor !== 'player' || shotInProgress) return;
  dragPointer = event.pointerId;
  elements.heroMover.setPointerCapture(event.pointerId);
  elements.heroMover.classList.add('dragging');
  targetFromPointer(event.clientX);
});
elements.heroMover.addEventListener('pointermove', event => {
  if (event.pointerId === dragPointer) targetFromPointer(event.clientX);
});
elements.heroMover.addEventListener('pointerup', event => {
  if (event.pointerId !== dragPointer) return;
  dragPointer = null;
  elements.heroMover.classList.remove('dragging');
  elements.heroMover.releasePointerCapture(event.pointerId);
});
elements.heroMover.addEventListener('pointercancel', () => {
  dragPointer = null;
  elements.heroMover.classList.remove('dragging');
});
// Mouse events are retained alongside Pointer Events because some embedded
// browsers expose drag gestures as classic mouse input.
elements.heroMover.addEventListener('mousedown', event => {
  if (!match || match.actor !== 'player' || shotInProgress) return;
  event.preventDefault();
  mouseDragging = true;
  elements.heroMover.classList.add('dragging');
  targetFromPointer(event.clientX);
});
document.addEventListener('mousemove', event => {
  if (mouseDragging) targetFromPointer(event.clientX);
});
document.addEventListener('mouseup', () => {
  if (!mouseDragging) return;
  mouseDragging = false;
  elements.heroMover.classList.remove('dragging');
});

document.addEventListener('keydown', event => {
  if (!elements.gameScreen.classList.contains('active') || !match || match.actor !== 'player') return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); moveTarget(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); moveTarget(1); }
  if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); void shoot('player', match.targeted); }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && match?.phase === 'playing') startTimerLoop();
});

syncSetup();
