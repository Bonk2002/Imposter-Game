// src/sockets/index.js
import { lobbyService } from '../services/lobbyService.js';
import { wordsService } from '../services/wordsService.js';
import { gameService } from '../services/gameService.js';
import { timerService } from '../services/timerService.js';
import { chatService } from '../services/chatService.js';
import { voteService } from '../services/voteService.js';
import { memoryStore } from '../store/memoryStore.js';

export default function sockets(io) {
  io.on('connection', (socket) => {
    socket.emit('hello', { id: socket.id, msg: 'Welcome to Imposter v2' });
    socket.emit('words:categories', wordsService.getCategories());

    // LOBBY: erstellen
    socket.on('lobby:create', ({ hostName }, cb) => {
      const { code, host } = lobbyService.createLobby(hostName, socket.id);
      socket.join(code);
      cb?.({ ok: true, code, host });
      io.to(code).emit('lobby:update', lobbyService.getLobbyView(code));
    });

    // LOBBY: beitreten
    socket.on('lobby:join', ({ code, playerName }, cb) => {
      const res = lobbyService.joinLobby(code, playerName, socket.id);
      if (!res.ok) return cb?.(res);

      socket.join(code);
      cb?.(res);
      io.to(code).emit('lobby:update', lobbyService.getLobbyView(code));

      // Falls Spiel läuft: Status + persönliche Karte an den neuen Socket
      const lobby = memoryStore.lobbies.get(code);
      if (lobby?.game?.active) {
        const g = lobby.game;
        const activeId = g.order[g.activeIndex];
        const activeName = lobby.players.find(p => p.id === activeId)?.name;

        io.to(socket.id).emit('game:started', {
          order: g.order,
          timerSeconds: g.timerSeconds,
          category: g.category
        });

        io.to(socket.id).emit('turn:start', {
          activeId,
          activeName,
          order: g.order,
          players: lobby.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost }))
        });

        const personal = gameService.getPersonalInfo(code, socket.id);
        if (personal) io.to(socket.id).emit('game:deal', personal);
      }
    });

    // HOST: Einstellungen
    socket.on('host:settings', ({ code, settings }, cb) => {
      const lobby = memoryStore.lobbies.get(code);
      if (!lobby) return cb?.({ ok: false });
      const isHost = lobby.players.find(p => p.socketId === socket.id)?.isHost;
      if (!isHost) return cb?.({ ok: false, error: 'ONLY_HOST' });

      lobbyService.setSettings(code, settings);
      io.to(code).emit('lobby:settings', lobby.settings);
      cb?.({ ok: true });
    });

    // SPIEL: starten
    socket.on('game:start', ({ code }, cb) => {
      const lobby = memoryStore.lobbies.get(code);
      if (!lobby) return cb?.({ ok: false });
      const isHost = lobby.players.find(p => p.socketId === socket.id)?.isHost;
      if (!isHost) return cb?.({ ok: false, error: 'ONLY_HOST' });

      const res = gameService.startGame(code, lobby.settings || { category: 'standard', timerSeconds: 300 });
      if (!res.ok) return cb?.(res);

      io.to(code).emit('game:started', res.publicInfo);

      // Karten pro Spieler (privat)
      lobby.players.forEach(p => {
        const info = res.perPlayer.get(p.socketId);
        if (info) io.to(p.socketId).emit('game:deal', info);
      });

      const activeId = gameService.getActive(code);
      const activeName = lobby.players.find(p => p.id === activeId)?.name;

      io.to(code).emit('turn:start', {
        activeId,
        activeName,
        order: res.publicInfo.order,
        players: chatService.getPlayerPublic(code)
      });

      // Timer starten – Ende triggert Auto-Vote
      timerService.start(code, lobby.settings.timerSeconds, io);
      cb?.({ ok: true });
    });

    // ZUG: Next (nur aktiver)
    socket.on('turn:next', ({ code }) => {
      const lobby = memoryStore.lobbies.get(code);
      if (!lobby?.game) return;
      if (gameService.getActive(code) !== socket.id) return;

      const nextId = gameService.nextTurn(code);
      const nextName = lobby.players.find(p => p.id === nextId)?.name;

      io.to(code).emit('turn:start', {
        activeId: nextId,
        activeName: nextName,
        order: lobby.game.order,
        players: chatService.getPlayerPublic(code)
      });
    });

    // CHAT: nur aktiver darf senden
    socket.on('chat:send', ({ code, text }) => {
      if (!text?.trim()) return;
      const lobby = memoryStore.lobbies.get(code);
      if (!lobby) return;
      if (gameService.getActive(code) !== socket.id) return;

      const sender = lobby.players.find(p => p.id === socket.id);
      if (!sender) return;

      io.to(code).emit('chat:message', {
        fromId: sender.id,
        fromName: sender.name,
        text: String(text).slice(0, 400)
      });
    });

    // VOTING – Proposal (nur aktiver darf starten)
    socket.on('vote:propose', ({ code }) => {
      const lobby = memoryStore.lobbies.get(code);
      if (!lobby?.game) return;
      if (gameService.getActive(code) !== socket.id) return;

      voteService.startProposal(code);
      io.to(code).emit('vote:proposal'); // Ja/Nein
    });

    socket.on('vote:decision', ({ code, yes }) => {
      const res = voteService.decide(code, socket.id, !!yes);
      if (!res) return;
      if (res.repeat) return;
      io.to(code).emit('vote:progress', { yes: res.yesCount, total: res.total, threshold: res.threshold });
      if (res.proceed) {
        voteService.startAccusation(code);
        io.to(code).emit('vote:start', { players: chatService.getPlayerPublic(code) });
      }
    });

    // VOTING – Kandidat wählen
    socket.on('vote:cast', ({ code, targetId }) => {
      const res = voteService.cast(code, socket.id, targetId);
      if (!res) return;

      if (res.done) {
        const lobby = memoryStore.lobbies.get(code);
        const g = lobby.game;

        const chosen = lobby.players.find(p => p.id === res.top);
        const impostor = lobby.players.find(p => p.id === g.impostorId);

        io.to(code).emit('vote:result', { top: res.top, tally: res.tally });

        // Reveal-Karte: Front = Gewählter, Back = echter Imposter + Wort
        io.to(code).emit('reveal:show', {
          chosenId: chosen?.id,
          chosenName: chosen?.name || '???',
          impostorId: impostor?.id,
          impostorName: impostor?.name || '???',
          correct: res.isImpostor === true,
          word: g.word
        });

        // ➜ Nach kurzer Zeit Spiel sauber beenden & UI zurücksetzen
        setTimeout(() => {
          timerService.stop(code);       // Timer sicher stoppen
          lobbyService.resetGame(code);  // Zustand leeren
          io.to(code).emit('game:ended', { code });
        }, 3000);
      } else {
        io.to(code).emit('vote:tally', res.tally);
      }
    });

    // Optional: manueller Reset
    socket.on('game:reset', ({ code }) => {
      timerService.stop(code);
      lobbyService.resetGame(code);
      io.to(code).emit('game:ended', { code });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const affected = lobbyService.leaveAll(socket.id);
      affected.forEach((code) => {
        io.to(code).emit('lobby:update', lobbyService.getLobbyView(code));
      });
    });
  });
}
