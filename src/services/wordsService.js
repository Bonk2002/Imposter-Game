import fs from 'node:fs';
import path from 'node:path';

const dataPath = path.join(process.cwd(), 'data', 'words.json');
const raw = fs.readFileSync(dataPath, 'utf-8');
const WORDS = JSON.parse(raw);

export const wordsService = {
  getCategories() {
    return Object.keys(WORDS);
  },
  drawPair(category) {
    const list = WORDS[category] || [];
    if (!list.length) return null;
    const idx = Math.floor(Math.random() * list.length);
    const [word, hint] = list[idx];
    return { word, hint };
  }
};
