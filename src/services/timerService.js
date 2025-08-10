// src/services/timerService.js
import { memoryStore } from '../store/memoryStore.js';
import { chatService } from './chatService.js';
import { voteService } from './voteService.js';

const intervals = new Map(); // code -> setInterval id

export const timerService = {
  start(code, seconds, io) {
    this.stop(code); // safety: alte Intervalle wegräumen

    const lobby = memoryStore.lobbies.get(code);
    if (!lobby || !lobby.game) return;

    lobby.game.endsAt = Date.now() + Number(seconds || 0) * 1000;

    const tick = () => {
      const lb = memoryStore.lobbies.get(code);
      if (!lb || !lb.game) {
        // Lobby oder Spiel weg? -> Timer stoppen.
        this.stop(code);
        return;
      }

      const now = Date.now();
      const remain = Math.max(0, Math.ceil((lb.game.endsAt - now) / 1000));
      io.to(code).emit('timer:tock', { remain });

      if (remain <= 0) {
        this.stop(code);
        io.to(code).emit('timer:end');

        // Auto-Vote (direkt Kandidatenwahl)
        voteService.startAccusation(code);
        io.to(code).emit('vote:start', { players: chatService.getPlayerPublic(code) });
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    intervals.set(code, id);
  },

  stop(code) {
    const id = intervals.get(code);
    if (id) {
      clearInterval(id);
      intervals.delete(code);
    }
  }
};
