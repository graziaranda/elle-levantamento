/* ═══════════════════════════════════════════
   Elle Levantamento — App (router + ui helpers)
   ═══════════════════════════════════════════ */

// ── Router ────────────────────────────────

const App = {
  navigate(path) {
    window.location.hash = path.startsWith('/') ? path : '/' + path;
  },

  openProject(id) {
    this.navigate(`/project/${id}`);
  },

  _route() {
    const hash  = window.location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/');

    if (parts[0] === 'project' && parts[1]) {
      CanvasEditor.open(parts[1]);
    } else {
      Dashboard.render();
    }
  },

  start() {
    window.addEventListener('hashchange', () => this._route());
    this._route();
  },
};

// ── Modal ─────────────────────────────────

const Modal = {
  open(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal-box">${html}</div>
      </div>
    `;
    document.getElementById('modal-backdrop').addEventListener('click', e => {
      if (e.target.id === 'modal-backdrop') this.close();
    });
    requestAnimationFrame(() => {
      root.querySelector('.modal-backdrop').classList.add('visible');
    });
  },

  close() {
    const root = document.getElementById('modal-root');
    const bd   = root.querySelector('.modal-backdrop');
    if (!bd) return;
    bd.classList.remove('visible');
    setTimeout(() => { root.innerHTML = ''; }, 210);
  },
};

// ── Toast ─────────────────────────────────

const Toast = {
  show(msg, type = 'info', ms = 3000) {
    const root = document.getElementById('toast-root');
    const el   = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 220);
    }, ms);
  },
};

// ── Error overlay ─────────────────────────
// Mostra erros de JavaScript na própria tela. No tablet não há console
// acessível, então qualquer falha silenciosa ficava invisível — agora
// aparece um aviso vermelho que pode ser fotografado/enviado.

function showErrorOverlay(msg) {
  let el = document.getElementById('error-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'error-overlay';
    el.style.cssText =
      'position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;' +
      'background:#2a1414;border:1px solid #c05050;border-radius:8px;' +
      'color:#f3d0d0;font:12px/1.5 monospace;padding:10px 36px 10px 12px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.5);max-height:40vh;overflow:auto;';
    const close = document.createElement('button');
    close.textContent = '×';
    close.style.cssText =
      'position:absolute;top:6px;right:8px;background:none;border:none;' +
      'color:#f3d0d0;font-size:20px;line-height:1;cursor:pointer;';
    close.addEventListener('click', () => el.remove());
    el.appendChild(close);
    el._body = document.createElement('div');
    el.appendChild(el._body);
    document.body.appendChild(el);
  }
  const line = document.createElement('div');
  line.textContent = '⚠ ' + msg;
  el._body.appendChild(line);
}

window.addEventListener('error', e => {
  showErrorOverlay((e.message || 'Erro') + (e.filename ? ` (${e.lineno})` : ''));
});
window.addEventListener('unhandledrejection', e => {
  showErrorOverlay('Promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});

// ── Portrait warning ──────────────────────

function checkOrientation() {
  const el = document.getElementById('portrait-warn');
  if (!el) return;
  el.style.display = (window.innerHeight > window.innerWidth && window.innerWidth < 768)
    ? 'flex' : 'none';
}

// ── Init ──────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Portrait warning overlay (injected once)
  const warn = document.createElement('div');
  warn.id = 'portrait-warn';
  warn.className = 'portrait-warning';
  warn.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="14" y="4" width="20" height="32" rx="3" stroke="#4A3F32" stroke-width="2"/>
      <path d="M24 32v8M20 40h8" stroke="#C9A84C" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <p style="color:var(--text-muted);font-size:15px;">Gire o tablet para modo paisagem</p>
    <p style="color:var(--text-faint);font-size:12px;">Elle Levantamento funciona melhor em orientação horizontal</p>
  `;
  document.body.appendChild(warn);

  window.addEventListener('resize', checkOrientation);
  checkOrientation();

  App.start();
});
