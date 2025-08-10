// public/scripts/player.js
import { socket } from './common/socket.js';
import { toast } from './common/ui.js';
import { createDealCard } from './components/card.js';
import { formatSeconds } from './components/timer.js';
import { renderOrder } from './components/playerList.js';
import { modal } from './common/modal.js';

console.log('[player.js] loaded');
socket.onAny((ev, ...args) => console.log('[player evt]', ev, args));

// --- DOM refs ---
const preGameUI   = document.getElementById('preGameUI');         // oberer Bereich (Join + Lobby)
const joinForm    = document.getElementById('joinForm');
const codeInput   = document.getElementById('joinCode') || document.getElementById('code'); // robust
const nameInput   = document.getElementById('playerName');
const lobbyEl     = document.getElementById('lobby');
const playersEl   = document.getElementById('players');

const roundUI       = document.getElementById('roundUI');
const timerEl       = document.getElementById('timer');
const activeNameEl  = document.getElementById('activeName');
const orderListEl   = document.getElementById('orderList');

const chatInput   = document.getElementById('chatInput');
const sendChat    = document.getElementById('sendChat');
const nextTurnBtn = document.getElementById('nextTurn');
const voteBtn     = document.getElementById('proposeVote');
const chatLog     = document.getElementById('chatLog');

const gameTitle = document.getElementById('gameTitle');
const gameArea  = document.getElementById('gameArea');

let currentCode = null;
let currentPlayers = [];

// --- Join ---
if (joinForm) {
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const code = (codeInput?.value || '').trim().toUpperCase();
    const playerName = (nameInput?.value || '').trim();

    if (!code || !playerName) {
      toast('Bitte Code und Namen eingeben.');
      return;
    }

    socket.emit('lobby:join', { code, playerName }, (res) => {
      console.log('[player] lobby:join cb', res);
      if (!res?.ok) {
        toast(
          res?.error === 'NAME_TAKEN' ? 'Name bereits vergeben.' :
          res?.error === 'LOBBY_NOT_FOUND' ? 'Lobby nicht gefunden.' :
          'Fehler beim Beitreten'
        );
        return;
      }
      currentCode = code;
      lobbyEl?.classList.remove('hidden'); // Lobbyliste vor Start zeigen
    });
  });
} else {
  console.warn('[player] joinForm nicht gefunden');
}

// --- Lobby-Updates ---
socket.on('lobby:update', (view) => {
  if (!view || !playersEl) return;
  playersEl.innerHTML = '';
  (view.players || []).forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.isHost ? `${p.name} (Host)` : p.name;
    playersEl.appendChild(li);
  });
});

// --- Spielstart/ende: Pre-Game aus/ein & Game-UI an/aus ---
socket.on('game:started', () => {
  preGameUI?.classList.add('hidden');     // Join + Lobby weg
  lobbyEl?.classList.add('hidden');
  roundUI?.classList.remove('hidden');    // Spielpanel zeigen
});

socket.on('game:ended', () => {
  // Spielpanel aus
  roundUI?.classList.add('hidden');
  gameTitle?.classList.add('hidden');
  if (gameArea) { gameArea.classList.add('hidden'); gameArea.innerHTML = ''; }

  // Pre-Game zurück
  preGameUI?.classList.remove('hidden');
  lobbyEl?.classList.remove('hidden');

  // Buttons sperren
  ['chatInput','sendChat','nextTurn','proposeVote'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
});

// --- Eigene Karte empfangen (auch nach Reload) ---
socket.on('game:deal', (info) => {
  gameTitle?.classList.remove('hidden');
  gameArea?.classList.remove('hidden');
  if (gameArea) {
    gameArea.innerHTML = '';
    const card = createDealCard(info);
    gameArea.appendChild(card.el);
  }
});

// --- Rundenstart / Reihenfolge / Schreibrechte ---
socket.on('turn:start', ({ activeId, activeName, order, players }) => {
  if (activeNameEl) activeNameEl.textContent = activeName || '–';
  currentPlayers = players || [];
  renderOrder(orderListEl, currentPlayers, order, activeId);

  const amActive = socket.id === activeId;
  if (chatInput)   chatInput.disabled = !amActive;
  if (sendChat)    sendChat.disabled = !amActive;
  if (nextTurnBtn) nextTurnBtn.disabled = !amActive;
  if (voteBtn)     voteBtn.disabled   = !amActive;
});

// --- Timer ---
socket.on('timer:tock', ({ remain }) => {
  if (roundUI?.classList.contains('hidden')) roundUI.classList.remove('hidden');
  if (timerEl) timerEl.textContent = formatSeconds(remain);
});

socket.on('timer:end', () => {
  // optional: toast('Zeit abgelaufen – Vote startet!');
});

// --- Chat ---
sendChat?.addEventListener('click', () => {
  if (!currentCode) return;
  const text = chatInput?.value.trim();
  if (!text) return;
  socket.emit('chat:send', { code: currentCode, text });
  if (chatInput) chatInput.value = '';
});

socket.on('chat:message', ({ fromId, fromName, text }) => {
  if (!chatLog) return;
  const div = document.createElement('div');
  div.className = 'msg' + (fromId === socket.id ? ' me' : '');
  div.textContent = `${fromName}: ${text}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
});

// --- Next / Vote ---
nextTurnBtn?.addEventListener('click', () => {
  if (!currentCode) return;
  socket.emit('turn:next', { code: currentCode });
});
voteBtn?.addEventListener('click', () => {
  if (!currentCode) return;
  socket.emit('vote:propose', { code: currentCode });
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

  const onProg = ({ yes, total, threshold }) => {
    const el = m.box.querySelector('#vProg'); if (!el) return;
    el.textContent = `Ja: ${yes}/${total} · Schwelle: ${threshold}`;
  };
  socket.on('vote:progress', onProg);
  socket.once('vote:start', () => { socket.off('vote:progress', onProg); m.close(); });
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
  console.log('Tally:', r.tally);
});

socket.on('reveal:show', ({ chosenName, impostorName, correct, word }) => {
  const m = modal(() => `
    <h3>Gewählt: <span>${chosenName}</span></h3>
    <div class="scene deal-in" style="margin-top:10px">
      <div class="card3d" id="revealCard">
        <div class="card-face card-front">
          <div>
            <div class="card-title">Aufgedeckt: Gewählte Person</div>
            <div class="card-text">${chosenName}</div>
            <div style="margin-top:8px" class="badge">Tippe zum Umdrehen</div>
          </div>
        </div>
        <div class="card-face card-back">
          <div>
            <div class="card-title" style="margin-bottom:6px">
              ${correct ? `<span class="success">Treffer!</span>` : `<span class="danger">Daneben!</span>`}
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

// --- Debug ---
socket.on('connect', () => console.log('[player] socket connected', socket.id));
