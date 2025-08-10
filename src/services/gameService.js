// src/services/gameService.js
import { memoryStore } from '../store/memoryStore.js';
import { shuffle } from '../utils/shuffle.js';
import { wordsService } from './wordsService.js';

export const gameService = {
  startGame(code, settings) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby || lobby.players.length < 2) {
      return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };
    }

    lobby.settings = {
      category: settings?.category || 'standard',
      timerSeconds: Number(settings?.timerSeconds || 300)
    };

    const order = shuffle([...lobby.players.map(p => p.id)]); // id === socketId
    const impostorId = order[Math.floor(Math.random() * order.length)];
    const pair = wordsService.drawPair(lobby.settings.category);
    if (!pair) return { ok: false, error: 'NO_WORDS' };

    const perPlayer = new Map();
    lobby.players.forEach(p => {
      perPlayer.set(p.socketId, {
        role: p.id === impostorId ? 'IMPOSTER' : 'CREW',
        text: p.id === impostorId ? pair.hint : pair.word
      });
    });

    lobby.game = {
      active: true,
      category: lobby.settings.category,
      timerSeconds: lobby.settings.timerSeconds,
      order,
      activeIndex: 0,
      impostorId,
      word: pair.word,
      hint: pair.hint,
      endsAt: null,
      vote: null
    };

    return {
      ok: true,
      publicInfo: {
        order,
        timerSeconds: lobby.settings.timerSeconds,
        category: lobby.settings.category
      },
      perPlayer
    };
  },

  getActive(code) {
    const g = memoryStore.lobbies.get(code)?.game;
    if (!g) return null;
    return g.order[g.activeIndex];
  },

  nextTurn(code) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby?.game) return null;
    lobby.game.activeIndex = (lobby.game.activeIndex + 1) % lobby.game.order.length;
    return this.getActive(code);
  },

  // ➜ für Reload/Späteinstieg: persönliche Rollen-/Wortinfo
  getPersonalInfo(code, socketId) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby?.game) return null;
    const g = lobby.game;
    const isImpostor = g.impostorId === socketId;
    return {
      role: isImpostor ? 'IMPOSTER' : 'CREW',
      text: isImpostor ? g.hint : g.word
    };
  }
};
