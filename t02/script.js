'use strict';

// 게임에서 고정된 값: 두 비교 조건에서 변경하지 않습니다.
const SESSION_MS = 30_000;
const SIGNAL_MS = 1_000;
const SUCCESS_SCORE = 16;
const GROUP_LIMIT = 10;
const STORAGE_KEY = 'aleph.t02.signal30.v1';

// 실험에서 오직 한 가지 값만 바꿉니다: 신호가 켜지는 시간.
const LIGHT_ON_MS = Object.freeze({ before: 700, after: 450 });

const $ = (selector) => document.querySelector(selector);
const el = {
  gameState: $('#game-state'), time: $('#time-remaining'), score: $('#score'), signalIndex: $('#signal-index'),
  roundStatus: $('#round-status'), led: $('#signal-led'), caption: $('#signal-caption'),
  catchButton: $('#catch-button'), start: $('#start-button'), pause: $('#pause-button'), restart: $('#restart-button'),
  feedback: $('#feedback'), sound: $('#sound-toggle'), motion: $('#motion-toggle'),
  beforeCount: $('#before-count'), afterCount: $('#after-count'), beforeCard: $('#before-card'), afterCard: $('#after-card'),
  change: $('#change-button'), experimentInfo: $('#experiment-info'), rows: $('#records-body'),
  comparison: $('#comparison'), download: $('#download-button'), reset: $('#reset-button'), storageInfo: $('#storage-info')
};

function freshRecordBook() { return { version: 1, phase: 'before', records: [] }; }
function isValidRecordBook(book) {
  if (!book || typeof book !== 'object' || Array.isArray(book) || book.version !== 1 || !['before', 'after'].includes(book.phase) || !Array.isArray(book.records) || book.records.length > 20) return false;
  const before = book.records.filter(r => r?.phase === 'before');
  const after = book.records.filter(r => r?.phase === 'after');
  if (before.length > 10 || after.length > 10 || before.length + after.length !== book.records.length) return false;
  if (after.length && (book.phase !== 'after' || before.length !== 10)) return false;
  if (book.phase === 'after' && before.length !== 10) return false;
  if (book.records.some((r,i) => !r || typeof r !== 'object' || !['before','after'].includes(r.phase) || !Number.isInteger(r.score) || r.score < 0 || r.score > 30 || !Number.isInteger(r.misses) || r.misses !== 30 - r.score || r.result !== (r.score >= SUCCESS_SCORE ? '성공' : '실패') || (i < 10 ? r.phase !== 'before' : r.phase !== 'after'))) return false;
  return true;
}

let storageWritable = true;
let storageMessage = '기록은 브라우저에만 저장됩니다. 이름·연락처·키를 수집하지 않습니다.';
function loadBook() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return freshRecordBook();
    const book = JSON.parse(raw);
    if (!isValidRecordBook(book)) throw new Error('Invalid game record schema');
    return book;
  } catch (error) {
    if (error?.name === 'SecurityError') {
      storageWritable = false;
      storageMessage = '이 환경에서는 로컬 저장소를 사용할 수 없습니다. 게임은 가능하지만 기록이 유지되지 않습니다.';
    } else {
      storageMessage = '손상된 저장 기록을 발견해 안전하게 기본 상태로 복구했습니다.';
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(freshRecordBook())); }
      catch (_) { storageWritable = false; storageMessage += ' 이 환경에서는 복구 내용을 저장할 수 없습니다.'; }
    }
    return freshRecordBook();
  }
}
let book = loadBook();
function saveBook() {
  if (!storageWritable) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(book)); }
  catch (_) { storageWritable = false; storageMessage = '저장소에 쓸 수 없어 기록이 브라우저 종료 후 유지되지 않을 수 있습니다.'; }
  el.storageInfo.textContent = storageMessage;
}

// game.status: ready | playing | paused | finished
let game = { status: 'ready', score: 0, elapsedBeforePause: 0, startedAt: 0, currentSlot: -1, attemptedSlot: -1 };
let rafId = 0;
let activeSounds = new Set();
let audioContext = null;
const count = (phase) => book.records.filter(r => r.phase === phase).length;
const canPlay = () => count(book.phase) < GROUP_LIMIT;
const remainingMs = () => game.status === 'playing' ? Math.max(0, SESSION_MS - (game.elapsedBeforePause + performance.now() - game.startedAt)) : Math.max(0, SESSION_MS - game.elapsedBeforePause);

function stopSounds() {
  for (const osc of activeSounds) { try { osc.stop(); } catch (_) {} }
  activeSounds.clear();
}
function playSound(kind) {
  if (!el.sound.checked) return;
  try {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    if (!audioContext) audioContext = new AudioEngine();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'square';
    osc.frequency.value = kind === 'good' ? 640 : kind === 'win' ? 800 : 230;
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(.025, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + .11);
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.onended = () => { activeSounds.delete(osc); try { osc.disconnect(); gain.disconnect(); } catch (_) {} };
    activeSounds.add(osc); osc.start(now); osc.stop(now + .12);
  } catch (_) { /* audio unsupported: silent game stays fully usable */ }
}

function setFeedback(message) { el.feedback.textContent = message; }
function syncSignal(elapsed = game.elapsedBeforePause) {
  const slot = Math.min(29, Math.floor(Math.min(29_999, elapsed) / SIGNAL_MS));
  const withinSlot = elapsed % SIGNAL_MS;
  game.currentSlot = slot;
  const lit = withinSlot < LIGHT_ON_MS[book.phase] && game.attemptedSlot !== slot && game.status === 'playing';
  el.led.classList.toggle('is-on', lit);
  el.led.classList.toggle('is-hit', game.attemptedSlot === slot && game.status === 'playing');
  el.signalIndex.textContent = `${slot + 1} / 30`;
  if (game.status === 'playing') {
    el.caption.textContent = game.attemptedSlot === slot ? '이 신호의 판정은 끝났습니다.' : lit ? '지금! 신호가 켜졌어요.' : '잠깐 기다리세요.';
  }
  el.catchButton.disabled = game.status !== 'playing';
}
function renderGame() {
  const rem = remainingMs();
  el.gameState.textContent = ({ready:'대기',playing:'진행',paused:'일시정지',finished:game.score >= SUCCESS_SCORE ? '성공' : '실패'})[game.status];
  el.time.textContent = (rem / 1000).toFixed(1) + '초';
  el.score.textContent = `${game.score} / ${SUCCESS_SCORE}`;
  if (game.status === 'ready') {el.signalIndex.textContent = '0 / 30';el.led.classList.remove('is-on','is-hit');el.caption.textContent = '시작을 누르면 30초 게임이 시작됩니다.';}
  if (game.status === 'paused') {el.led.classList.remove('is-on','is-hit');el.caption.textContent = '일시정지 중입니다. 이어하기를 눌러 주세요.';}
  if (game.status === 'finished') {el.signalIndex.textContent = '30 / 30';el.led.classList.remove('is-on','is-hit');el.caption.textContent = game.score >= SUCCESS_SCORE ? '성공! 16개 이상 신호를 잡았습니다.' : '실패. 다음 판에서 다시 도전하세요.';}
  el.catchButton.disabled = game.status !== 'playing';
  el.start.disabled = !((game.status === 'ready' || game.status === 'finished') && canPlay());
  el.start.textContent = game.status === 'finished' ? '다음 판 시작' : '게임 시작';
  el.pause.disabled = !(game.status === 'playing' || game.status === 'paused');
  el.pause.textContent = game.status === 'paused' ? '이어하기' : '일시정지';
  el.restart.disabled = !(game.status === 'playing' || game.status === 'paused' || (game.status === 'finished' && canPlay()));
  el.change.disabled = game.status === 'playing' || game.status === 'paused' || book.phase === 'after' || count('before') < 10;
}
function resetGame() {
  cancelAnimationFrame(rafId);
  stopSounds();
  game = { status: 'ready', score: 0, elapsedBeforePause: 0, startedAt: 0, currentSlot: -1, attemptedSlot: -1 };
  setFeedback('게임 시작을 눌러 준비해 주세요.');
  renderGame();
  renderRecords();
}
function tick(now) {
  if (game.status !== 'playing') return;
  const elapsed = game.elapsedBeforePause + (now - game.startedAt);
  if (elapsed >= SESSION_MS) { finishGame(); return; }
  el.time.textContent = ((SESSION_MS - elapsed) / 1000).toFixed(1) + '초';
  syncSignal(elapsed);
  rafId = requestAnimationFrame(tick);
}
function startGame() {
  if ((game.status !== 'ready' && game.status !== 'finished') || !canPlay()) return;
  cancelAnimationFrame(rafId);
  game = { status: 'playing', score: 0, elapsedBeforePause: 0, startedAt: performance.now(), currentSlot: 0, attemptedSlot: -1 };
  setFeedback('시작! 하늘색 신호가 켜졌을 때 잡으세요.');
  renderGame();
  syncSignal(0);
  rafId = requestAnimationFrame(tick);
  el.catchButton.focus({preventScroll:true});
}
function finishGame() {
  if (game.status !== 'playing') return;
  cancelAnimationFrame(rafId);
  game.elapsedBeforePause = SESSION_MS;
  game.status = 'finished';
  if (canPlay()) {
    book.records.push({phase:book.phase, score:game.score, misses:30-game.score, result:game.score >= SUCCESS_SCORE ? '성공':'실패'});
    saveBook();
  }
  setFeedback(game.score >= SUCCESS_SCORE ? `성공! ${game.score}개 포착. 30초가 끝났습니다.` : `실패. ${game.score}개 포착. 16개 이상이면 성공입니다.`);
  playSound(game.score >= SUCCESS_SCORE ? 'win' : 'bad');
  renderGame(); renderRecords();
}
function pauseGame() {
  if (game.status === 'playing') {
    game.elapsedBeforePause = Math.min(SESSION_MS, game.elapsedBeforePause + performance.now() - game.startedAt);
    cancelAnimationFrame(rafId);
    if (game.elapsedBeforePause >= SESSION_MS) { finishGame(); return; }
    game.status = 'paused';
    stopSounds(); setFeedback('일시정지. 시간과 점수는 그대로 유지됩니다.'); renderGame();
  } else if (game.status === 'paused') {
    game.startedAt = performance.now(); game.status = 'playing';
    setFeedback('이어하기! 남은 시간부터 다시 진행합니다.'); renderGame();
    rafId = requestAnimationFrame(tick);
    el.catchButton.focus({preventScroll:true});
  }
}
function catchSignal() {
  if (game.status !== 'playing') return;
  const elapsed = game.elapsedBeforePause + (performance.now() - game.startedAt);
  if (elapsed >= SESSION_MS) { finishGame(); return; }
  const slot = Math.floor(elapsed / SIGNAL_MS);
  if (game.attemptedSlot === slot) { setFeedback('이 신호는 이미 판정했습니다. 다음 신호를 기다려 주세요.'); return; }
  game.attemptedSlot = slot;
  if (elapsed % SIGNAL_MS < LIGHT_ON_MS[book.phase]) {
    game.score++;
    setFeedback(`${slot+1}번째 신호 성공! 현재 ${game.score}점.`); playSound('good');
  } else { setFeedback(`${slot+1}번째 신호 실패. 다음 신호를 기다려 주세요.`); playSound('bad'); }
  syncSignal(elapsed);
  renderGame();
}
function restartGame() {
  if (game.status === 'playing' || game.status === 'paused' || (game.status === 'finished' && canPlay())) {
    resetGame(); startGame();
  }
}

function renderRecords() {
  const b = count('before'), a = count('after');
  el.beforeCount.textContent = `기록 ${b} / 10`;
  el.afterCount.textContent = `기록 ${a} / 10`;
  el.beforeCard.classList.toggle('is-current',book.phase === 'before');
  el.afterCard.classList.toggle('is-current',book.phase === 'after');
  el.roundStatus.textContent = (book.phase === 'before' ? '기본 난이도' : '조정 난이도') + ` · 기록 ${book.phase === 'before' ? b : a}/10`;
  el.download.disabled = book.records.length === 0;
  el.change.textContent = b < 10 ? '10판 완료 후 난이도 변경' : book.phase === 'before' ? '난이도 700 → 450ms 변경' : '난이도 변경 완료';
  if (book.phase === 'before') el.experimentInfo.textContent = b === 10 ? '기본 난이도 10판 완료. 난이도 변경을 눌러 밝게 켜진 시간만 450ms로 바꿔 주세요.' : `기본 난이도 ${b}/10판. 남은 ${10-b}판을 끝까지 플레이해 주세요.`;
  else el.experimentInfo.textContent = a === 10 ? '총 20판 완료! 아래 비교 결과를 확인하고 CSV로 저장하세요.' : `조정 난이도 ${a}/10판. 남은 ${10-a}판을 끝까지 플레이해 주세요.`;
  if (book.records.length) {
    el.rows.replaceChildren();
    book.records.forEach((record, idx) => {
      const tr = document.createElement('tr');
      const values = [idx+1, record.phase === 'before' ? '기본 700ms' : '조정 450ms', record.score, record.misses, record.result];
      values.forEach((value) => {const td = document.createElement('td');td.textContent = String(value);tr.append(td);});
      el.rows.append(tr);
    });
  } else {
    el.rows.innerHTML = '<tr><td colspan="5">아직 기록이 없습니다. 게임을 끝까지 플레이해 주세요.</td></tr>';
  }
  if (b === 10 && a === 10) {
    const stats = (phase) => {const records = book.records.filter(r=>r.phase===phase);return {avg:(records.reduce((s,r)=>s+r.score,0)/10).toFixed(1), wins:records.filter(r=>r.result==='성공').length};};
    const before = stats('before'), after = stats('after');
    el.comparison.innerHTML = '<strong>비교 결과 — 10판씩 완료</strong><p></p>';
    el.comparison.querySelector('p').textContent = `기본 700ms: 평균 ${before.avg}점 · 성공 ${before.wins}/10판 | 조정 450ms: 평균 ${after.avg}점 · 성공 ${after.wins}/10판. 30초·목표 16점·조작 방식은 동일하고 신호가 켜지는 시간만 바꿨습니다.`;
  } else {
    el.comparison.innerHTML = '<strong>비교 결과</strong><p>기본 10판과 조정 10판을 모두 마치면 성공률과 평균 점수를 비교할 수 있습니다.</p>';
  }
  renderGame();
  el.storageInfo.textContent = storageMessage;
}
function changeDifficulty() {
  if (game.status === 'playing' || game.status === 'paused' || book.phase !== 'before' || count('before') !== 10) return;
  book.phase = 'after';
  saveBook();
  resetGame();
  setFeedback('난이도가 변경됐습니다. 이번에는 450ms 안에 신호를 잡아 보세요.');
}
function downloadRecords() {
  if (!book.records.length) return;
  const data = [['round','group','light_on_ms','score','missed_signals','result'], ...book.records.map((r,i)=>[i+1,r.phase,LIGHT_ON_MS[r.phase],r.score,r.misses,r.result])];
  const csv = '\ufeff' + data.map(row=>row.join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a');a.href=url;a.download='signal30_records.csv';
  document.body.append(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function resetRecords() {
  if (!window.confirm('저장된 최대 20판 기록과 난이도 진행 상태를 모두 지울까요? 복구할 수 없으니 필요하면 먼저 CSV를 저장하세요.')) return;
  book = freshRecordBook();saveBook();resetGame();
  storageMessage = '저장 기록을 초기화했습니다. 기본 난이도의 1판부터 다시 시작합니다.';
  el.storageInfo.textContent = storageMessage;
}

el.catchButton.addEventListener('click',catchSignal);
// Enter/Space를 길게 누를 때 발생하는 자동 반복 키 입력은 무시합니다.
el.catchButton.addEventListener('keydown',(event)=>{if(event.repeat && (event.key==='Enter' || event.key===' '))event.preventDefault();});
el.start.addEventListener('click',startGame);
el.pause.addEventListener('click',pauseGame);
el.restart.addEventListener('click',restartGame);
el.change.addEventListener('click',changeDifficulty);
el.download.addEventListener('click',downloadRecords);
el.reset.addEventListener('click',resetRecords);
el.sound.addEventListener('change',()=>{if(!el.sound.checked){stopSounds();setFeedback('효과음을 껐습니다. 진행 중인 소리도 중단했습니다.');}else setFeedback('효과음을 켰습니다. 신호 판정 때 소리가 납니다.');});
el.motion.addEventListener('change',()=>{document.documentElement.classList.toggle('reduce-motion',el.motion.checked);setFeedback(el.motion.checked ? '시각 전환 효과를 줄였습니다. 게임 판정은 그대로입니다.' : '기본 시각 전환 효과로 돌아왔습니다.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden && game.status==='playing')pauseGame();});

renderRecords();
renderGame();
