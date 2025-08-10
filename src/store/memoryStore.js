export const memoryStore = {
  lobbies: new Map(),       // code -> {code, players[]}
  playerToLobby: new Map()  // socketId -> code
};
