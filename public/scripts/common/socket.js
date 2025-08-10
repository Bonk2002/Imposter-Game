import { io } from "socket.io-client";

// In Dev direkt auf 3001 gehen, Prod = gleiche Origin
const baseURL = import.meta.env.DEV
    ? "http://localhost:3001"
    : "/";

export const socket = io(baseURL, {
  transports: ["websocket", "polling"],
  withCredentials: true
});

socket.on("connect", () => console.log("🔌 Verbunden:", socket.id));
socket.on("hello", (d) => console.log("👋 Server says:", d));
