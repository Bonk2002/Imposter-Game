export function toast(message, ms = 2200) {
  let c = document.getElementById('toast-root');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-root';
    c.style.position = 'fixed';
    c.style.bottom = '20px';
    c.style.left = '50%';
    c.style.transform = 'translateX(-50%)';
    c.style.zIndex = '9999';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.textContent = message;
  t.style.padding = '12px 16px';
  t.style.marginTop = '8px';
  t.style.background = 'rgba(20,24,45,.95)';
  t.style.border = '1px solid #2a2f55';
  t.style.color = '#e6e9ff';
  t.style.borderRadius = '12px';
  t.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)';
  t.style.fontWeight = '600';
  t.style.maxWidth = '80vw';
  t.style.textAlign = 'center';
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .25s ease';
    setTimeout(() => t.remove(), 250);
  }, ms);
}
