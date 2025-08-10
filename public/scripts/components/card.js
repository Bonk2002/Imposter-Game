// Erstellt eine Flipkarte und gibt {el, flip, setLocked} zurück
export function createDealCard({ role, text }) {
  const scene = document.createElement('div');
  scene.className = 'scene deal-in';

  const card = document.createElement('div');
  card.className = 'card3d';
  scene.appendChild(card);

  const front = document.createElement('div');
  front.className = 'card-face card-front';
  front.innerHTML = `
    <div>
      <div class="card-title">Tippe, um deine Karte zu sehen</div>
      <div class="card-text">🎴</div>
    </div>`;
  card.appendChild(front);

  const back = document.createElement('div');
  back.className = 'card-face card-back';
  back.innerHTML = `
    <div>
      <div class="card-title">${role === 'IMPOSTER' ? 'Du bist der IMPOSTER' : 'Du bist Crew'}</div>
      <div class="card-text">${text}</div>
    </div>`;
  card.appendChild(back);

  let locked = false;
  const flip = () => { if (!locked) card.classList.toggle('is-flipped'); };
  const setLocked = (v) => { locked = !!v; };

  scene.addEventListener('click', flip);

  return { el: scene, flip, setLocked };
}
