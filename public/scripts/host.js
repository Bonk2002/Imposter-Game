// public/scripts/host.js
import { socket } from './common/socket.js';
import { toast } from './common/ui.js';
import { createDealCard } from './components/card.js';
import { formatSeconds } from './components/timer.js';
import { renderOrder } from './components/playerList.js';
import { modal } from './common/modal.js';

console.log('[host.js] loaded');

const form = document.getElementById('createForm');
const lobbyEl = document.getElementById('lobby');
const codeEl = document.getElementById('code');
const playersEl = document.getElementById('players');

const categorySel = document.getElementById('category');
const minutesInput = document.getElementById('minutes');
const saveBtn = document.getElementById('saveSettings');
const startBtn = document.getElementById('startGame');
const infoEl = document.getElementById('settingsInfo');
const preGameUI = document.getElementById('preGameUI');

// Round UI
const roundUI = document.getElementById('roundUI');
const timerEl = document.getElementById('timer');
const activeNameEl = document.getElementById('activeName');
const orderListEl = document.getElementById('orderList');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const nextTurnBtn = document.getElementById('nextTurn');
const voteBtn = document.getElementById('proposeVote');
const chatLog = document.getElementById('chatLog');

let currentCode = null;
let currentPlayers = [];

if (!form) console.error('[host.js] createForm not found – ist host.html aktuell?');

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const hostName = document.getElementById('hostName')?.value?.trim();
  console.log('[host.js] submit', { hostName });
  if (!hostName) return;

  socket.emit('lobby:create', { hostName }, (res) => {
    console.log('[host.js] lobby:create cb', res);
    if (!res?.ok) {
      alert('Fehler beim Erstellen');
      return;
    }
    currentCode = res.code;
    codeEl.textContent = res.code;
    lobbyEl.classList.remove('hidden');
  });
});

// Kategorien
socket.on('words:categories', (cats) => {
  console.log('[host.js] categories', cats);
  if (!categorySel) return;
  categorySel.innerHTML = '';
  (cats || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    categorySel.appendChild(opt);
  });
});

// Einstellungen speichern
saveBtn?.addEventListener('click', () => {
  if (!currentCode) return;
  const settings = {
    category: categorySel.value,
    timerSeconds: Number(minutesInput.value || 5) * 60
  };
  socket.emit('host:settings', { code: currentCode, settings }, (res) => {
    if (!res?.ok) return alert(res?.error || 'Konnte nicht speichern');
    infoEl.textContent = `Gespeichert: ${settings.category}, ${Math.round(settings.timerSeconds/60)} Min`;
    setTimeout(() => (infoEl.textContent = ''), 2000);
  });
});

// Spiel starten
startBtn?.addEventListener('click', () => {
  if (!currentCode) return;
  socket.emit('game:start', { code: currentCode }, (res) => {
    if (!res?.ok) return alert(res?.error || 'Konnte Spiel nicht starten');
  });
});

// Lobby-Updates
socket.on('lobby:update', (view) => {
  if (!view) return;
  playersEl.innerHTML = '';
  view.players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.isHost ? `${p.name} (Host)` : p.name;
    playersEl.appendChild(li);
  });
});

// Startsignal
socket.on('game:started', () => {
  roundUI.classList.remove('hidden');
});

// Eigene Karte
socket.on('game:deal', (info) => {
  const gameTitle = document.getElementById('gameTitle');
  const gameArea = document.getElementById('gameArea');
  gameTitle.classList.remove('hidden');
  gameArea.classList.remove('hidden');
  gameArea.innerHTML = '';

  const card = createDealCard(info);
  gameArea.appendChild(card.el);
});

// Turn/Timer/Chat
socket.on('turn:start', ({ activeId, activeName, order, players }) => {
  activeNameEl.textContent = activeName || '–';
  currentPlayers = players || [];
  renderOrder(orderListEl, currentPlayers, order, activeId);

  const amActive = socket.id === activeId;
  chatInput.disabled = !amActive;
  sendChat.disabled = !amActive;
  nextTurnBtn.disabled = !amActive;
  voteBtn.disabled = !amActive;
});

socket.on('timer:tock', ({ remain }) => {
  timerEl.textContent = formatSeconds(remain);
});

sendChat?.addEventListener('click', () => {
  if (!currentCode) return;
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit('chat:send', { code: currentCode, text });
  chatInput.value = '';
});

nextTurnBtn?.addEventListener('click', () => {
  if (!currentCode) return;
  socket.emit('turn:next', { code: currentCode });
});

voteBtn?.addEventListener('click', () => {
  if (!currentCode) return;
  socket.emit('vote:propose', { code: currentCode });
});

socket.on('chat:message', ({ fromId, fromName, text }) => {
  const div = document.createElement('div');
  div.className = 'msg' + (fromId === socket.id ? ' me' : '');
  div.textContent = `${fromName}: ${text}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
});

// Voting
socket.on('vote:proposal', () => {
  toast('Abstimmung gestartet (Ja/Nein bei Spielern).');
});
socket.on('vote:progress', ({ yes, total, threshold }) => {
  toast(`Voting-Bereitschaft: ${yes}/${total} (Schwelle ${threshold})`);
});
socket.on('vote:start', ({ players }) => {
  currentPlayers = players;
  toast('Spieler wählen jetzt jemanden.');
});
socket.on('vote:tally', (t) => console.log('[host] tally', t));
socket.on('vote:result', (r) => {
  const chosen = currentPlayers.find(p => p.id === r.top)?.name || r.top;
  toast(`Gewählt: ${chosen}`);
});
// --- Voting: Proposal (Ja/Nein) ---
socket.on('vote:proposal', () => {
  const m = modal(() => `
    <h3>Abstimmung starten?</h3>
    <p>Soll jetzt ein Imposter-Vote durchgeführt werden?</p>
    <div class="row">
      <button id="vYes" class="btn">Ja</button>
      <button id="vNo" class="btn" style="background:#2a2f55;color:#e6e9ff">Nein</button>
    </div>
    <small class="badge" id="vProg">Warte auf Stimmen…</small>
  `);
  m.box.querySelector('#vYes').onclick = () => { socket.emit('vote:decision', { code: currentCode, yes: true }); };
  m.box.querySelector('#vNo').onclick  = () => { socket.emit('vote:decision', { code: currentCode, yes: false }); };
  // Fortschritt live updaten
  const upd = ({ yes, total, threshold }) => {
    const el = m.box.querySelector('#vProg'); if (!el) return;
    el.textContent = `Ja: ${yes}/${total} · Schwelle: ${threshold}`;
  };
  const onProg = (p) => upd(p);
  socket.on('vote:progress', onProg);
  // Beim Übergang zur Auswahl Modal schließen
  const onStart = () => { socket.off('vote:progress', onProg); m.close(); };
  socket.once('vote:start', onStart);
});

// --- Voting: Kandidat wählen ---
socket.on('vote:start', ({ players }) => {
  const m = modal(() => `
    <h3>Wen wählst du?</h3>
    <div class="grid">
      ${players.map(p => `<div class="choice" data-id="${p.id}">${p.name}</div>`).join('')}
    </div>
  `);
  m.box.querySelectorAll('.choice').forEach(node => {
    node.onclick = () => {
      const targetId = node.getAttribute('data-id');
      socket.emit('vote:cast', { code: currentCode, targetId });
      m.close();
    };
  });
});

// --- Voting: Ergebnis / Reveal ---
socket.on('vote:result', (r) => {
  // optional: kleines Toast oder Tally-Log, Reveal kommt im nächsten Event
  console.log('Tally:', r.tally);
});

socket.on('reveal:show', ({ chosenName, impostorName, correct, word }) => {
  const m = modal(() => `
    <h3>Gewählt: <span>${chosenName}</span></h3>
    <div class="scene deal-in" style="margin-top:10px">
      <div class="card3d" id="revealCard">
        <!-- Front: nur die gewählte Person -->
        <div class="card-face card-front">
          <div>
            <div class="card-title">Aufgedeckt: Gewählte Person</div>
            <div class="card-text">${chosenName}</div>
            <div style="margin-top:8px" class="badge">Tippe zum Umdrehen</div>
          </div>
        </div>
        <!-- Back: echter Imposter + Wort -->
        <div class="card-face card-back">
          <div>
            <div class="card-title" style="margin-bottom:6px">
              ${correct
                ? `<span class="success">Treffer!</span>`
                : `<span class="danger">Daneben!</span>`}
            </div>
            <div class="card-text">
              Imposter: <span class="danger">${impostorName}</span>
            </div>
            <div style="margin-top:6px">Wort: <strong>${word}</strong></div>
          </div>
        </div>
      </div>
    </div>
  `);

  const card = m.box.querySelector('#revealCard');
  card.onclick = () => card.classList.toggle('is-flipped');
});
socket.on('game:ended', () => {
  // Runde/Spiel-UI aus
  document.getElementById('roundUI')?.classList.add('hidden');
  document.getElementById('gameTitle')?.classList.add('hidden');
  const gameArea = document.getElementById('gameArea');
  if (gameArea) gameArea.classList.add('hidden'), gameArea.innerHTML = '';

  // Einstellungen & Lobby wieder sichtbar lassen (Host bleibt in Lobby)
  // Buttons neutralisieren
  ['chatInput','sendChat','nextTurn','proposeVote'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
});
socket.on('game:started', () => {
  preGameUI.classList.add('hidden');
});

socket.on('game:ended', () => {
  preGameUI.classList.remove('hidden');
});
socket.on('timer:end', () => {
  // z.B. kleines Toast – Voting startet gleich automatisch
  // toast('Zeit abgelaufen – Vote startet!');
});
// Beim Start: Einstellungen & Spielerliste ausblenden
socket.on('game:started', () => {
  document.getElementById('settingsCard')?.classList.add('hidden');
  document.getElementById('playersSection')?.classList.add('hidden');
  document.getElementById('roundUI')?.classList.remove('hidden');
});

// Beim Ende: zurück zur Lobby-Ansicht
socket.on('game:ended', () => {
  document.getElementById('roundUI')?.classList.add('hidden');
  document.getElementById('gameTitle')?.classList.add('hidden');
  const gameArea = document.getElementById('gameArea');
  if (gameArea) { gameArea.classList.add('hidden'); gameArea.innerHTML = ''; }

  document.getElementById('settingsCard')?.classList.remove('hidden');
  document.getElementById('playersSection')?.classList.remove('hidden');

  // Buttons deaktivieren
  ['chatInput','sendChat','nextTurn','proposeVote'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
});


// Debug: zeigen, dass Socket verbunden ist
socket.on('connect', () => console.log('[host.js] socket connected', socket.id));
