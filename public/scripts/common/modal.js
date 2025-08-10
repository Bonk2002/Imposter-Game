export function modal(htmlBuilder){
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const box = document.createElement('div');
  box.className = 'modal';
  back.appendChild(box);
  box.innerHTML = htmlBuilder?.() || '';
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  document.body.appendChild(back);
  return { el: back, box, close: () => back.remove() };
}
