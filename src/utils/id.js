const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // ohne leicht verwechselbare Zeichen

export function makeCode(len = 5) {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}
