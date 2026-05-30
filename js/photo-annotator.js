/* ═══════════════════════════════════════════
   Elle Levantamento — Photo Annotator (Módulo 3)
   Anotações de medidas, setas e texto sobre fotos
   ═══════════════════════════════════════════ */

const PhotoAnnotator = {

  project: null,
  pin:     null,
  canvas:  null,
  ctx:     null,
  img:     null,

  currentTool: 'line',
  drawStart:   null,
  mousePos:    { x: 0, y: 0 },

  _touches:       [],
  _touchMoved:    false,
  _touchStartPos: null,

  // ── Open ──────────────────────────────────

  open(projectId, pinId) {
    const p = Storage.get(projectId);
    if (!p) return;
    this.project = p;
    this.pin     = p.canvas.photoPins.find(pin => pin.id === pinId);
    if (!this.pin || !this.pin.photoData) { App.openProject(projectId); return; }
    if (!this.pin.annotations) this.pin.annotations = [];

    this.drawStart = null;
    this._renderShell();
    this._initCanvas();
  },

  // ── Shell ─────────────────────────────────

  _renderShell() {
    document.getElementById('app').innerHTML = `
      <div class="photo-annotator">

        <header class="editor-header">
          <button class="btn-ghost" id="pa-back" style="padding:6px 11px; font-size:12px;">
            ${this._ic('chevron-left')} Voltar
          </button>
          <div class="editor-project-info">
            <div class="editor-project-name">Foto F${this.pin.sequenceNumber}</div>
            <div class="editor-project-sub">${esc(this.project.name)}</div>
          </div>
          <div style="display:flex;gap:6px;margin-left:10px;">
            <button class="btn-ghost" id="pa-undo" style="padding:6px 10px;">
              ${this._ic('undo')}
            </button>
            <button class="btn-ghost" id="pa-clear"
              style="padding:6px 11px; font-size:12px; color:var(--red); border-color:rgba(192,80,80,0.3);">
              Limpar
            </button>
          </div>
        </header>

        <div class="editor-toolbar">
          <div class="tool-group">
            <button class="tool-btn active" data-pa-tool="line">
              ${this._ic('ruler')} Medida
            </button>
            <button class="tool-btn" data-pa-tool="arrow">
              ${this._ic('arrow')} Seta
            </button>
            <button class="tool-btn" data-pa-tool="text">
              ${this._ic('text-t')} Texto
            </button>
            <button class="tool-btn" data-pa-tool="rect">
              ${this._ic('rect')} Destaque
            </button>
          </div>
          <div style="flex:1;"></div>
          <div style="font-size:10px; color:var(--text-faint); padding:0 8px;">
            Toque: primeiro ponto → segundo ponto
          </div>
        </div>

        <div class="pa-body" id="pa-body">
          <canvas id="pa-canvas"></canvas>
        </div>

      </div>
    `;

    document.getElementById('pa-back').addEventListener('click', () => this._back());
    document.getElementById('pa-undo').addEventListener('click', () => this._undo());
    document.getElementById('pa-clear').addEventListener('click', () => this._confirmClear());

    document.querySelectorAll('[data-pa-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTool = btn.dataset.paTool;
        this.drawStart   = null;
        document.querySelectorAll('[data-pa-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  // ── Canvas init ───────────────────────────

  _initCanvas() {
    this.canvas = document.getElementById('pa-canvas');
    this.ctx    = this.canvas.getContext('2d');
    const body  = document.getElementById('pa-body');
    this.canvas.width  = body.clientWidth;
    this.canvas.height = body.clientHeight;

    this.img = new Image();
    this.img.onload = () => this._draw();
    this.img.src    = this.pin.photoData;

    this.canvas.addEventListener('mousedown',  e => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove',  e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup',    e => this._onMouseUp(e));
    this.canvas.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove',  e => this._onTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend',   e => this._onTouchEnd(e));
  },

  // ── Draw ──────────────────────────────────

  _draw() {
    if (!this.ctx || !this.img || !this.img.complete) return;
    const C   = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, C.width, C.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, C.width, C.height);

    // Draw photo fitted to canvas
    const fit = this._fit();
    ctx.drawImage(this.img, fit.dx, fit.dy, fit.dw, fit.dh);

    // Draw saved annotations
    for (const ann of this.pin.annotations) this._drawAnn(ctx, ann);

    // Draw in-progress preview
    if (this.drawStart) this._drawPreview(ctx);
  },

  _fit() {
    const C  = this.canvas;
    const iw = this.img.naturalWidth;
    const ih = this.img.naturalHeight;
    const s  = Math.min(C.width / iw, C.height / ih);
    const dw = iw * s, dh = ih * s;
    return { dx: (C.width - dw) / 2, dy: (C.height - dh) / 2, dw, dh };
  },

  _drawAnn(ctx, ann) {
    ctx.save();
    const yellow = '#F5C842';
    ctx.strokeStyle = yellow;
    ctx.fillStyle   = yellow;
    ctx.lineWidth   = 2.5;

    if (ann.type === 'line') {
      ctx.setLineDash([7, 3]);
      ctx.beginPath(); ctx.moveTo(ann.x1, ann.y1); ctx.lineTo(ann.x2, ann.y2); ctx.stroke();
      ctx.setLineDash([]);
      for (const [x, y] of [[ann.x1, ann.y1], [ann.x2, ann.y2]]) {
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      }
      if (ann.label) {
        const mx = (ann.x1 + ann.x2) / 2;
        const my = (ann.y1 + ann.y2) / 2;
        ctx.font = 'bold 13px Inter, sans-serif';
        const tw = ctx.measureText(ann.label).width;
        ctx.fillStyle = 'rgba(26,24,20,0.82)';
        ctx.fillRect(mx - tw / 2 - 5, my - 18, tw + 10, 22);
        ctx.fillStyle = yellow;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ann.label, mx, my - 7);
        ctx.textBaseline = 'alphabetic';
      }

    } else if (ann.type === 'arrow') {
      this._arrow(ctx, ann.x1, ann.y1, ann.x2, ann.y2);
      if (ann.label) {
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ann.label, (ann.x1 + ann.x2) / 2, (ann.y1 + ann.y2) / 2 - 10);
      }

    } else if (ann.type === 'rect') {
      ctx.strokeStyle = 'rgba(245,200,66,0.9)';
      ctx.fillStyle   = 'rgba(245,200,66,0.12)';
      const x = Math.min(ann.x1, ann.x2), y = Math.min(ann.y1, ann.y2);
      const w = Math.abs(ann.x2 - ann.x1),  h = Math.abs(ann.y2 - ann.y1);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);

    } else if (ann.type === 'text') {
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textBaseline = 'top';
      ctx.strokeStyle = 'rgba(26,24,20,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(ann.text || '', ann.x1, ann.y1);
      ctx.fillText(ann.text || '', ann.x1, ann.y1);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.restore();
  },

  _drawPreview(ctx) {
    if (!this.drawStart || !this.mousePos) return;
    const { x: x1, y: y1 } = this.drawStart;
    const { x: x2, y: y2 } = this.mousePos;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#F5C842';
    ctx.fillStyle   = '#F5C842';
    ctx.lineWidth   = 2;

    if (this.currentTool === 'line') {
      ctx.setLineDash([7, 3]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
    } else if (this.currentTool === 'arrow') {
      this._arrow(ctx, x1, y1, x2, y2);
    } else if (this.currentTool === 'rect') {
      const x = Math.min(x1, x2), y = Math.min(y1, y2);
      ctx.fillStyle = 'rgba(245,200,66,0.1)';
      ctx.strokeRect(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.fillRect(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
    }

    ctx.restore();
  },

  _arrow(ctx, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (!len) return;
    const ux = dx / len, uy = dy / len;
    const h  = 14;
    const ax = x2 - ux * h, ay = y2 - uy * h;
    const px = -uy * h / 2, py = ux * h / 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(ax + px, ay + py); ctx.lineTo(ax - px, ay - py); ctx.closePath(); ctx.fill();
  },

  // ── Coordinate helper ──────────────────────

  _pos(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  },

  // ── Mouse ─────────────────────────────────

  _onMouseDown(e) {
    if (e.button !== 0) return;
    const pos = this._pos(e.clientX, e.clientY);
    if (this.currentTool === 'text') { this._promptText(pos); return; }
    this.drawStart = pos;
  },

  _onMouseMove(e) {
    this.mousePos = this._pos(e.clientX, e.clientY);
    if (this.drawStart) this._draw();
  },

  _onMouseUp(e) {
    if (e.button !== 0 || !this.drawStart) return;
    const pos = this._pos(e.clientX, e.clientY);
    this._finish(pos);
  },

  // ── Touch ─────────────────────────────────

  _onTouchStart(e) {
    e.preventDefault();
    this._touches      = Array.from(e.touches);
    this._touchMoved   = false;
    if (e.touches.length === 1) {
      this._touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.mousePos       = this._pos(e.touches[0].clientX, e.touches[0].clientY);
    }
  },

  _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (this._touchStartPos) {
        const dx = t.clientX - this._touchStartPos.x;
        const dy = t.clientY - this._touchStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) this._touchMoved = true;
      }
      this.mousePos = this._pos(t.clientX, t.clientY);
      if (this.drawStart) this._draw();
    }
    this._touches = Array.from(e.touches);
  },

  _onTouchEnd(e) {
    e.preventDefault();
    if (e.changedTouches.length === 1 && !this._touchMoved) {
      const t   = e.changedTouches[0];
      const pos = this._pos(t.clientX, t.clientY);

      if (this.currentTool === 'text') {
        this._promptText(pos);
      } else if (!this.drawStart) {
        this.drawStart = pos;
      } else {
        this._finish(pos);
      }
    }
    this._touches    = Array.from(e.touches);
    this._touchMoved = false;
  },

  // ── Finish action ──────────────────────────

  _finish(pos) {
    if (!this.drawStart) return;
    const d = dist(this.drawStart.x, this.drawStart.y, pos.x, pos.y);
    if (d < 6) { this.drawStart = null; return; }

    if (this.currentTool === 'line') {
      this._promptLineLabel(this.drawStart, pos);
    } else if (this.currentTool === 'arrow') {
      this._promptArrowLabel(this.drawStart, pos);
    } else if (this.currentTool === 'rect') {
      this.pin.annotations.push({ type: 'rect', x1: this.drawStart.x, y1: this.drawStart.y, x2: pos.x, y2: pos.y });
      this._save();
      this.drawStart = null;
      this._draw();
    }
  },

  // ── Modals ────────────────────────────────

  _promptLineLabel(start, end) {
    Modal.open(`
      <div class="modal-header">
        <h2 class="modal-title">Rótulo da medida</h2>
        <button class="modal-close" id="mc"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-muted); font-size:12px; margin-bottom:10px;">Informe a medida real (Ex: 1,50m ou 300mm) — ou deixe vazio</p>
        <input class="form-input" id="ll-input" type="text" placeholder="Ex: 2,35m" autofocus>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="ll-cancel">Cancelar</button>
        <button class="btn-primary" id="ll-ok">Salvar</button>
      </div>
    `);
    setTimeout(() => document.getElementById('ll-input')?.focus(), 80);
    const save = () => {
      const label = (document.getElementById('ll-input')?.value || '').trim() || null;
      this.pin.annotations.push({ type: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y, label });
      this._save(); this.drawStart = null; this._draw(); Modal.close();
    };
    document.getElementById('mc').addEventListener('click', () => { this.drawStart = null; this._draw(); Modal.close(); });
    document.getElementById('ll-cancel').addEventListener('click', () => { this.drawStart = null; this._draw(); Modal.close(); });
    document.getElementById('ll-ok').addEventListener('click', save);
    document.getElementById('ll-input').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  },

  _promptArrowLabel(start, end) {
    Modal.open(`
      <div class="modal-header">
        <h2 class="modal-title">Rótulo da seta (opcional)</h2>
        <button class="modal-close" id="mc"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></button>
      </div>
      <div class="modal-body">
        <input class="form-input" id="al-input" type="text" placeholder="Ex: Saída esgoto existente" autofocus>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="al-skip">Sem rótulo</button>
        <button class="btn-primary" id="al-ok">Salvar</button>
      </div>
    `);
    setTimeout(() => document.getElementById('al-input')?.focus(), 80);
    const save = () => {
      const label = (document.getElementById('al-input')?.value || '').trim() || null;
      this.pin.annotations.push({ type: 'arrow', x1: start.x, y1: start.y, x2: end.x, y2: end.y, label });
      this._save(); this.drawStart = null; this._draw(); Modal.close();
    };
    document.getElementById('mc').addEventListener('click', () => { this.drawStart = null; this._draw(); Modal.close(); });
    document.getElementById('al-skip').addEventListener('click', () => {
      this.pin.annotations.push({ type: 'arrow', x1: start.x, y1: start.y, x2: end.x, y2: end.y, label: null });
      this._save(); this.drawStart = null; this._draw(); Modal.close();
    });
    document.getElementById('al-ok').addEventListener('click', save);
  },

  _promptText(pos) {
    Modal.open(`
      <div class="modal-header">
        <h2 class="modal-title">Adicionar texto</h2>
        <button class="modal-close" id="mc"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></button>
      </div>
      <div class="modal-body">
        <input class="form-input" id="tx-input" type="text" placeholder="Ex: Tomada existente" autofocus>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="tx-cancel">Cancelar</button>
        <button class="btn-primary" id="tx-ok">Adicionar</button>
      </div>
    `);
    setTimeout(() => document.getElementById('tx-input')?.focus(), 80);
    const save = () => {
      const text = (document.getElementById('tx-input')?.value || '').trim();
      if (!text) return;
      this.pin.annotations.push({ type: 'text', x1: pos.x, y1: pos.y, text });
      this._save(); this._draw(); Modal.close();
    };
    document.getElementById('mc').addEventListener('click', () => Modal.close());
    document.getElementById('tx-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('tx-ok').addEventListener('click', save);
    document.getElementById('tx-input').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  },

  _undo() {
    if (!this.pin.annotations.length) { Toast.show('Nada para desfazer', 'info'); return; }
    this.pin.annotations.pop();
    this._save(); this._draw();
  },

  _confirmClear() {
    Modal.open(`
      <div class="modal-header"><h2 class="modal-title">Limpar anotações</h2></div>
      <div class="modal-body"><p class="confirm-text">Remover todas as anotações desta foto?</p></div>
      <div class="modal-footer">
        <button class="btn-ghost" id="mc-cancel">Cancelar</button>
        <button class="btn-danger-solid" id="mc-ok">Limpar</button>
      </div>
    `);
    document.getElementById('mc-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('mc-ok').addEventListener('click', () => {
      this.pin.annotations = [];
      this._save(); this._draw(); Modal.close();
    });
  },

  _save() { Storage.save(this.project); },

  _back() {
    this._save();
    App.openProject(this.project.id);
  },

  // ── Icons ─────────────────────────────────

  _ic(name) {
    const icons = {
      'chevron-left': `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2.5L4.5 6.5L8 10.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'undo':   `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 4.5h6a3.5 3.5 0 1 1 0 7H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 2L2 4.5L4.5 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'ruler':  `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M2 4.5v5M12 4.5v5M5 5.5v3M8 5.5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      'arrow':  `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 11L11 3M7 3h4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'text-t': `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M7 4v7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
      'rect':   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="3.5" width="10" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>`,
    };
    return icons[name] || '';
  },
};
