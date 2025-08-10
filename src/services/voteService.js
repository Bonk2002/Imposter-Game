// src/services/voteService.js
import { memoryStore } from '../store/memoryStore.js';

export const voteService = {
  // Phase 1: Abstimmen, ob überhaupt gevotet werden soll
  startProposal(code) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby?.game) return null;
    lobby.game.vote = { phase: 'proposal', yes: new Set(), no: new Set(), decided: new Set() };
    return { phase: 'proposal' };
  },

  decide(code, socketId, yes) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby?.game?.vote || lobby.game.vote.phase !== 'proposal') return null;
    const v = lobby.game.vote;
    if (v.decided.has(socketId)) return { repeat: true }; // doppelt ignorieren
    v.decided.add(socketId);
    (yes ? v.yes : v.no).add(socketId);

    const total = lobby.players.length;
    const yesCount = v.yes.size;
    const threshold = Math.ceil(total * 0.5);
    const proceed = yesCount >= threshold;
    return { total, yesCount, threshold, proceed };
  },

  // Phase 2: Anschuldigen
  startAccusation(code) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby?.game) return null;
    lobby.game.vote = { phase: 'accuse', votes: new Map() }; // voterId -> targetId
    return { phase: 'accuse' };
  },

  cast(code, voterId, targetId) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby?.game?.vote || lobby.game.vote.phase !== 'accuse') return null;
    lobby.game.vote.votes.set(voterId, targetId);

    // Tally
    const tally = {};
    for (const t of lobby.game.vote.votes.values()) tally[t] = (tally[t] || 0) + 1;

    // Fertig, wenn alle gewählt haben
    if (lobby.game.vote.votes.size === lobby.players.length) {
      let top = null, max = -1;
      Object.entries(tally).forEach(([id,cnt]) => { if (cnt>max) {max=cnt; top=id;} });
      lobby.game.vote.result = { top, tally };
      lobby.game.vote.phase = 'result';
      const isImpostor = lobby.game.impostorId === top;
      return { done:true, top, tally, isImpostor, word: lobby.game.word, hint: lobby.game.hint };
    }
    return { done:false, tally };
  }
};
