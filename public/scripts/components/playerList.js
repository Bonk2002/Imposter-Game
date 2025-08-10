export function renderOrder(listEl, players, order, activeId) {
  listEl.innerHTML = '';
  order.forEach(id => {
    const p = players.find(x => x.id === id);
    const li = document.createElement('li');
    li.textContent = p ? p.name : id.slice(0,4);
    if (id === activeId) li.classList.add('active');
    listEl.appendChild(li);
  });
}
