// src/services/lobbyService.js
import { memoryStore } from '../store/memoryStore.js';
import { makeCode } from '../utils/id.js';

export const lobbyService = {
  createLobby(hostName, socketId) {
    const code = makeCode();
    memoryStore.lobbies.set(code, {
      code,
      players: [], // { id, name, socketId, isHost }
      settings: {
        category: 'standard',
        timerSeconds: 300
      },
      createdAt: Date.now(),
      game: null
    });

    const host = {
      id: socketId,
      name: hostName || 'Host',
      socketId,
      isHost: true
    };

    memoryStore.lobbies.get(code).players.push(host);
    memoryStore.playerToLobby.set(socketId, code);

    return { code, host };
  },

  joinLobby(code, playerName, socketId) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby) return { ok: false, error: 'LOBBY_NOT_FOUND' };

    const exists = lobby.players.some(
      p => p.name.trim().toLowerCase() === (playerName || '').trim().toLowerCase()
    );
    if (exists) return { ok: false, error: 'NAME_TAKEN' };

    const player = { id: socketId, name: playerName, socketId, isHost: false };
    lobby.players.push(player);
    memoryStore.playerToLobby.set(socketId, code);

    return { ok: true, lobby: this.getLobbyView(code) };
  },

  leaveAll(socketId) {
    const code = memoryStore.playerToLobby.get(socketId);
    if (!code) return [];
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby) return [];

    lobby.players = lobby.players.filter(p => p.socketId !== socketId);
    memoryStore.playerToLobby.delete(socketId);

    if (lobby.players.length === 0) {
      memoryStore.lobbies.delete(code);
    }
    return [code];
  },

  setSettings(code, settings) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby) return { ok: false, error: 'LOBBY_NOT_FOUND' };
    const next = {
      category: settings?.category ?? lobby.settings?.category ?? 'standard',
      timerSeconds: Number(settings?.timerSeconds ?? lobby.settings?.timerSeconds ?? 300)
    };
    lobby.settings = next;
    return { ok: true, settings: next };
  },

  resetGame(code) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby) return { ok: false, error: 'LOBBY_NOT_FOUND' };
    lobby.game = null;
    return { ok: true };
  },

  getLobbyView(code) {
    const lobby = memoryStore.lobbies.get(code);
    if (!lobby) return null;
    return {
      code: lobby.code,
      players: lobby.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })),
      settings: lobby.settings,
      createdAt: lobby.createdAt,
      gameActive: Boolean(lobby.game?.active)
    };
  }
};
