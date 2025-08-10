import { memoryStore } from '../store/memoryStore.js';
import { gameService } from './gameService.js';

export const chatService = {
  canSend(code, socketId) {
    const active = gameService.getActive(code);
    return active === socketId;
  },
  getPlayerPublic(code) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby) return [];
    return lobby.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost }));
  }
};
