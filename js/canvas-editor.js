/* ═══════════════════════════════════════════
   Elle Levantamento — Canvas Editor (Módulo 2)
   Ferramentas: parede, cota, abertura, instalação, foto, nota
   Coordenadas internas: milímetros
   ═══════════════════════════════════════════ */

// Formata mm → "X,XXm" (sempre metros, 2 casas decimais, vírgula PT-BR)
function fmtM(mm) {
  return (mm / 1000).toFixed(2).replace('.', ',') + 'm';
}

const CanvasEditor = {

  // ── State ─────────────────────────────────

  project: null,
  canvas:  null,
  ctx:     null,

  zoom:  0.15,   // px / mm
  panX:  200,
  panY:  200,

  currentTool: 'wall',
  drawStart:   null,   // first click in a two-click tool
  mouseWorld:  { x: 0, y: 0 },

  selected: null,  // { type: 'wall'|'dim'|'inst'|'note', id }

  isPanning:    false,
  panStart:     null,

  // Touch tracking
  _touchMoved:    false,
  _touchStartPos: null,

  // Environment polygon in progress
  envPoints: [],

  // Parede guiada (cadeia de pontos do contorno em desenho)
  _chainPts:   null,   // [{x,y}] ou null
  _aiming:     false,  // arrastando para definir a direção
  _aimAngle:   null,   // ângulo travado durante o arraste
  _aimClosing: false,  // mira está fechando no 1º ponto
  _snapBadge:  null,   // string do ângulo travado exibida no preview (C-07)
  _archSnapPt: null,   // ponto arquitetônico capturado pelo snap magnético de cota
  _wallSnapPt: null,   // endpoint de parede capturado pelo snap magnético de parede

  // Inserção de porta/janela arrastando até a parede
  _placingOpening: null,  // { type, wallId, position, cx, cy } | null
  _aimingOpening:  false,
  _openingPreview: null,  // abertura em edição (prévia ao vivo no formulário)

  // Inserção de instalação arrastando até a parede (igual à abertura)
  _placingInstall: null,  // { wallId, wallT, refX, refY } | null
  _aimingInstall:  false,
  _installPreview: null,  // { x, y, type } para prévia ao vivo

  // Scale calibration state: null | { p1: {x,y} }
  _scaleTool: null,

  // Cached background image element
  _bgImg: null,

  history:      [],
  historyIdx:   -1,

  _saveTimer:   null,
  _saveState:   'saved',
  _autoInterval: null,
  _keyHandler:        null,
  _resizeHandler:     null,
  _visibilityHandler: null,
  _hydratePromise:    null,   // Promise de hidratação das imagens do IndexedDB

  // Modo ortogonal: força paredes em 0°/90°/180°/270° (padrão ON)
  _orthoMode: true,

  // Modo bússola: planta gira com o tablet
  _compassMode:    false,
  _compassHeading: 0,      // graus suavizados (0 = norte)
  _compassRaw:     null,   // leitura bruta para suavização
  _compassHandler: null,   // referência para removeEventListener

  // Contorno de ambiente cancelado — preserva pts para btn-close-env
  _pendingEnvPts:  null,

  // Throttle de renderização: evita múltiplos _draw() por frame
  _drawPending: false,

  // Drag visual de parede no modo Select
  // { wallId, mode: 'p1'|'p2'|'body', startWorld, origX1, origY1, origX2, origY2 }
  _wallDrag: null,

  // Previne criação de parede acidental após zoom com 2 dedos
  _hadTwoFingerGesture: false,

  // Long press para travar parede (timer ID)
  _longPressTimer: null,

  // ── Open ──────────────────────────────────

  open(projectId) {
    // Storage.get() é assíncrono (lê do IndexedDB com fallback ao localStorage).
    // Todo o setup do editor ocorre dentro do .then() para garantir que os dados
    // do projeto estejam disponíveis antes de renderizar qualquer coisa.
    Storage.get(projectId).then(p => {
      if (!p) { App.navigate('/'); return; }

      this.project = p;
      this.zoom    = p.canvas.zoom  || 0.15;
      this.panX    = p.canvas.panX  || 200;
      this.panY    = p.canvas.panY  || 200;
      this.history    = [JSON.stringify(p.canvas)];
      this.historyIdx = 0;
      this.drawStart  = null;
      this.selected   = null;
      this.envPoints  = [];
      this._scaleTool = null;
      this._bgImg     = null;

      this._renderShell();
      this._initCanvas();
      this._initKeyboard();
      this._startAutoSave();
      this._initVisibility();
      this._initOfflineBadge();
      this._setTool('wall');
      this._updateUndoRedo();

      if (this.project.canvas.backgroundImage) {
        const btn = document.getElementById('btn-calib');
        if (btn) btn.style.display = '';
      }

      this._hydratePromise = Storage.hydrateAsync(this.project)
        .then(() => this._draw())
        .catch(err => console.warn('[Elle] hydrateAsync falhou:', err));
    });
  },

  // ── Shell HTML ────────────────────────────

  _renderShell() {
    document.getElementById('app').innerHTML = `
      <div class="canvas-editor">

        <header class="editor-header">
          <button class="btn-ghost" id="btn-back" style="padding:6px 11px; font-size:12px;">
            ${this._ic('chevron-left')} Projetos
          </button>
          <div class="editor-project-info">
            <div class="editor-project-name">${esc(this.project.name)}</div>
            ${this.project.client
              ? `<div class="editor-project-sub">${esc(this.project.client)}</div>`
              : ''}
          </div>
          <div class="save-indicator">
            <div class="save-dot" id="save-dot"></div>
            <span id="save-label">Salvo</span>
          </div>
          <span id="offline-badge" style="display:none;font-size:10px;font-weight:600;color:var(--green);background:rgba(22,163,74,0.10);border:1px solid rgba(22,163,74,0.25);border-radius:20px;padding:3px 9px;white-space:nowrap;">● Offline</span>
          <div style="display:flex;gap:4px;margin-left:8px;">
            <button class="btn-ghost" id="btn-undo" style="min-height:44px;min-width:44px;padding:6px 10px;" title="Desfazer (Ctrl+Z)">
              ${this._ic('undo')}
            </button>
            <button class="btn-ghost" id="btn-redo" style="min-height:44px;min-width:44px;padding:6px 10px;opacity:0.35;" title="Refazer (Ctrl+Y)" disabled>
              ${this._ic('redo')}
            </button>
            <button class="btn-ghost" id="btn-dxf" style="min-height:44px;padding:6px 11px;font-size:12px;">
              ${this._ic('download')} DXF
            </button>
            <button class="btn-ghost" id="btn-pdf" style="min-height:44px;padding:6px 11px;font-size:12px;">
              ${this._ic('pdf')} PDF
            </button>
          </div>
        </header>

        <div class="editor-toolbar" id="toolbar">
          <div class="tool-group">
            ${this._toolBtn('select',      this._ic('cursor'),  'Selecionar')}
            ${this._toolBtn('wall',        this._ic('wall'),    'Parede')}
            ${this._toolBtn('dimension',   this._ic('dim'),     'Cota')}
          </div>
          <div class="tool-sep"></div>
          <div class="tool-group">
            ${this._toolBtn('door',        this._ic('door'),    'Porta')}
            ${this._toolBtn('window',      this._ic('window'),  'Janela')}
          </div>
          <div class="tool-sep"></div>
          <div class="tool-group">
            ${this._toolBtn('install',     this._ic('bolt'),    'Instalação')}
            ${this._toolBtn('photo',       this._ic('camera'),  'Foto')}
            ${this._toolBtn('note',        this._ic('note'),    'Nota')}
            ${this._toolBtn('environment', this._ic('env'),     'Ambiente')}
          </div>
          <div style="flex:1;"></div>
          <div class="tool-group">
            <button class="tool-btn active" id="btn-ortho" title="Modo ortogonal — paredes sempre em 90° (toque para liberar ângulos)">
              ${this._ic('ortho')} Ortho
            </button>
            <button class="tool-btn" id="btn-grid" title="Grade/Snap">
              ${this._ic('grid')} Grade
            </button>
            <button class="tool-btn" id="btn-compass" title="Bússola — planta gira com o tablet">
              ${this._ic('compass')} Bússola
            </button>
            <button class="tool-btn" id="btn-bg" title="Importar imagem de fundo">
              ${this._ic('img')} Fundo
            </button>
            <button class="tool-btn" id="btn-calib"
              style="display:none; color:var(--blue); border-color:rgba(91,155,213,0.3);"
              title="Calibrar escala da imagem de fundo">
              ${this._ic('ruler2')} Calibrar
            </button>
            <button class="tool-btn" id="btn-close-env"
              style="display:none; color:var(--green); border-color:rgba(90,154,112,0.3);"
              title="Fechar ambiente">
              ${this._ic('check')} Fechar
            </button>
            <button class="tool-btn" id="btn-cancel-tool"
              style="display:none; color:var(--red); border-color:rgba(192,80,80,0.3);"
              title="Cancelar (Esc)">
              ${this._ic('x')} Cancelar
            </button>
          </div>
        </div>

        <div class="editor-body" id="editor-body">
          <canvas id="main-canvas"></canvas>

          <div class="editor-sidebar" id="sidebar">
            <div class="sidebar-section-title">Propriedades</div>
            <div id="props-content" style="font-size:11px; color:var(--text-faint); line-height:1.8;">
              <strong style="color:var(--text-muted); font-size:12px;">Como usar:</strong><br>
              1. Toque numa ferramenta acima<br>
              2. Toque na planta → desenha<br>
              &nbsp;&nbsp;<em>Parede/Cota: 2 toques</em><br><br>
              <strong style="color:var(--text-muted);">Mover/Zoom:</strong><br>
              2 dedos: mover e zoom<br><br>
              <strong style="color:var(--text-muted);">Selecionar:</strong><br>
              Ferramenta Selecionar +<br>
              toque no elemento
            </div>
          </div>

          <div class="hud-scale" id="hud-scale">—</div>
          <div class="hud-coords" id="hud-coords">0, 0</div>
          <div class="hud-hint" id="hud-hint" style="display:none;"></div>

          <div class="hud-btn-group">
            <button class="hud-nav-btn" id="btn-zoom-out" title="Diminuir zoom">−</button>
            <button class="hud-nav-btn" id="btn-zoom-in"  title="Aumentar zoom">+</button>
            <button class="hud-nav-btn" id="btn-fit" title="Centralizar / encaixar na tela">
              ${this._ic('fit')}
            </button>
          </div>

          <!-- Ações sempre visíveis durante o desenho de paredes -->
          <div class="wall-actions" id="wall-actions" style="display:none;">
            <button class="wall-act-btn" id="btn-wall-undo">↶ Desfazer ponto</button>
            <button class="wall-act-btn wall-act-done" id="btn-wall-done">✓ Concluir</button>
          </div>

          <!-- Ações ao selecionar uma parede -->
          <div class="wall-actions" id="sel-wall-actions" style="display:none;">
            <button class="wall-act-btn" id="btn-sel-continue" title="Continuar desenhando a partir do final desta parede">➕ Continuar</button>
            <button class="wall-act-btn" id="btn-sel-editlen" title="Editar comprimento da parede">✏️ Comprimento</button>
            <button class="wall-act-btn" id="btn-sel-delete" title="Excluir parede" style="color:var(--red);">🗑 Excluir</button>
          </div>

          <!-- HUD de dimensão durante arraste -->
          <div id="drag-dim-hud" style="display:none;position:absolute;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(29,78,216,0.92);color:#fff;font-size:22px;font-weight:700;padding:8px 22px;border-radius:12px;pointer-events:none;z-index:8;font-variant-numeric:tabular-nums;"></div>
        </div>

      </div>
    `;

    document.getElementById('btn-back').addEventListener('click', async () => {
      await this._saveNow();   // garante que IndexedDB confirmou antes de sair
      this.destroy();
      App.navigate('/');
    });
    document.getElementById('btn-dxf').addEventListener('click', () => {
      this._saveNow();
      DxfWriter.download(this.project);
      Toast.show('DXF exportado', 'success');
    });
    document.getElementById('btn-pdf').addEventListener('click', async () => {
      if (this._hydratePromise) await this._hydratePromise;
      await this._saveNow();
      // Preservar viewport atual
      const prevZoom = this.zoom, prevPanX = this.panX, prevPanY = this.panY;
      // Centralizar toda a planta para que o PDF saia com zoom correto
      this._fitScreen();
      // Aguardar o frame de renderização do rAF throttle
      await new Promise(r => setTimeout(r, 60));
      const dataUrl = this.canvas ? this.canvas.toDataURL('image/png') : null;
      // Restaurar viewport
      this.zoom = prevZoom; this.panX = prevPanX; this.panY = prevPanY;
      this._draw();
      PdfReport.generate(this.project, dataUrl);
    });
    document.getElementById('btn-ortho').addEventListener('click', () => this._toggleOrtho());
    document.getElementById('btn-compass').addEventListener('click', () => this._toggleCompass());
    document.getElementById('btn-bg').addEventListener('click', () => this._importBackground());
    document.getElementById('btn-calib').addEventListener('click', () => this._startScaleCalib());
    document.getElementById('btn-close-env').addEventListener('click', () => this._closeEnvironment());
    document.getElementById('btn-undo').addEventListener('click', () => this._undo());
    document.getElementById('btn-redo').addEventListener('click', () => this._redo());
    document.getElementById('btn-fit').addEventListener('click', () => this._fitScreen());
    document.getElementById('btn-zoom-in').addEventListener('click', () => this._zoomAtCenter(1.25));
    document.getElementById('btn-zoom-out').addEventListener('click', () => this._zoomAtCenter(1 / 1.25));
    document.getElementById('btn-wall-done').addEventListener('click', () => { this._resetWallChain(); this._draw(); });
    document.getElementById('btn-wall-undo').addEventListener('click', () => this._undoLastWallPoint());

    // Ações da parede selecionada
    document.getElementById('btn-sel-continue').addEventListener('click', () => {
      if (!this.selected || this.selected.type !== 'wall') return;
      const w = this.project.canvas.walls.find(w => w.id === this.selected.id);
      if (!w) return;
      this._setTool('wall');
      const snapPt = { x: w.x2, y: w.y2 };
      this._chainPts = [snapPt];
      this.drawStart = snapPt;
      this.mouseWorld = snapPt;
      this._updateWallActions();
      this._draw();
    });
    document.getElementById('btn-sel-editlen').addEventListener('click', () => {
      if (!this.selected || this.selected.type !== 'wall') return;
      const w = this.project.canvas.walls.find(w => w.id === this.selected.id);
      if (w) this._editWallLength(w);
    });
    document.getElementById('btn-sel-delete').addEventListener('click', () => {
      this._deleteSelected();
      this._showSelWallActions(false);
    });
    document.getElementById('btn-grid').addEventListener('click', () => {
      this.project.canvas.gridVisible = !this.project.canvas.gridVisible;
      this._draw();
    });
    document.getElementById('btn-cancel-tool').addEventListener('click', () => {
      if (this.currentTool === 'wall') this._resetWallChain();
      else { this.drawStart = null; this._updateCancelBtn(); }
      this._draw();
    });

    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this._setTool(btn.dataset.tool));
    });
  },

  _toolBtn(id, icon, label) {
    return `<button class="tool-btn" data-tool="${id}" title="${label}">
      ${icon} ${label}
    </button>`;
  },

  // ── Canvas init ───────────────────────────

  _initCanvas() {
    this.canvas = document.getElementById('main-canvas');
    this.ctx    = this.canvas.getContext('2d');

    this._resize();
    this._resizeHandler = () => this._resize();
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('orientationchange', this._resizeHandler);

    // O layout do flex pode não estar pronto na 1ª medição (comum em
    // navegadores de tablet). Re-mede no próximo frame e observa o body.
    requestAnimationFrame(() => this._resize());
    if (typeof ResizeObserver !== 'undefined') {
      const body = document.getElementById('editor-body');
      if (body) {
        this._ro = new ResizeObserver(() => this._resize());
        this._ro.observe(body);
      }
    }

    const c = this.canvas;
    c.addEventListener('mousedown',  e => this._onMouseDown(e));
    c.addEventListener('mousemove',  e => this._onMouseMove(e));
    c.addEventListener('mouseup',    e => this._onMouseUp(e));
    c.addEventListener('mouseleave', e => this._onMouseUp(e));
    c.addEventListener('wheel',      e => this._onWheel(e), { passive: false });
    c.addEventListener('dblclick',   e => this._onDblClick(e));
    c.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
    c.addEventListener('touchmove',  e => this._onTouchMove(e), { passive: false });
    c.addEventListener('touchend',   e => this._onTouchEnd(e));

    this._draw();
  },

  _resize() {
    const body = document.getElementById('editor-body');
    if (!body || !this.canvas) return;
    const w = body.clientWidth;
    const h = body.clientHeight;
    // Layout ainda não pronto: não zera o buffer (canvas 0×0 = tela em branco).
    if (w === 0 || h === 0) {
      requestAnimationFrame(() => this._resize());
      return;
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width  = w;
      this.canvas.height = h;
    }
    this._draw();
  },

  // ── Tool management ───────────────────────

  _updateCancelBtn() {
    const btn = document.getElementById('btn-cancel-tool');
    if (btn) btn.style.display = this.drawStart ? '' : 'none';
  },

  _setTool(tool) {
    // Bússola permanece ativa durante o desenho — o snap usa ângulos relativos ao heading.
    // Isso permite desenhar enquanto caminha pelo ambiente sem perder a orientação visual.
    this.currentTool = tool;
    this.drawStart   = null;
    this.selected    = null;
    this.envPoints   = [];
    this._scaleTool  = null;
    this._chainPts   = null;
    this._aiming     = false;
    this._aimAngle   = null;
    this._aimClosing = false;
    this._placingOpening = null;
    this._aimingOpening  = false;
    this._openingPreview = null;
    this._placingInstall = null;
    this._aimingInstall  = false;
    this._installPreview = null;
    this._archSnapPt     = null;
    this._wallSnapPt     = null;
    this._wallDrag       = null;
    if (this._longPressTimer) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
    this._showSelWallActions(false);
    this._updateDragDimHud();
    this._updateCancelBtn();
    this._updateEnvBtn();
    this._updateWallActions();

    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    const hints = {
      select:      'Toque num elemento para selecionar · Toque fora para desselecionar',
      wall:        'Toque para marcar o início · arraste na direção e solte para digitar a medida (cm)',
      dimension:   'Toque no 1º ponto da cota · 2º toque finaliza a medida',
      door:        'Arraste até a parede onde fica a porta e solte (a parede acende)',
      window:      'Arraste até a parede onde fica a janela e solte (a parede acende)',
      install:     'Arraste até parede → modo parede · Toque no piso (centro do ambiente) → modo piso (X + Y)',
      photo:       'Toque na planta para tirar/vincular uma foto',
      note:        'Toque na planta para adicionar nota de texto',
      environment: 'Toque nos cantos do ambiente · Toque "Fechar" para concluir',
    };
    this._showHint(hints[tool] || '');
    this._updateCursor();
    this._draw();
  },

  _updateCursor() {
    const map = {
      select: 'default', wall: 'crosshair', dimension: 'crosshair',
      door: 'crosshair', window: 'crosshair', install: 'crosshair',
      photo: 'crosshair', note: 'text', environment: 'crosshair',
    };
    if (this.canvas) this.canvas.style.cursor = map[this.currentTool] || 'default';
  },

  _showHint(text) {
    const el = document.getElementById('hud-hint');
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  },

  // ── Coordinate transforms ─────────────────

  toWorld(px, py) {
    // Modo bússola: desrotacionar coordenada de tela antes de converter para mundo
    if (this._compassMode && this.canvas) {
      const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
      const a  = this._compassHeading * Math.PI / 180;  // rotação inversa
      const dx = px - cx, dy = py - cy;
      px = cx + dx * Math.cos(a) - dy * Math.sin(a);
      py = cy + dx * Math.sin(a) + dy * Math.cos(a);
    }
    return { x: (px - this.panX) / this.zoom, y: (py - this.panY) / this.zoom };
  },

  toScreen(wx, wy) {
    return { x: wx * this.zoom + this.panX, y: wy * this.zoom + this.panY };
  },

  // ── Snapping ─────────────────────────────

  _snapWorld(raw, shiftLock = false) {
    let { x, y } = raw;

    // Snap to grid (10cm = 100mm steps)
    if (this.project.canvas.snapEnabled) {
      const g = 100;
      x = Math.round(x / g) * g;
      y = Math.round(y / g) * g;
    }

    // Snap to existing wall endpoints (8px radius in screen space)
    const r = 8 / this.zoom;
    for (const w of this.project.canvas.walls) {
      for (const pt of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
        if (Math.abs(raw.x - pt.x) < r && Math.abs(raw.y - pt.y) < r) {
          return { x: pt.x, y: pt.y, snapped: true };
        }
      }
    }

    // Angle lock with Shift
    if (shiftLock && this.drawStart) {
      const dx = x - this.drawStart.x;
      const dy = y - this.drawStart.y;
      const angle = Math.atan2(dy, dx);
      const locked = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.sqrt(dx * dx + dy * dy);
      x = this.drawStart.x + Math.cos(locked) * len;
      y = this.drawStart.y + Math.sin(locked) * len;
    }

    return { x, y, snapped: false };
  },

  // ── Snap magnético para endpoints de parede ──────────────────────────────
  // Usado quando o usuário está prestes a marcar o início de uma nova parede.
  // Raio grande (24px) para uso com o dedo — evita paredes duplicadas no mesmo ponto.
  _snapToWallEndpoint(rawWorld, largeRadius = false) {
    const R = (largeRadius ? 48 : 24) / this.zoom;
    let best = null, bestD = Infinity;
    for (const w of this.project.canvas.walls) {
      for (const pt of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
        const d = dist(rawWorld.x, rawWorld.y, pt.x, pt.y);
        if (d < R && d < bestD) { bestD = d; best = { x: pt.x, y: pt.y }; }
      }
    }
    return best;
  },

  // Snap em mm do mundo: conecta endpoint calculado a endpoint existente dentro da tolerância
  _snapToNearestEndpoint(worldPt, toleranceMm) {
    let best = null, bestD = Infinity;
    for (const w of this.project.canvas.walls) {
      for (const pt of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
        const d = dist(worldPt.x, worldPt.y, pt.x, pt.y);
        if (d <= toleranceMm && d < bestD) { bestD = d; best = { x: pt.x, y: pt.y }; }
      }
    }
    // Também verifica o 1º ponto da cadeia atual (fechamento antecipado)
    if (this._chainPts?.length) {
      const first = this._chainPts[0];
      const d = dist(worldPt.x, worldPt.y, first.x, first.y);
      if (d <= toleranceMm && d < bestD) { bestD = d; best = { x: first.x, y: first.y }; }
    }
    return best;
  },

  // Indicador visual do snap de endpoint: círculo verde + ímã
  _drawWallSnap(ctx) {
    const pt = this._wallSnapPt;
    if (!pt) return;
    const r = 16 / this.zoom;

    // Halo externo
    ctx.strokeStyle = 'rgba(22,163,74,0.45)';
    ctx.lineWidth   = 1.5 / this.zoom;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r * 1.7, 0, Math.PI * 2); ctx.stroke();

    // Anel sólido
    ctx.strokeStyle = '#16A34A';
    ctx.lineWidth   = 2.5 / this.zoom;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.stroke();

    // Cruz interna
    const c = r * 0.5;
    ctx.strokeStyle = '#16A34A';
    ctx.lineWidth   = 2 / this.zoom;
    ctx.beginPath();
    ctx.moveTo(pt.x - c, pt.y); ctx.lineTo(pt.x + c, pt.y);
    ctx.moveTo(pt.x, pt.y - c); ctx.lineTo(pt.x, pt.y + c);
    ctx.stroke();

    // Label "Conectar"
    const fs  = 11 / this.zoom;
    const pad = 4  / this.zoom;
    ctx.font = `600 ${fs}px Inter,sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    const tw = ctx.measureText('Conectar').width;
    const bx = pt.x - tw / 2 - pad;
    const by = pt.y - r - fs - pad * 2 - 2 / this.zoom;
    ctx.fillStyle = '#16A34A';
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + pad * 2, fs + pad * 1.5, 3 / this.zoom);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Conectar', pt.x, by + fs + pad * 0.75);
    ctx.textBaseline = 'alphabetic';
  },

  // ── Snap magnético para cotas ─────────────────────────────────────────────
  // Captura pontos estratégicos com raio 20px.
  // Para paredes: além dos eixos (centro), também as FACES (±espessura/2)
  // perpendicularmente, para cotas internas e externas corretas.
  _snapToArchPoint(rawWorld) {
    const R  = 28 / this.zoom; // raio de captura da face (screen-pixels independente do zoom)
    const c  = this.project.canvas;
    const candidates = [];

    // Snap apenas nos CANTOS das paredes (extremidades), projetado para a face
    // mais próxima do cursor. Nunca desliza ao longo da parede.
    for (const w of c.walls) {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (!len) continue;
      const nx = -dy / len, ny = dx / len;
      const t  = (w.thickness || 150) / 2;

      for (const [px, py] of [[w.x1, w.y1], [w.x2, w.y2]]) {
        const toX = rawWorld.x - px, toY = rawWorld.y - py;
        const onNSide = nx * toX + ny * toY;
        const sign = onNSide >= 0 ? 1 : -1;

        const snapX = px + sign * nx * t;
        const snapY = py + sign * ny * t;

        const d = dist(rawWorld.x, rawWorld.y, snapX, snapY);
        if (d < R) {
          candidates.push({ x: snapX, y: snapY, priority: 1 });
        }
      }
    }

    // ── Bordas e centro de aberturas (porta/janela) ────────────────────────
    for (const o of c.openings) {
      const w = c.walls.find(w => w.id === o.wallId);
      if (!w) continue;
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!len) continue;
      const nx = dx / len, ny = dy / len;
      const cx = w.x1 + dx * o.position, cy = w.y1 + dy * o.position;
      const half = (o.width || 900) / 2;
      candidates.push({ x: cx - nx * half, y: cy - ny * half, label: 'Vão' });
      candidates.push({ x: cx + nx * half, y: cy + ny * half, label: 'Vão' });
      candidates.push({ x: cx,             y: cy,             label: 'Centro' });
    }

    // ── Instalações — prioridade absoluta ─────────────────────────────────
    const RINST = 22 / this.zoom;
    for (const inst of c.installations) {
      const d = dist(rawWorld.x, rawWorld.y, inst.x, inst.y);
      if (d < RINST) {
        const entry = getInstallEntry(inst.type);
        return { x: inst.x, y: inst.y, label: entry ? entry.symbol : '?', priority: 0 };
      }
    }

    // ── Melhor candidato ──────────────────────────────────────────────────
    let best = null, bestScore = Infinity;
    for (const pt of candidates) {
      const d = dist(rawWorld.x, rawWorld.y, pt.x, pt.y);
      if (d >= R) continue;
      if (d < bestScore) { bestScore = d; best = pt; }
    }

    return best;
  },

  // ── Main draw ─────────────────────────────

  _draw() {
    if (!this.ctx) return;
    // Throttle: coalesce múltiplas chamadas em um único frame de animação.
    // Evita renderizações redundantes durante arraste em tablets lentos.
    if (this._drawPending) return;
    this._drawPending = true;
    requestAnimationFrame(() => {
      this._drawPending = false;
      this._drawNow();
    });
  },

  _drawNow() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#FAF8F4';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // Modo bússola: rotacionar planta para que o norte fique sempre no topo
    if (this._compassMode) {
      const angle = -this._compassHeading * Math.PI / 180;
      ctx.translate(W / 2, H / 2);
      ctx.rotate(angle);
      ctx.translate(-W / 2, -H / 2);
    }
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // Cada camada é isolada: um erro numa delas (ex.: dado corrompido)
    // não pode apagar o restante do desenho.
    this._layer('fundo',         () => this._drawBackground(ctx));
    if (this.project.canvas.gridVisible) this._layer('grade', () => this._drawGrid(ctx, W, H));
    this._layer('ambientes',     () => this._drawEnvironments(ctx));
    this._layer('paredes',       () => this._drawWalls(ctx));
    this._layer('aberturas',     () => this._drawOpenings(ctx));
    this._layer('cotas',         () => this._drawDimensions(ctx));
    this._layer('instalações',   () => this._drawInstallations(ctx));
    this._layer('fotos',         () => this._drawPhotoPins(ctx));
    this._layer('notas',         () => this._drawNotes(ctx));
    if (this._placingOpening) this._layer('alvo-abertura', () => this._drawOpeningPlacement(ctx));
    if (this._openingPreview) this._layer('previa-abertura', () => this._drawSingleOpening(ctx, this._openingPreview, true));
    if (this._placingInstall) this._layer('alvo-install',  () => this._drawInstallPlacement(ctx));
    if (this._installPreview) this._layer('previa-install', () => this._drawInstallPreview(ctx));
    if (this._archSnapPt)     this._layer('snap-arch',      () => this._drawArchSnap(ctx));
    if (this._wallSnapPt)     this._layer('snap-wall',      () => this._drawWallSnap(ctx));
    if (this.drawStart) this._layer('preview', () => this._drawPreview(ctx));
    if (this.currentTool === 'environment') this._layer('preview-amb', () => this._drawEnvPreview(ctx));

    ctx.restore();

    if (this._compassMode) this._drawCompassOverlay(ctx, W, H);
    this._updateHud();
  },

  _layer(name, fn) {
    try {
      fn();
    } catch (err) {
      console.error(`Erro ao desenhar camada "${name}":`, err);
      if (typeof showErrorOverlay === 'function') {
        showErrorOverlay(`Camada "${name}": ${err.message}`);
      }
    }
  },

  // ── Grid ─────────────────────────────────

  _drawGrid(ctx, W, H) {
    const minor = 100;   // 10cm
    const major = 1000;  // 1m

    const x0 = (-this.panX / this.zoom);
    const y0 = (-this.panY / this.zoom);
    const x1 = x0 + W / this.zoom;
    const y1 = y0 + H / this.zoom;

    const drawLines = (step, color, lw) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw / this.zoom;
      ctx.beginPath();
      for (let x = Math.floor(x0 / step) * step; x < x1; x += step) {
        ctx.moveTo(x, y0); ctx.lineTo(x, y1);
      }
      for (let y = Math.floor(y0 / step) * step; y < y1; y += step) {
        ctx.moveTo(x0, y); ctx.lineTo(x1, y);
      }
      ctx.stroke();
    };

    drawLines(minor, '#EAE7E2', 0.5);
    drawLines(major, '#D5D0C8', 1);

    // Origin cross
    ctx.strokeStyle = '#C8C2BA';
    ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();
    ctx.moveTo(-200, 0); ctx.lineTo(200, 0);
    ctx.moveTo(0, -200); ctx.lineTo(0, 200);
    ctx.stroke();
  },

  // ── Environments ─────────────────────────

  _drawEnvironments(ctx) {
    for (const env of this.project.canvas.environments) {
      if (!env.polygon || env.polygon.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(env.polygon[0].x, env.polygon[0].y);
      env.polygon.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(99,102,241,0.07)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(99,102,241,0.30)';
      ctx.lineWidth = 2 / this.zoom;
      ctx.setLineDash([10 / this.zoom, 6 / this.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (env.centroid) {
        const fs  = 18 / this.zoom;
        const sel = this.selected?.id === env.id;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font      = `600 ${fs}px Inter,sans-serif`;
        ctx.fillStyle = sel ? '#1D4ED8' : '#3730A3';
        ctx.fillText(env.name || 'Ambiente', env.centroid.x, env.centroid.y);
        if (env.area != null) {
          ctx.font      = `400 ${fs * 0.68}px Inter,sans-serif`;
          ctx.fillStyle = 'rgba(55,48,163,0.65)';
          ctx.fillText(`${(env.area / 1e6).toFixed(2)} m²`, env.centroid.x, env.centroid.y + fs * 1.1);
        }
        if (env.peDireito) {
          ctx.font      = `400 ${fs * 0.6}px Inter,sans-serif`;
          ctx.fillStyle = 'rgba(2,132,199,0.75)';
          const row3 = env.centroid.y + fs * 1.1 + fs * 0.68 * 1.2;
          ctx.fillText(`pé: ${env.peDireito}m`, env.centroid.x, row3);
        }
        ctx.textBaseline = 'alphabetic';
      }
    }
  },

  // ── Walls ────────────────────────────────

  _drawWalls(ctx) {
    const walls = this.project.canvas.walls;
    if (!walls.length) return;

    // ── Abordagem: paths conectados com lineJoin:'miter' ──
    // Paredes que se conectam num endpoint são desenhadas como um único path.
    // O Canvas API resolve automaticamente o canto (miter join) — sem gaps,
    // sem bumps, funciona para 90°, 45° e qualquer ângulo.

    const SNAP = 20; // tolerância de snap em mm — cobre floating point de paredes diagonais
    const epKey = (x, y) => `${Math.round(x / SNAP)},${Math.round(y / SNAP)}`;

    // 1. Mapa: endpoint_key → lista de [wallId, qual_end ('1'|'2')]
    const endMap = new Map();
    for (const w of walls) {
      for (const [px, py, end] of [[w.x1, w.y1, '1'], [w.x2, w.y2, '2']]) {
        const k = epKey(px, py);
        if (!endMap.has(k)) endMap.set(k, []);
        endMap.get(k).push({ wid: w.id, end });
      }
    }

    // 2. Montar cadeias: sequência de pontos para um único path
    const used   = new Set();
    const chains = [];

    const wallById = id => walls.find(w => w.id === id);

    const followChain = (startWall, startEnd) => {
      // Percorre a cadeia de paredes conectadas ponta a ponta
      const pts = [];
      let w   = startWall;
      let end = startEnd; // extremidade pela qual saímos

      while (w && !used.has(w.id)) {
        used.add(w.id);
        const [px, py] = end === '1' ? [w.x1, w.y1] : [w.x2, w.y2];
        pts.push({ x: px, y: py, wid: w.id });

        // Outro endpoint deste segmento
        const [ox, oy] = end === '1' ? [w.x2, w.y2] : [w.x1, w.y1];
        pts.push({ x: ox, y: oy, wid: null }); // ponto final do segmento

        // Tentar continuar para a próxima parede conectada no outro endpoint
        const nextKey = epKey(ox, oy);
        const nexts   = (endMap.get(nextKey) || []).filter(e => e.wid !== w.id && !used.has(e.wid));
        if (nexts.length === 1) {
          const nxt = wallById(nexts[0].wid);
          end = nexts[0].end; // entramos pelo endpoint que conecta, saímos pelo outro
          w   = nxt;
          pts.pop(); // o ponto final do segmento vira o inicial do próximo
        } else {
          w = null;
        }
      }
      return pts;
    };

    for (const w of walls) {
      if (used.has(w.id)) continue;
      // Encontrar a ponta "livre" (não conectada a outra parede já visitada)
      // para começar a cadeia de trás para frente
      const k1 = epKey(w.x1, w.y1);
      const k2 = epKey(w.x2, w.y2);
      const free1 = !(endMap.get(k1) || []).some(e => e.wid !== w.id);
      const startEnd = free1 ? '1' : '2'; // começa pela ponta livre se existir
      const pts = followChain(w, startEnd);
      if (pts.length >= 2) chains.push({ pts, thickness: w.thickness || 150, sel: this.selected?.id === w.id });
    }

    // 3. Paredes como POLÍGONOS preenchidos com miter calculado matematicamente.
    // Cada cadeia gera um polígono contínuo com cantos vivos em qualquer ângulo.
    // SEM lineJoin (não usa stroke), SEM discos — resultado limpo e arquitetonicamente correto.

    // Calcula interseção de duas linhas: (p1 + t*d1) = (p2 + s*d2)
    const lineIsect = (p1, d1, p2, d2) => {
      const cross = d1.x * d2.y - d1.y * d2.x;
      if (Math.abs(cross) < 0.001) return null; // paralelas
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const t  = (dx * d2.y - dy * d2.x) / cross;
      return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
    };

    // Gera o polígono de contorno para uma cadeia de pontos com espessura t
    const chainPoly = (pts, t, closed) => {
      const n   = pts.length;
      const h   = t / 2;
      const seg = []; // { nx, ny, dx, dy } por segmento
      for (let i = 0; i < n - 1; i++) {
        const dx = pts[i+1].x - pts[i].x, dy = pts[i+1].y - pts[i].y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (!len) { seg.push({ nx:0, ny:0, dx:0, dy:0 }); continue; }
        const nx = -dy/len, ny = dx/len; // normal esquerda
        seg.push({ nx, ny, dx: dx/len, dy: dy/len });
      }
      // Calcula ponto de miter para o lado "esq" ou "dir" em cada junction
      // i=0 em chain fechada → usa seg[ns-1] como s1 (wraparound)
      const miterPt = (i, sign) => {
        const prevIdx = (i - 1 + ns) % ns; // wraparound seguro: -1 → ns-1
        const s1 = seg[prevIdx], s2 = seg[i % ns];
        const P  = pts[i % pts.length];
        if (!s1 || !s2 || (!s1.dx && !s1.dy) || (!s2.dx && !s2.dy)) {
          return { x: P.x + sign*(s2||s1).nx*h, y: P.y + sign*(s2||s1).ny*h };
        }
        const p1 = { x: P.x + sign*s1.nx*h, y: P.y + sign*s1.ny*h };
        const p2 = { x: P.x + sign*s2.nx*h, y: P.y + sign*s2.ny*h };
        const isect = lineIsect(p1, { x: s1.dx, y: s1.dy }, p2, { x: s2.dx, y: s2.dy });
        if (!isect) return p1;
        const dMiter = Math.sqrt((isect.x-P.x)**2 + (isect.y-P.y)**2);
        if (dMiter > h * 8) return p1;
        return isect;
      };

      const left = [], right = [];
      const ns = seg.length;

      for (let i = 0; i <= ns; i++) {
        if (i === 0) {
          if (closed) {
            left.push(miterPt(0, 1));
            right.push(miterPt(0, -1));
          } else {
            left.push({ x: pts[0].x + seg[0].nx*h, y: pts[0].y + seg[0].ny*h });
            right.push({ x: pts[0].x - seg[0].nx*h, y: pts[0].y - seg[0].ny*h });
          }
        } else if (i === ns) {
          if (closed) {
            left.push(left[0]); right.push(right[0]);
          } else {
            const s = seg[ns-1];
            const P = pts[ns];
            left.push({ x: P.x + s.nx*h, y: P.y + s.ny*h });
            right.push({ x: P.x - s.nx*h, y: P.y - s.ny*h });
          }
        } else {
          left.push(miterPt(i, 1));
          right.push(miterPt(i, -1));
        }
      }

      return [...left, ...[...right].reverse()];
    };

    for (const chain of chains) {
      const t      = chain.thickness;
      const pts    = chain.pts;
      const p0     = pts[0], pN = pts[pts.length-1];
      const closed = Math.sqrt((pN.x-p0.x)**2+(pN.y-p0.y)**2) < 25;

      // Para loop fechado: não acrescentar pts[1] — chainPoly usa wraparound
      const polyPts = pts;
      if (polyPts.length < 2) continue;

      const poly = chainPoly(polyPts, t, closed);
      ctx.fillStyle = chain.sel ? '#1D4ED8' : '#1C3557';
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fill();
    }

    // ── Labels de comprimento ──
    // Posicionados FORA do corpo da parede (offset perpendicular = espessura/2 + margem).
    // Texto normalizado: nunca aparece de cabeça para baixo.
    for (const w of walls) {
      const sel = this.selected?.id === w.id;
      const dx  = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!sel && len * this.zoom < 80) continue;

      const t   = w.thickness || 150;
      const mx  = (w.x1 + w.x2) / 2;
      const my  = (w.y1 + w.y2) / 2;
      let ang = Math.atan2(dy, dx);
      if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;

      const label = fmtM(len);

      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      const fs  = 13 / this.zoom;
      const yOff = -(t / 2 + 14 / this.zoom);  // FORA da parede: acima da superfície
      ctx.font = `500 ${fs}px Inter,sans-serif`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(label).width;
      // Fundo do label
      const pad = 4 / this.zoom;
      ctx.fillStyle = 'rgba(250,248,244,0.94)'; // pill claro sobre a parede
      ctx.beginPath();
      ctx.roundRect(-tw / 2 - pad, yOff - fs - pad, tw + pad * 2, fs + pad * 1.5, 3 / this.zoom);
      ctx.fill();
      ctx.fillStyle = sel ? '#1D4ED8' : '#1C3557';
      ctx.fillText(label, 0, yOff);
      ctx.restore();
    }

    // ── Handles de drag + cadeado nas paredes ──
    if (this.currentTool === 'select') {
      for (const w of walls) {
        const sel = this.selected?.id === w.id;

        // Cadeado em paredes travadas (sempre visível)
        if (w.locked) {
          const mx = (w.x1 + w.x2) / 2;
          const my = (w.y1 + w.y2) / 2;
          const fs = 13 / this.zoom;
          ctx.font      = `${fs}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🔒', mx, my - (w.thickness || 150) / 2 - 18 / this.zoom);
          ctx.textBaseline = 'alphabetic';
        }

        // Handles só na parede selecionada
        if (sel) {
          const hr = 14 / this.zoom;
          // Endpoints
          for (const [px, py, mode] of [[w.x1, w.y1, 'p1'], [w.x2, w.y2, 'p2']]) {
            const isDragging = this._wallDrag?.mode === mode;
            ctx.beginPath(); ctx.arc(px, py, hr, 0, Math.PI * 2);
            ctx.fillStyle   = isDragging ? '#1D4ED8' : '#FFFFFF';
            ctx.strokeStyle = '#1D4ED8';
            ctx.lineWidth   = 2.5 / this.zoom;
            ctx.fill(); ctx.stroke();
          }
          // Handle do meio (mover parede inteira) — só se não travada
          if (!w.locked) {
            const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
            const isDragging = this._wallDrag?.mode === 'body';
            const hr2 = 11 / this.zoom;
            ctx.beginPath(); ctx.arc(mx, my, hr2, 0, Math.PI * 2);
            ctx.fillStyle   = isDragging ? '#1D4ED8' : 'rgba(29,78,216,0.15)';
            ctx.strokeStyle = '#1D4ED8';
            ctx.lineWidth   = 2 / this.zoom;
            ctx.fill(); ctx.stroke();
          }
        }
      }
    }
  },

  // ── Openings ─────────────────────────────

  _drawOpenings(ctx) {
    for (const o of this.project.canvas.openings) {
      const sel = this.selected?.id === o.id;
      this._drawSingleOpening(ctx, o, false, sel);
    }
  },

  // Desenha uma porta/janela. preview=true → estilo translúcido (ainda no formulário)
  _drawSingleOpening(ctx, o, preview, sel = false) {
    const w = this.project.canvas.walls.find(w => w.id === o.wallId);
    if (!w) return;

    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (!len) return;
    const nx = dx / len;
    const ny = dy / len;
    // posição limitada para o vão não sair da parede
    const half = Math.min((o.width || 900) / 2, len / 2);
    let pos = o.position;
    pos = Math.max(half / len, Math.min(1 - half / len, pos));
    const cx = w.x1 + dx * pos;
    const cy = w.y1 + dy * pos;

    ctx.save();
    if (preview) ctx.globalAlpha = 0.55;

    // Abre o vão na parede (apaga)
    ctx.strokeStyle = preview ? 'rgba(29,78,216,0.18)' : '#FAF8F4';
    ctx.lineWidth = (w.thickness || 150) + 20;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(cx - nx * half, cy - ny * half);
    ctx.lineTo(cx + nx * half, cy + ny * half);
    ctx.stroke();

    // Ombreiras (traços nas pontas do vão, atravessando a espessura)
    const t2 = (w.thickness || 150) / 2 + 30;
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2 / this.zoom;
    ctx.lineCap = 'butt';
    for (const s of [-1, 1]) {
      const jx = cx + nx * half * s, jy = cy + ny * half * s;
      ctx.beginPath();
      ctx.moveTo(jx - ny * t2, jy + nx * t2);
      ctx.lineTo(jx + ny * t2, jy - nx * t2);
      ctx.stroke();
    }

    if (o.type === 'door') {
      const width = (o.width || 800);
      const endA = { x: cx - nx * half, y: cy - ny * half };
      const endB = { x: cx + nx * half, y: cy + ny * half };
      const hingeSide = o.hingeSide || o.side || 'right';
      const hinge = hingeSide === 'left' ? endA : endB;
      const along = hingeSide === 'left' ? { x: nx, y: ny } : { x: -nx, y: -ny };
      const sign  = (o.openDir === 'out') ? 1 : -1;
      const perp  = { x: -ny * sign, y: nx * sign };
      const leaf  = (o.width || 800);

      // Folha da porta
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 4 / this.zoom;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hinge.x, hinge.y);
      ctx.lineTo(hinge.x + perp.x * leaf, hinge.y + perp.y * leaf);
      ctx.stroke();

      // Arco de varredura (90°)
      const a0 = Math.atan2(along.y, along.x);
      const a1 = Math.atan2(perp.y, perp.x);
      let diff = a1 - a0;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ctx.strokeStyle = 'rgba(120,53,15,0.45)';
      ctx.lineWidth = 2 / this.zoom;
      ctx.setLineDash([10 / this.zoom, 6 / this.zoom]);
      ctx.beginPath();
      ctx.arc(hinge.x, hinge.y, leaf, a0, a0 + diff, diff < 0);
      ctx.stroke();
      ctx.setLineDash([]);

    } else {
      // Janela — linha dupla (vidro) dentro do vão
      const o2 = (w.thickness || 150) / 2 - 10;
      ctx.strokeStyle = '#0369A1';
      ctx.lineWidth = 2 / this.zoom;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx - nx * half - ny * o2 * s, cy - ny * half + nx * o2 * s);
        ctx.lineTo(cx + nx * half - ny * o2 * s, cy + ny * half + nx * o2 * s);
        ctx.stroke();
      }
    }

    // Label largura × altura — sempre visível (preview=grande, inserido=pequeno)
    if (o.width) {
      const wCm = Math.round((o.width  || 0) / 10);
      const hCm = o.height ? Math.round(o.height / 10) : null;
      const sill = (o.type !== 'door' && o.sill) ? Math.round(o.sill / 10) : null;
      const line1 = hCm ? `${wCm}×${hCm}cm` : `${wCm}cm`;
      const line2 = sill ? `peit. ${sill}cm` : null;

      // preview: label maior (12px) fora da parede; inserido: label menor (10px) no vão
      const fs   = preview ? (12 / this.zoom) : (10 / this.zoom);
      const offY = preview
        ? -(w.thickness || 150) / 2 - 18 / this.zoom   // acima da parede
        : -(w.thickness || 150) * 0.1;                  // dentro do vão

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.font      = `${preview ? '600' : '500'} ${fs}px Inter,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      const tw = ctx.measureText(line1).width;
      ctx.fillStyle = 'rgba(250,248,244,0.94)';
      ctx.beginPath();
      ctx.roundRect(-tw/2 - 4/this.zoom, offY - fs - 2/this.zoom, tw + 8/this.zoom, fs + 4/this.zoom, 3/this.zoom);
      ctx.fill();
      ctx.fillStyle = (preview || sel) ? '#1D4ED8' : '#78350F';
      ctx.fillText(line1, 0, offY);

      if (line2) {
        const tw2 = ctx.measureText(line2).width;
        ctx.fillStyle = 'rgba(250,248,244,0.94)';
        ctx.beginPath();
        ctx.roundRect(-tw2/2 - 4/this.zoom, offY - fs*2 - 6/this.zoom, tw2 + 8/this.zoom, fs + 4/this.zoom, 3/this.zoom);
        ctx.fill();
        ctx.fillStyle = '#0369A1';
        ctx.fillText(line2, 0, offY - fs - 4/this.zoom);
      }

      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }

    ctx.restore();
  },

  // ── Dimensions ───────────────────────────

  _drawDimensions(ctx) {
    for (const d of this.project.canvas.dimensions) {
      const sel = this.selected?.id === d.id;
      const dx  = d.x2 - d.x1;
      const dy  = d.y2 - d.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!len) continue;

      const nx = dx / len;
      const ny = dy / len;
      const px = -ny;
      const py = nx;
      // Sempre forçar exterior — usa magnitude salva mas recalcula o sinal
      const offMag = Math.abs((d.offset != null) ? d.offset : 400);
      const off    = this._exteriorOffset({ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }, offMag);

      const p1 = { x: d.x1 + px * off, y: d.y1 + py * off };
      const p2 = { x: d.x2 + px * off, y: d.y2 + py * off };

      const color = sel ? '#1D4ED8' : '#0891B2';
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
      ctx.lineWidth   = 2 / this.zoom;

      // Main line
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

      // Extension lines
      for (const [px2, py2, ex2, ey2] of [
        [d.x1, d.y1, p1.x, p1.y],
        [d.x2, d.y2, p2.x, p2.y],
      ]) {
        ctx.strokeStyle = 'rgba(8,145,178,0.35)';
        ctx.beginPath(); ctx.moveTo(px2, py2); ctx.lineTo(ex2, ey2); ctx.stroke();
      }
      ctx.strokeStyle = color;

      // Tick marks (diagonal)
      const tick = 80;
      for (const pt of [p1, p2]) {
        ctx.beginPath();
        ctx.moveTo(pt.x - nx * tick - px * tick, pt.y - ny * tick - py * tick);
        ctx.lineTo(pt.x + nx * tick + px * tick, pt.y + ny * tick + py * tick);
        ctx.stroke();
      }

      // Label de valor
      const val   = d.value != null ? d.value : Math.round(len);
      const label = fmtM(val);
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const fs = 14 / this.zoom;
      const u  = 1 / this.zoom;

      // Normalizar ângulo: texto nunca aparece de cabeça para baixo
      let ang = Math.atan2(dy, dx);
      if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;

      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.font = `600 ${fs}px Inter,sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'alphabetic';

      const tw  = ctx.measureText(label).width;
      const pad = 5 * u;
      // Posicionar acima da linha de cota (fora — não em cima da linha)
      const yOff = -(fs + 6 * u);

      // Fundo arredondado
      ctx.fillStyle = 'rgba(250,248,244,0.94)';
      ctx.beginPath();
      ctx.roundRect(-tw / 2 - pad, yOff - fs, tw + pad * 2, fs + pad, 3 * u);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(label, 0, yOff);
      ctx.restore();
    }
  },

  // ── Installations ─────────────────────────

  _drawInstallations(ctx) {
    const r = 180;
    for (const inst of this.project.canvas.installations) {
      const sel   = this.selected?.id === inst.id;
      // Cor vem da INSTALLATION_LIBRARY — não de checagens hardcoded de tipo
      const entry = getInstallEntry(inst.type);
      const color = entry ? entry.color : '#D97706';

      ctx.strokeStyle = sel ? '#1D4ED8' : color;
      ctx.fillStyle   = 'rgba(250,248,244,0.92)';
      ctx.lineWidth   = 2.5 / this.zoom;

      ctx.beginPath();
      ctx.arc(inst.x, inst.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const code = this._instCode(inst.type);
      const fs   = 13 / this.zoom;
      ctx.font   = `700 ${fs}px Inter,sans-serif`;
      ctx.fillStyle   = sel ? '#1D4ED8' : color;
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText(`${code}${inst.sequenceNumber}`, inst.x, inst.y);

      if (inst.height != null) {
        ctx.font = `400 ${fs * 0.8}px Inter,sans-serif`;
        ctx.fillStyle = 'rgba(107,100,96,0.85)';
        ctx.fillText(`h=${inst.height}cm`, inst.x, inst.y + r + 14 / this.zoom);
      }
      ctx.textBaseline = 'alphabetic';
    }
  },

  // ── Photo pins ────────────────────────────

  _drawPhotoPins(ctx) {
    for (const pin of this.project.canvas.photoPins) {
      const sel = this.selected?.id === pin.id;
      const r   = 180;

      ctx.fillStyle   = sel ? '#1D4ED8' : '#DC2626';
      ctx.strokeStyle = '#FAF8F4';
      ctx.lineWidth   = 2.5 / this.zoom;
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font        = `700 ${13 / this.zoom}px Inter,sans-serif`;
      ctx.fillStyle   = '#FFFFFF';
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText(`F${pin.sequenceNumber}`, pin.x, pin.y);
      ctx.textBaseline = 'alphabetic';
    }
  },

  // ── Notes ────────────────────────────────

  _drawNotes(ctx) {
    for (const note of this.project.canvas.notes) {
      const sel = this.selected?.id === note.id;
      const preview = note.text.length > 22 ? note.text.slice(0, 22) + '…' : note.text;
      const fs = 13 / this.zoom;
      ctx.font = `400 ${fs}px Inter,sans-serif`;
      const tw = Math.max(ctx.measureText(preview).width, 40 / this.zoom);
      const pad = 8 / this.zoom;
      const h   = fs + pad * 2;
      const w   = tw + pad * 2;

      ctx.fillStyle   = 'rgba(255,251,235,0.96)';
      ctx.strokeStyle = sel ? '#1D4ED8' : 'rgba(245,158,11,0.55)';
      ctx.lineWidth   = 1.5 / this.zoom;
      ctx.beginPath();
      const r = 6 / this.zoom;
      ctx.roundRect(note.x - w / 2, note.y - h / 2, w, h, r);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle   = '#1C1917';
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText(preview, note.x, note.y);
      ctx.textBaseline= 'alphabetic';
    }
  },

  // ── Preview (rubber-band) ─────────────────

  // Linhas de projeção: guias tracejadas para alinhamento com paredes existentes.
  // Verifica: endpoints, midpoints de cada parede — mostra guia H ou V quando alinha.
  // Ajuda a manter paredes paralelas e perpendiculares durante o desenho.
  _drawProjectionLines(ctx, x2, y2) {
    const TOL = 10 / this.zoom;  // 10px de tolerância na tela
    const walls = this.project.canvas.walls;
    const W = this.canvas.width  / this.zoom;
    const H = this.canvas.height / this.zoom;
    const ox = -this.panX / this.zoom;
    const oy = -this.panY / this.zoom;

    ctx.save();
    ctx.lineWidth = 1.5 / this.zoom;

    // Pontos estratégicos de cada parede: endpoints + midpoint
    const pts = [];
    for (const w of walls) {
      pts.push({ x: w.x1, y: w.y1 });
      pts.push({ x: w.x2, y: w.y2 });
      pts.push({ x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 });
    }

    const drawnX = new Set(), drawnY = new Set();
    for (const pt of pts) {
      const kx = Math.round(pt.x / TOL);
      const ky = Math.round(pt.y / TOL);

      // Guia vertical (alinha em X)
      if (Math.abs(pt.x - x2) < TOL && Math.abs(pt.y - y2) > TOL * 3 && !drawnX.has(kx)) {
        drawnX.add(kx);
        ctx.strokeStyle = 'rgba(29,78,216,0.40)';
        ctx.setLineDash([60 / this.zoom, 30 / this.zoom]);
        ctx.beginPath();
        ctx.moveTo(pt.x, oy);
        ctx.lineTo(pt.x, oy + H);
        ctx.stroke();
        // Label de alinhamento
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(29,78,216,0.60)';
        ctx.font = `500 ${11 / this.zoom}px Inter,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('↕', pt.x, y2 - 20 / this.zoom);
      }

      // Guia horizontal (alinha em Y)
      if (Math.abs(pt.y - y2) < TOL && Math.abs(pt.x - x2) > TOL * 3 && !drawnY.has(ky)) {
        drawnY.add(ky);
        ctx.strokeStyle = 'rgba(29,78,216,0.40)';
        ctx.setLineDash([60 / this.zoom, 30 / this.zoom]);
        ctx.beginPath();
        ctx.moveTo(ox,     pt.y);
        ctx.lineTo(ox + W, pt.y);
        ctx.stroke();
        // Label de alinhamento
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(29,78,216,0.60)';
        ctx.font = `500 ${11 / this.zoom}px Inter,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('↔', x2 + 20 / this.zoom, pt.y);
      }
    }

    ctx.setLineDash([]);
    ctx.restore();
  },

  _drawPreview(ctx) {
    if (!this.drawStart || !this.mouseWorld) return;
    const { x: x1, y: y1 } = this.drawStart;
    const { x: x2, y: y2 } = this.mouseWorld;

    // Linhas de projeção para paredes (alinhamento com endpoints existentes)
    if (this.currentTool === 'wall' && this._aiming) {
      this._drawProjectionLines(ctx, x2, y2);
    }

    if (this.currentTool === 'wall') {
      ctx.strokeStyle = 'rgba(29,78,216,0.55)';
      ctx.lineWidth   = 150;
      ctx.lineCap     = 'square';
      ctx.setLineDash([25 / this.zoom, 10 / this.zoom]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Length label
      const len = dist(x1, y1, x2, y2);
      if (len > 10) {
        const label = fmtM(len);
        const fs = 16 / this.zoom;
        ctx.font      = `600 ${fs}px Inter,sans-serif`;
        ctx.textAlign = 'center';
        const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2 - 16 / this.zoom;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(250,248,244,0.96)';
        ctx.fillRect(lx - tw / 2 - 5 / this.zoom, ly - fs, tw + 10 / this.zoom, fs + 6 / this.zoom);
        ctx.fillStyle = '#1D4ED8';
        ctx.fillText(label, lx, ly);
      }

      // Badge de ângulo travado — C-07
      if (this._snapBadge) {
        const fs2 = 13 / this.zoom;
        const pad = 5 / this.zoom;
        ctx.font = `700 ${fs2}px Inter,sans-serif`;
        const bw = ctx.measureText(this._snapBadge).width + pad * 2;
        const bh = fs2 + pad * 2;
        const bx = x2 + 18 / this.zoom;
        const by = y2 - bh / 2;
        ctx.fillStyle = '#1D4ED8';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 4 / this.zoom);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(this._snapBadge, bx + pad, by + bh / 2);
        ctx.textBaseline = 'alphabetic';
      }
    }

    if (this.currentTool === 'dimension') {
      const len = dist(x1, y1, x2, y2);
      const label = fmtM(len);
      ctx.strokeStyle = 'rgba(8,145,178,0.55)';
      ctx.lineWidth   = 2 / this.zoom;
      ctx.setLineDash([150 / this.zoom, 80 / this.zoom]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font      = `600 ${15 / this.zoom}px Inter,sans-serif`;
      ctx.fillStyle = '#0891B2';
      ctx.textAlign = 'center';
      ctx.fillText(label, (x1 + x2) / 2, (y1 + y2) / 2 - 12 / this.zoom);
    }

    // Start dot — tamanho fixo na tela (~13px)
    if (this.currentTool !== 'environment') {
      const r = 13 / this.zoom;
      const closing = this._aimClosing;

      if (closing) {
        // Halo verde pulsante: mira no ponto de fechamento — C-06
        ctx.strokeStyle = 'rgba(22,163,74,0.85)';
        ctx.lineWidth   = 2.5 / this.zoom;
        ctx.beginPath();
        ctx.arc(x1, y1, r + 14 / this.zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(22,163,74,0.4)';
        ctx.beginPath();
        ctx.arc(x1, y1, r + 28 / this.zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#16A34A';
      } else {
        ctx.strokeStyle = 'rgba(29,78,216,0.35)';
        ctx.lineWidth   = 3 / this.zoom;
        ctx.beginPath();
        ctx.arc(x1, y1, r + 7 / this.zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#1D4ED8';
      }
      ctx.beginPath();
      ctx.arc(x1, y1, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _drawEnvPreview(ctx) {
    if (!this.envPoints.length) return;
    const pts = this.envPoints;
    ctx.strokeStyle = 'rgba(90,154,112,0.75)';
    ctx.fillStyle   = 'rgba(90,154,112,0.07)';
    ctx.lineWidth   = 2 / this.zoom;
    ctx.setLineDash([12 / this.zoom, 8 / this.zoom]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    if (this.mouseWorld) ctx.lineTo(this.mouseWorld.x, this.mouseWorld.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill partial polygon
    if (pts.length >= 3 && this.mouseWorld) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
    }

    // Vertex dots
    for (let i = 0; i < pts.length; i++) {
      const r = i === 0 ? 9 / this.zoom : 6 / this.zoom;
      ctx.fillStyle = i === 0 ? 'rgba(90,154,112,0.9)' : 'rgba(90,154,112,0.6)';
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Point count label
    if (pts.length >= 3) {
      const fs = 14 / this.zoom;
      ctx.font      = `600 ${fs}px Inter,sans-serif`;
      ctx.fillStyle = 'rgba(90,154,112,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(`${pts.length} pts — toque em "Fechar"`, pts[0].x, pts[0].y - 16 / this.zoom);
    }
  },

  // ── HUD ──────────────────────────────────

  _updateHud() {
    const scaleEl  = document.getElementById('hud-scale');
    const coordsEl = document.getElementById('hud-coords');
    if (!scaleEl || !coordsEl) return;

    // 1px = (1/zoom) mm → 1m = zoom*1000 px
    const mmPer100px = (100 / this.zoom);
    const label = mmPer100px >= 1000
      ? `${(mmPer100px / 1000).toFixed(2)}m / 100px`
      : `${Math.round(mmPer100px)}cm / 100px`;
    scaleEl.textContent = label;

    const { x, y } = this.mouseWorld;
    const xM = (x / 1000).toFixed(3).replace('.', ',');
    const yM = (y / 1000).toFixed(3).replace('.', ',');
    coordsEl.textContent = `${xM}m, ${yM}m`;
  },

  // ── Mouse events ─────────────────────────

  _onMouseDown(e) {
    // Middle mouse or Alt+left = pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.isPanning = true;
      this.panStart  = { mx: e.clientX, my: e.clientY, panX: this.panX, panY: this.panY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;

    const rect  = this.canvas.getBoundingClientRect();
    const raw   = this.toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const world = this._snapWorld(raw, e.shiftKey);
    this.mouseWorld = world;

    if (this._handleScaleCalibClick(world)) return;

    // Parede: clica para fixar o início (snap magnético a endpoint existente)
    if (this.currentTool === 'wall') {
      if (!this.drawStart) {
        // Raio maior no 1º toque — facilita conectar a paredes existentes
        const snapped = this._snapToWallEndpoint(raw, true);
        this._wallSnapPt = null;
        this._wallSetAnchor(snapped || world);
      } else {
        this._aiming = true; this._wallAim(raw);
      }
      return;
    }

    // Porta/janela/instalação: arrasta até a parede
    if (this.currentTool === 'install') {
      this._aimingInstall = true;
      this._installAim(raw);
      return;
    }
    if (this.currentTool === 'door' || this.currentTool === 'window') {
      this._aimingOpening = true;
      this._openingAim(raw);
      return;
    }

    switch (this.currentTool) {
      case 'dimension':   this._clickDim(raw);      break; // raw para snap arquitetônico
      case 'install':     this._clickInstall(world); break;
      case 'photo':       this._clickPhoto(world);   break;
      case 'note':        this._clickNote(world);    break;
      case 'select':      this._clickSelect(raw);    break;
      case 'environment': this._clickEnvironment(world); break;
    }
  },

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const raw  = this.toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (this.isPanning) {
      this.panX = this.panStart.panX + (e.clientX - this.panStart.mx);
      this.panY = this.panStart.panY + (e.clientY - this.panStart.my);
      this._draw();
      return;
    }

    if (this.currentTool === 'wall' && this._aiming) {
      this._wallAim(raw);
      const prevWS = this._wallSnapPt;
      this._wallSnapPt = this._snapToWallEndpoint(this.mouseWorld || raw);
      if (!prevWS && this._wallSnapPt) navigator.vibrate?.(18);
      this._archSnapPt = null;
      this._draw();
      return;
    }
    if (this._aimingInstall)  { this._installAim(raw); return; }
    if (this._aimingOpening) { this._openingAim(raw); return; }

    this.mouseWorld = this._snapWorld(raw, e.shiftKey);

    // Snap magnético de cota: indicador em tempo real
    if (this.currentTool === 'dimension') {
      const prevAS = this._archSnapPt;
      this._archSnapPt = this._snapToArchPoint(raw);
      if (!prevAS && this._archSnapPt) navigator.vibrate?.(18);
      this._wallSnapPt = null;
      if (this._archSnapPt) this.mouseWorld = this._archSnapPt;
    // Snap magnético de parede: mostra ímã verde ao se aproximar de endpoint
    } else if (this.currentTool === 'wall') {
      const prevWS = this._wallSnapPt;
      this._wallSnapPt = this._snapToWallEndpoint(raw);
      if (!prevWS && this._wallSnapPt) navigator.vibrate?.(18);
      this._archSnapPt = null;
      if (this._wallSnapPt && !this.drawStart) {
        this.mouseWorld = this._wallSnapPt;
      }
    } else {
      this._archSnapPt = null;
      this._wallSnapPt = null;
    }

    this._draw();
  },

  _onMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
      return;
    }
    if (this.currentTool === 'wall' && this._aiming) { this._wallCommit(); return; }
    if (this._aimingInstall) { this._aimingInstall = false; this._installCommit(); return; }
    if (this._aimingOpening) { this._openingCommit(); }
  },

  _zoomAtCenter(factor) {
    // Zoom mantendo o centro da área visível (descontando a sidebar de 240px)
    const px   = (this.canvas.width - 240) / 2;
    const py   = this.canvas.height / 2;
    const newZ = Math.max(0.02, Math.min(30, this.zoom * factor));
    this.panX  = px - (px - this.panX) * (newZ / this.zoom);
    this.panY  = py - (py - this.panY) * (newZ / this.zoom);
    this.zoom  = newZ;
    this._draw();
  },

  _onWheel(e) {
    e.preventDefault();
    const rect   = this.canvas.getBoundingClientRect();
    const px     = e.clientX - rect.left;
    const py     = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
    const newZ   = Math.max(0.02, Math.min(30, this.zoom * factor));
    this.panX    = px - (px - this.panX) * (newZ / this.zoom);
    this.panY    = py - (py - this.panY) * (newZ / this.zoom);
    this.zoom    = newZ;
    this._draw();
  },

  _onDblClick(e) {
    if (this.currentTool === 'wall') { this._resetWallChain(); this._draw(); }
    else if (this.currentTool === 'dimension') { this.drawStart = null; this._draw(); }
  },

  // ── Tool click handlers ───────────────────

  // ── Parede guiada: direção (arraste) + comprimento (cm) ──
  // 1) toque marca o ponto inicial (âncora)
  // 2) arrasta na direção → trava em 90°/45° (livre se bem fora do eixo)
  // 3) solta → teclado numérico em cm → parede exata, âncora anda pro fim
  // Ao voltar perto do 1º ponto, fecha o ambiente automaticamente.

  _wallSetAnchor(p) {
    this.drawStart = { x: p.x, y: p.y };
    this._chainPts = [{ x: p.x, y: p.y }];
    this.mouseWorld = this.drawStart;
    this._updateCancelBtn();
    this._updateWallActions();
    this._updateUndoRedo();  // esconde btn-undo global durante a cadeia (C-10)
    this._showHint('Arraste na direção da parede e solte para digitar a medida');
    this._draw();
  },

  // Mostra/esconde os botões flutuantes de desenho (Concluir / Desfazer ponto)
  _updateWallActions() {
    const el = document.getElementById('wall-actions');
    if (!el) return;
    const active = this.currentTool === 'wall' && this._chainPts && this._chainPts.length >= 1;
    el.style.display = active ? 'flex' : 'none';
  },

  // Remove o último trecho desenhado (ou cancela se só houver o ponto inicial)
  _undoLastWallPoint() {
    if (!this._chainPts || this._chainPts.length === 0) return;
    if (this._chainPts.length === 1) { this._resetWallChain(); this._draw(); return; }

    this._pushHistory();
    const last = this._chainPts[this._chainPts.length - 1];
    const prev = this._chainPts[this._chainPts.length - 2];
    const walls = this.project.canvas.walls;
    for (let i = walls.length - 1; i >= 0; i--) {
      const w = walls[i];
      if (Math.abs(w.x1 - prev.x) < 1 && Math.abs(w.y1 - prev.y) < 1 &&
          Math.abs(w.x2 - last.x) < 1 && Math.abs(w.y2 - last.y) < 1) {
        walls.splice(i, 1);
        break;
      }
    }
    this._chainPts.pop();
    this.drawStart  = { x: prev.x, y: prev.y };
    this.mouseWorld = this.drawStart;
    this._aimAngle  = null;
    this._updateWallActions();
    this._scheduleSave();
    this._draw();
    Toast.show('Último trecho removido', 'info', 1500);
  },

  // Converte ângulo em radianos para label legível do snap (C-07)
  _angleLabel(ang) {
    const deg = Math.round(((ang * 180 / Math.PI) % 360 + 360) % 360);
    if (deg <= 14 || deg >= 346) return '0°';
    if (deg >= 76 && deg <= 104) return '90°';
    if (deg >= 166 && deg <= 194) return '180°';
    if (deg >= 256 && deg <= 284) return '90°';
    if (deg >= 31 && deg <= 59)  return '45°';
    if (deg >= 121 && deg <= 149) return '45°';
    if (deg >= 211 && deg <= 239) return '45°';
    if (deg >= 301 && deg <= 329) return '45°';
    return null;
  },

  _snapWallAngle(ang) {
    const TWO = Math.PI * 2;
    const norm = a => { a %= TWO; if (a > Math.PI) a -= TWO; if (a < -Math.PI) a += TWO; return a; };
    const d2r = d => d * Math.PI / 180;

    // Quando a bússola está ativa, os ângulos de snap são relativos ao heading atual.
    // Parede "horizontal" na tela = direção que a arquiteta está olhando (heading).
    // Parede "vertical" na tela = 90° do heading.
    // Isso permite desenhar normalmente enquanto caminha pelo ambiente.
    if (this._compassMode) {
      const h = this._compassHeading * Math.PI / 180; // heading em radianos
      const cardinals = [h, h + Math.PI / 2, h + Math.PI, h - Math.PI / 2];
      let best = cardinals[0], bestDiff = Infinity;
      for (const t of cardinals) {
        const diff = Math.abs(norm(ang - t));
        if (diff < bestDiff) { bestDiff = diff; best = t; }
      }
      return best;
    }

    // Modo ortogonal sem bússola: trava em 0°/90°/180°/270° do mundo
    if (this._orthoMode) {
      const cardinals = [0, 90, 180, -90, -180];
      let best = d2r(0), bestDiff = Infinity;
      for (const t of cardinals) {
        const diff = Math.abs(norm(ang - d2r(t)));
        if (diff < bestDiff) { bestDiff = diff; best = d2r(t); }
      }
      return best;
    }

    // Modo livre: tolerância generosa para H/V, menor para 45°
    for (const t of [0, 90, 180, -90, -180]) if (Math.abs(norm(ang - d2r(t))) <= d2r(22)) return d2r(t);
    for (const t of [45, 135, -45, -135])    if (Math.abs(norm(ang - d2r(t))) <= d2r(10)) return d2r(t);
    return ang;
  },

  _toggleOrtho() {
    this._orthoMode = !this._orthoMode;
    const btn = document.getElementById('btn-ortho');
    if (btn) btn.classList.toggle('active', this._orthoMode);
    Toast.show(
      this._orthoMode ? 'Ortho ON — paredes em 90°' : 'Ortho OFF — ângulo livre',
      'info', 1800
    );
  },

  // Atualiza a prévia enquanto arrasta a direção
  _wallAim(rawWorld) {
    if (!this.drawStart) return;
    const a = this.drawStart;
    const first = this._chainPts && this._chainPts[0];

    // Snap de fechamento: 50px de tela (seguro para dedo — era 30px, muito pequeno)
    if (first && this._chainPts.length >= 2 &&
        dist(rawWorld.x, rawWorld.y, first.x, first.y) * this.zoom < 50) {
      this._aimClosing = true;
      this._aimAngle   = Math.atan2(first.y - a.y, first.x - a.x);
      this.mouseWorld  = { x: first.x, y: first.y };
      this._showHint('Solte para fechar o ambiente');  // C-06: hint de fechamento
      this._draw();
      return;
    }

    if (this._aimClosing) this._showHint('Arraste na direção da parede e solte para digitar a medida');
    this._aimClosing = false;
    const rawAng = Math.atan2(rawWorld.y - a.y, rawWorld.x - a.x);
    const ang    = this._snapWallAngle(rawAng);
    const len    = dist(a.x, a.y, rawWorld.x, rawWorld.y);
    this._aimAngle  = ang;
    this.mouseWorld = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
    // Badge de ângulo travado — C-07
    const snapped = ang !== rawAng;
    this._snapBadge = snapped ? this._angleLabel(ang) : null;
    this._draw();
  },

  // Solta o arraste → pede o comprimento
  _wallCommit() {
    if (!this.drawStart || this._aimAngle == null) { this._aiming = false; return; }
    const a       = this.drawStart;
    const closing = !!this._aimClosing;
    const dirX    = Math.cos(this._aimAngle);
    const dirY    = Math.sin(this._aimAngle);

    let measured;
    if (closing) {
      const first = this._chainPts[0];
      measured = dist(a.x, a.y, first.x, first.y);
    } else {
      measured = dist(a.x, a.y, this.mouseWorld.x, this.mouseWorld.y);
    }
    this._aiming = false;

    // Movimento mínimo: ignora toque parado (precisa de uma direção)
    if (!closing && measured * this.zoom < 12) { this.mouseWorld = a; this._draw(); return; }

    // Sugestão em metros com 2 casas decimais (ex: "3,20")
    const mDefault = measured > 0 ? (measured / 1000).toFixed(2).replace('.', ',') : '';

    this._numpad({
      title: closing ? 'Fechar ambiente — comprimento (m)' : 'Comprimento da parede (m)',
      hint:  closing ? 'Esta parede fecha o contorno do ambiente'
                     : 'Direção travada. Digite a medida da trena.',
      unit:  'm',
      value: mDefault,
      onOk:  m => this._addWallSegment(a, dirX, dirY, m * 1000, closing),
      onCancel: () => { this.mouseWorld = a; this._draw(); },
      extraActions: closing ? [] : [
        {
          id: 'np-door',
          label: `${this._ic('door')} Porta`,
          onOk: wallM => {
            // Parede confirmada — agora pede a largura da porta separadamente
            this._numpad({
              title: 'Largura da porta (cm)',
              hint:  'Medida do vão — ex: 80, 90, 100',
              value: '90',
              unit:  'cm',
              onOk:  widthCm => this._addWallWithOpening(a, dirX, dirY, wallM * 1000, 'door', widthCm * 10),
              onCancel: () => {},
            });
          },
        },
        {
          id: 'np-window',
          label: `${this._ic('window')} Janela`,
          onOk: wallM => {
            this._numpad({
              title: 'Largura da janela (cm)',
              hint:  'Medida do vão — ex: 60, 100, 120',
              value: '100',
              unit:  'cm',
              onOk:  widthCm => this._addWallWithOpening(a, dirX, dirY, wallM * 1000, 'window', widthCm * 10),
              onCancel: () => {},
            });
          },
        },
      ],
    });
  },

  _addWallSegment(a, dirX, dirY, lenMm, closing) {
    let end;
    if (closing) {
      const first = this._chainPts[0];
      end = { x: first.x, y: first.y };
    } else {
      end = { x: a.x + dirX * lenMm, y: a.y + dirY * lenMm };
      // Snap automático: se o endpoint calculado está a ≤300mm de um endpoint
      // existente, trava nele — evita paredes "voando" por diferença de digitação
      const snapPt = this._snapToNearestEndpoint(end, 300);
      if (snapPt) end = snapPt;
    }

    this._pushHistory();
    this.project.canvas.walls.push({
      id: generateId(),
      x1: a.x, y1: a.y, x2: end.x, y2: end.y,
      thickness: 150,
    });

    if (closing) {
      const pts = this._chainPts.slice();   // contorno fechado (1º ponto conecta no fim)
      this._resetWallChain();
      this._scheduleSave();
      this._draw();
      this._promptEnvironment(pts);
    } else {
      this._chainPts.push({ x: end.x, y: end.y });
      this.drawStart  = end;
      this.mouseWorld = end;
      this._aimAngle  = null;
      this._updateWallActions();
      this._scheduleSave();
      this._draw();
    }
  },

  // Cria segmento de parede com abertura (porta/janela) já inserida —
  // chamado quando a usuária toca [Porta] ou [Janela] no numpad da parede.
  _addWallWithOpening(a, dirX, dirY, lenMm, type, widthMm = null) {
    const openingWidth = widthMm || (type === 'door' ? 900 : 1000);
    // Validar: vão não pode ser maior ou igual à parede
    if (openingWidth >= lenMm) {
      const vaoLabel = type === 'door' ? 'porta' : 'janela';
      Toast.show(`Vão da ${vaoLabel} (${Math.round(openingWidth/10)}cm) maior que a parede (${Math.round(lenMm/10)}cm)`, 'error', 3000);
      return;
    }
    const end    = { x: a.x + dirX * lenMm, y: a.y + dirY * lenMm };
    const wallId = generateId();
    this._pushHistory();
    this.project.canvas.walls.push({
      id: wallId,
      x1: a.x, y1: a.y, x2: end.x, y2: end.y,
      thickness: 150,
    });
    this.project.canvas.openings.push({
      id:        generateId(),
      type,
      wallId,
      position:  0.5,
      width:     openingWidth,
      height:    type === 'door' ? 2100 : 1200,
      sill:      type === 'door' ? 0    : 900,
      hingeSide: 'right',
      openDir:   'in',
      side:      'right',
    });
    this._chainPts.push({ x: end.x, y: end.y });
    this.drawStart  = end;
    this.mouseWorld = end;
    this._aimAngle  = null;
    this._updateWallActions();
    this._scheduleSave();
    this._draw();
    Toast.show(type === 'door' ? 'Porta inserida — continue a parede' : 'Janela inserida — continue a parede', 'success', 2000);
  },

  _resetWallChain() {
    this.drawStart   = null;
    this._chainPts   = null;
    this._aiming     = false;
    this._aimClosing = false;
    this._aimAngle   = null;
    this._snapBadge  = null;
    this._updateCancelBtn();
    this._updateWallActions();
    this._updateUndoRedo();  // btn-undo reaparece ao sair da cadeia
    this._showHint('Toque para marcar o início da parede');
  },

  // ── Teclado numérico reutilizável ──
  // Aceita toque nos botões E teclado físico (PC/tablet com teclado).
  // value = sugestão (ex: "3,20"). O primeiro toque/tecla substitui a sugestão.
  // unit  = unidade exibida (padrão: 'm')
  // extraActions: [{id, label, onOk}] — botões extras entre Cancelar e OK
  _numpad({ title, hint, value, unit = 'm', onOk, onCancel, extraActions = [] }) {
    let buf   = (value !== undefined && value !== null && value !== '') ? String(value) : '';
    let fresh = buf !== '';   // veio sugestão → 1ª interação começa do zero

    const extraBtns = extraActions.map(a =>
      `<button class="btn-ghost np-extra" id="${esc(a.id)}">${a.label}</button>`
    ).join('');

    Modal.open(`
      <div class="numpad">
        <div class="numpad-title">${esc(title || '')}</div>
        ${hint ? `<div class="numpad-hint">${esc(hint)}</div>` : ''}
        <div class="numpad-display">
          <span id="np-val" class="${fresh ? 'np-suggest' : ''}">${esc(buf || '0')}</span>
          <span class="numpad-unit">${esc(unit)}</span>
        </div>
        <div class="numpad-grid">
          ${[7,8,9,4,5,6,1,2,3].map(n => `<button class="np-key" data-k="${n}">${n}</button>`).join('')}
          <button class="np-key np-dec" data-k=",">,</button>
          <button class="np-key" data-k="0">0</button>
          <button class="np-key np-back" data-k="back">⌫</button>
        </div>
        <div class="numpad-actions">
          <button class="btn-ghost" id="np-cancel">Cancelar</button>
          ${extraBtns}
          <button class="btn-primary" id="np-ok">OK → Parede</button>
        </div>
      </div>
    `);

    const refresh = () => {
      const el = document.getElementById('np-val');
      if (el) { el.textContent = buf || '0'; el.classList.toggle('np-suggest', fresh); }
    };

    const press = k => {
      if (k === 'back')  { if (fresh) { buf = ''; fresh = false; } else buf = buf.slice(0, -1); }
      else if (k === ',' || k === '.') {
        if (fresh) { buf = '0'; fresh = false; }
        if (!buf.includes(',') && !buf.includes('.')) buf += ',';
      }
      else if (/^[0-9]$/.test(k)) { if (fresh) { buf = ''; fresh = false; } buf += k; }
      refresh();
    };

    document.querySelectorAll('.np-key').forEach(b =>
      b.addEventListener('click', () => press(b.dataset.k))
    );

    // Suporte a teclado físico — funciona no PC e em tablet com teclado bluetooth
    const keyHandler = e => {
      if (['INPUT','TEXTAREA'].includes(e.target?.tagName)) return;
      if (/^[0-9]$/.test(e.key))            { e.preventDefault(); press(e.key); }
      else if (e.key === '.' || e.key === ',') { e.preventDefault(); press(','); }
      else if (e.key === 'Backspace')          { e.preventDefault(); press('back'); }
      else if (e.key === 'Enter')              { e.preventDefault(); document.getElementById('np-ok')?.click(); }
      else if (e.key === 'Escape')             { e.preventDefault(); document.getElementById('np-cancel')?.click(); }
    };
    document.addEventListener('keydown', keyHandler);

    const cleanup = () => document.removeEventListener('keydown', keyHandler);

    document.getElementById('np-cancel').addEventListener('click', () => {
      cleanup(); Modal.close(); if (onCancel) onCancel();
    });
    document.getElementById('np-ok').addEventListener('click', () => {
      const num = parseLocaleFloat(buf);
      if (!num || num <= 0) { Toast.show('Digite um valor válido', 'error'); return; }
      cleanup(); Modal.close(); onOk(num);
    });
    extraActions.forEach(a => {
      document.getElementById(a.id)?.addEventListener('click', () => {
        const num = parseLocaleFloat(buf);
        if (!num || num <= 0) { Toast.show('Digite a largura primeiro', 'error'); return; }
        cleanup(); Modal.close(); a.onOk(num);
      });
    });
  },

  // Indicador visual de snap arquitetônico: cruz branca + badge com fundo escuro
  _drawArchSnap(ctx) {
    const pt = this._archSnapPt;
    if (!pt) return;
    const r = 10 / this.zoom;

    // Ponto preenchido dourado + anel — discreto e alinhado com a cor das cotas
    ctx.fillStyle   = '#C9A84C';
    ctx.strokeStyle = 'rgba(201,168,76,0.4)';
    ctx.lineWidth   = 6 / this.zoom;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (pt.label) {
      const fs  = 11 / this.zoom;
      const pad = 4  / this.zoom;
      ctx.font = `700 ${fs}px Inter,sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      const tw = ctx.measureText(pt.label).width;
      const bx = pt.x - tw / 2 - pad;
      const by = pt.y - r * 2 - fs - pad;
      ctx.fillStyle = 'rgba(0,0,0,0.88)';
      ctx.beginPath();
      ctx.roundRect(bx, by, tw + pad * 2, fs + pad * 1.5, 3 / this.zoom);
      ctx.fill();
      ctx.fillStyle = '#C9A84C';
      ctx.fillText(pt.label, pt.x, by + fs + pad * 0.75);
      ctx.textBaseline = 'alphabetic';
    }
  },

  // Garante que o offset da cota sempre vai para o EXTERIOR do desenho.
  // Calcula o centroide de todas as paredes e força o offset para o lado
  // que AFASTA do centro (exterior). Offset positivo = lado esquerdo do vetor;
  // negativo = lado direito. Retorna positivo ou negativo.
  _exteriorOffset(p1, p2, offsetMag) {
    const walls = this.project.canvas.walls;
    if (!walls.length) return offsetMag;

    // Centroide do levantamento (média de todos os endpoints de parede)
    let cx = 0, cy = 0, n = 0;
    for (const w of walls) {
      cx += w.x1 + w.x2; cy += w.y1 + w.y2; n += 2;
    }
    cx /= n; cy /= n;

    const dx  = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (!len) return offsetMag;

    // Normal perpendicular (lado "esquerdo" do vetor p1→p2)
    const nx = -dy / len, ny = dx / len;
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;

    // Distância ao centroide com offset positivo vs negativo
    const dPos = dist(mx + nx * offsetMag, my + ny * offsetMag, cx, cy);
    const dNeg = dist(mx - nx * offsetMag, my - ny * offsetMag, cx, cy);

    // Retorna o offset que maximiza a distância ao centroide (= exterior)
    return dPos >= dNeg ? offsetMag : -offsetMag;
  },

  // Calcula o offset ideal para uma nova cota evitar sobreposição com existentes.
  // Tiers: 400 → 900 → 1400 → 1900mm (cada ~50cm mais afastado da parede).
  // Detecta cotas paralelas e com extents sobrepostos — se houver conflito, sobe de nível.
  _calcDimOffset(p1, p2) {
    const dims = this.project.canvas.dimensions;
    if (!dims.length) return 400;

    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (!len) return 400;

    const nx = -dy / len, ny = dx / len; // normal perpendicular da nova cota
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;

    const TIERS = [400, 900, 1400, 1900];

    for (const off of TIERS) {
      // Posição da linha de cota neste tier
      const cotaMidX = cx + nx * off;
      const cotaMidY = cy + ny * off;

      let conflict = false;
      for (const d of dims) {
        const ddx = d.x2 - d.x1, ddy = d.y2 - d.y1;
        const dlen = Math.sqrt(ddx*ddx + ddy*ddy);
        if (!dlen) continue;

        const dnx = -ddy / dlen, dny = ddx / dlen;
        const doff = d.offset || 400;

        // Só considera cotas aproximadamente paralelas
        const dotNorm = Math.abs(nx * dnx + ny * dny);
        if (dotNorm < 0.85) continue;

        // Midpoint da cota existente naquele offset
        const dmx = (d.x1+d.x2)/2 + dnx*doff;
        const dmy = (d.y1+d.y2)/2 + dny*doff;

        // Distância perpendicular entre as duas linhas de cota
        const perpDist = Math.abs(nx*(dmx - cotaMidX) + ny*(dmy - cotaMidY));
        if (perpDist > 300) continue; // linhas distantes perpendicularmente — sem conflito

        // Verificar sobreposição de extents na direção paralela
        const parDist = Math.abs((dx/len)*(dmx - cotaMidX) + (dy/len)*(dmy - cotaMidY));
        if (parDist > (len + dlen) / 2 + 300) continue; // extents não se sobrepõem

        conflict = true;
        break;
      }

      if (!conflict) return off;
    }

    return TIERS[TIERS.length - 1];
  },

  _clickDim(rawWorld) {
    // Snap magnético para cotas: captura pontos arquitetônicos estratégicos
    const snapped = this._snapToArchPoint(rawWorld) || rawWorld;
    this._archSnapPt = null; // limpa indicador após clique

    if (!this.drawStart) {
      this.drawStart = snapped;
      this._updateCancelBtn();
      Toast.show('Ponto inicial marcado — toque no ponto final', 'info', 2500);
    } else {
      const len = dist(this.drawStart.x, this.drawStart.y, snapped.x, snapped.y);
      if (len > 10) {
        // Magnitude do offset (tier automático) + sinal que força para o exterior
        const offsetMag = this._calcDimOffset(this.drawStart, snapped);
        const offset    = this._exteriorOffset(this.drawStart, snapped, offsetMag);
        this._pushHistory();
        this.project.canvas.dimensions.push({
          id: generateId(),
          x1: this.drawStart.x, y1: this.drawStart.y,
          x2: snapped.x,        y2: snapped.y,
          value: null, offset,
          wallId: null, label: null,
        });
        this._scheduleSave();
      }
      this.drawStart = null;
      this._draw();
    }
  },

  _clickSelect(rawWorld) {
    const HIT = 12 / this.zoom;

    // Check openings first (ficam sobre as paredes)
    for (const o of this.project.canvas.openings) {
      const w = this.project.canvas.walls.find(w => w.id === o.wallId);
      if (!w) continue;
      const cx = w.x1 + (w.x2 - w.x1) * o.position;
      const cy = w.y1 + (w.y2 - w.y1) * o.position;
      if (dist(rawWorld.x, rawWorld.y, cx, cy) < (o.width || 900) / 2 + 150) {
        this.selected = { type: 'opening', id: o.id };
        this._showProps(o, 'opening');
        this._draw();
        return;
      }
    }

    // Check walls
    for (const w of this.project.canvas.walls) {
      if (this._pointNearSegment(rawWorld, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }, HIT)) {
        if (this.selected?.id === w.id) {
          // Segundo toque na mesma parede → editar comprimento
          this._editWallLength(w);
          return;
        }
        this.selected = { type: 'wall', id: w.id };
        this._showProps(w, 'wall');
        this._showSelWallActions(true);
        this._draw();
        return;
      }
    }
    // Check installations
    for (const inst of this.project.canvas.installations) {
      if (dist(rawWorld.x, rawWorld.y, inst.x, inst.y) < 200) {
        this.selected = { type: 'install', id: inst.id };
        this._showProps(inst, 'install');
        this._draw();
        return;
      }
    }
    // Check photo pins
    for (const pin of this.project.canvas.photoPins) {
      if (dist(rawWorld.x, rawWorld.y, pin.x, pin.y) < 200) {
        this.selected = { type: 'photo', id: pin.id };
        this._showProps(pin, 'photo');
        this._draw();
        return;
      }
    }
    // Check notes
    for (const note of this.project.canvas.notes) {
      if (dist(rawWorld.x, rawWorld.y, note.x, note.y) < 300) {
        this.selected = { type: 'note', id: note.id };
        this._showProps(note, 'note');
        this._draw();
        return;
      }
    }
    // Check environments
    for (const env of this.project.canvas.environments) {
      if (env.polygon && this._pointInPolygon(rawWorld, env.polygon)) {
        this.selected = { type: 'environment', id: env.id };
        this._showProps(env, 'environment');
        this._draw();
        return;
      }
    }
    // Check dims
    for (const d of this.project.canvas.dimensions) {
      const off   = d.offset || 400;
      const dx    = d.x2 - d.x1;
      const dy    = d.y2 - d.y1;
      const len   = Math.sqrt(dx * dx + dy * dy);
      const px    = -dy / len * off;
      const py    =  dx / len * off;
      const p1    = { x: d.x1 + px, y: d.y1 + py };
      const p2    = { x: d.x2 + px, y: d.y2 + py };
      if (this._pointNearSegment(rawWorld, p1, p2, HIT)) {
        this.selected = { type: 'dim', id: d.id };
        this._showProps(d, 'dim');
        this._draw();
        return;
      }
    }

    // Deselect
    this.selected = null;
    this._showProps(null);
    this._showSelWallActions(false);
    this._draw();
  },

  // Enquanto arrasta: acha a parede mais próxima do dedo e a marca como alvo
  _openingAim(rawWorld) {
    let bestWall = null, bestT = 0, bestDist = Infinity;
    for (const w of this.project.canvas.walls) {
      const { t, d } = this._projectPointOnSegment(rawWorld, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      if (d < bestDist && t >= 0 && t <= 1) { bestDist = d; bestWall = w; bestT = t; }
    }
    if (bestWall && bestDist <= 600) {
      this._placingOpening = {
        type: this.currentTool, wallId: bestWall.id, position: bestT,
        cx: bestWall.x1 + (bestWall.x2 - bestWall.x1) * bestT,
        cy: bestWall.y1 + (bestWall.y2 - bestWall.y1) * bestT,
      };
    } else {
      this._placingOpening = null;
    }
    this._draw();
  },

  // Ao soltar: confirma a parede alvo e abre o formulário
  _openingCommit() {
    this._aimingOpening = false;
    const pl = this._placingOpening;
    if (!pl) { Toast.show('Arraste até uma parede para inserir', 'info'); this._draw(); return; }
    const wall = this.project.canvas.walls.find(w => w.id === pl.wallId);
    if (!wall) { this._placingOpening = null; this._draw(); return; }
    // mantém o realce até o formulário fechar (confirmação visual da parede)
    this._openOpeningForm(pl.type, wall, pl.position);
  },

  // Realça a parede alvo + marca o canto de referência + mostra cota de distância
  _drawOpeningPlacement(ctx) {
    const pl = this._placingOpening;
    if (!pl) return;
    const w = this.project.canvas.walls.find(w => w.id === pl.wallId);
    if (!w) return;

    // Parede realçada
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#C9A84C';
    ctx.lineWidth   = (w.thickness || 150) + 70 / this.zoom;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
    ctx.restore();

    // Canto de referência — eixo da parede (ponto de partida do cálculo)
    const refX = pl.refX ?? w.x1;
    const refY = pl.refY ?? w.y1;

    // Se houver prévia de abertura, calcular a face e mostrar cota DESDE A FACE
    if (this._openingPreview) {
      const o    = this._openingPreview;
      const dx   = w.x2 - w.x1, dy = w.y2 - w.y1;
      const wlen = Math.sqrt(dx * dx + dy * dy);
      if (!wlen) return;
      const nx = dx / wlen, ny = dy / wlen;

      // Borda do vão mais próxima do canto
      const cx    = w.x1 + dx * o.position;
      const cy    = w.y1 + dy * o.position;
      const half  = (o.width || 800) / 2;
      const edgeX = cx - nx * half;
      const edgeY = cy - ny * half;

      // FACE da parede = eixo + espessura/2 na direção do vão
      // (a medida que o usuário vê e digita parte daqui, não do eixo)
      const faceOff = (w.thickness || 150) / 2;
      const toEdge  = { x: edgeX - refX, y: edgeY - refY };
      const toEdgeL = Math.sqrt(toEdge.x**2 + toEdge.y**2);
      const faceX   = toEdgeL > 0 ? refX + (toEdge.x/toEdgeL)*faceOff : refX;
      const faceY   = toEdgeL > 0 ? refY + (toEdge.y/toEdgeL)*faceOff : refY;

      // Ponto verde NA FACE (não no eixo) — referência visual clara para a arquiteta
      ctx.strokeStyle = 'rgba(90,154,112,0.4)';
      ctx.lineWidth   = 1.5 / this.zoom;
      ctx.beginPath(); ctx.arc(faceX, faceY, 16 / this.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#5A9A70';
      ctx.beginPath(); ctx.arc(faceX, faceY, 10 / this.zoom, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1A1814'; ctx.lineWidth = 2 / this.zoom; ctx.stroke();

      // Cota tracejada: FACE → borda do vão (= o que o usuário digitou)
      const offPerp = { x: -ny * (w.thickness || 150) * 0.9, y: nx * (w.thickness || 150) * 0.9 };
      ctx.save();
      ctx.strokeStyle = '#5A9A70';
      ctx.lineWidth   = 1.5 / this.zoom;
      ctx.setLineDash([12 / this.zoom, 6 / this.zoom]);
      ctx.beginPath();
      ctx.moveTo(faceX + offPerp.x, faceY + offPerp.y);
      ctx.lineTo(edgeX + offPerp.x, edgeY + offPerp.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [px, py] of [[faceX, faceY], [edgeX, edgeY]]) {
        const r = 5 / this.zoom;
        ctx.beginPath();
        ctx.moveTo(px + offPerp.x - (-ny)*r, py + offPerp.y - nx*r);
        ctx.lineTo(px + offPerp.x + (-ny)*r, py + offPerp.y + nx*r);
        ctx.stroke();
      }
      // Label: distância da FACE até o vão = exatamente o que o usuário digitou
      const userMm = Math.max(0, dist(faceX, faceY, edgeX, edgeY));
      const distLabel = fmtM(userMm);
      const mx2 = (faceX + edgeX) / 2 + offPerp.x * 1.4;
      const my2 = (faceY + edgeY) / 2 + offPerp.y * 1.4;
      const fs2 = 12 / this.zoom;
      ctx.font = `600 ${fs2}px Inter,sans-serif`;
      ctx.fillStyle = '#5A9A70';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(distLabel, mx2, my2);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    } else {
      // Sem prévia ainda: mostrar só o ponto verde no eixo
      ctx.strokeStyle = 'rgba(90,154,112,0.4)';
      ctx.lineWidth   = 1.5 / this.zoom;
      ctx.beginPath(); ctx.arc(refX, refY, 16 / this.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#5A9A70';
      ctx.beginPath(); ctx.arc(refX, refY, 10 / this.zoom, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1A1814'; ctx.lineWidth = 2 / this.zoom; ctx.stroke();
    }
  },

  // Abre painel lateral deslizante (sem backdrop) para porta/janela.
  // O canvas continua visível — a prévia ao vivo e o ponto verde aparecem na planta.
  _openSidePanel(html) {
    // Remove painel anterior IMEDIATAMENTE (sem timeout) para evitar conflito de ID
    const prev = document.getElementById('opening-panel');
    if (prev) prev.remove();

    const el = document.createElement('div');
    el.className = 'opening-panel';
    el.id = 'opening-panel';
    el.innerHTML = html;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    return el; // retorna referência direta — nunca usar getElementById depois
  },

  _closeSidePanel() {
    const el = document.getElementById('opening-panel');
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(() => { if (el.parentNode) el.remove(); }, 230);
  },

  // ── Instalação ancorada à parede ─────────────────────────────────────────
  // Fluxo idêntico à abertura: arraste → parede acende → formulário lateral
  // com tipo + distância do canto + altura → ponto salvo com wallId/wallT.

  _installAim(rawWorld) {
    let bestWall = null, bestT = 0, bestDist = Infinity;
    for (const w of this.project.canvas.walls) {
      const { t, d } = this._projectPointOnSegment(rawWorld, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      if (d < bestDist && t >= 0 && t <= 1) { bestDist = d; bestWall = w; bestT = t; }
    }
    // Threshold FIXO em mm (não depende do zoom): dentro de 500mm = modo parede
    // Garante que tocar no piso longe de paredes sempre ativa modo piso
    if (bestWall && bestDist <= 500) {
      const wl  = dist(bestWall.x1, bestWall.y1, bestWall.x2, bestWall.y2);
      const dS  = dist(rawWorld.x, rawWorld.y, bestWall.x1, bestWall.y1);
      const dE  = dist(rawWorld.x, rawWorld.y, bestWall.x2, bestWall.y2);
      const nearStart = dS <= dE;
      this._placingInstall = {
        mode: 'wall',
        wallId:     bestWall.id,
        wallT:      bestT,
        nearStart,
        refX: nearStart ? bestWall.x1 : bestWall.x2,
        refY: nearStart ? bestWall.y1 : bestWall.y2,
        initDistCm: Math.round((nearStart ? bestT * wl : (1 - bestT) * wl) / 10),
      };
    } else if (this.project.canvas.walls.length >= 2) {
      // Modo PISO: toque longe das paredes → amarra em duas paredes (X + Y)
      // Encontrar parede mais próxima horizontal e vertical
      const walls = this.project.canvas.walls;
      let wallH = null, distH = Infinity; // parede mais próxima em Y (horizontal)
      let wallV = null, distV = Infinity; // parede mais próxima em X (vertical)

      for (const w of walls) {
        const dx = Math.abs(w.x2 - w.x1), dy = Math.abs(w.y2 - w.y1);
        const len = Math.sqrt(dx*dx + dy*dy);
        if (!len) continue;
        const { d } = this._projectPointOnSegment(rawWorld, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        const angle = Math.atan2(Math.abs(dy), Math.abs(dx)); // 0=horiz, 90=vert
        if (angle < Math.PI / 4) { // parede mais horizontal → referência Y
          if (d < distH) { distH = d; wallH = w; }
        } else {                   // parede mais vertical → referência X
          if (d < distV) { distV = d; wallV = w; }
        }
      }

      this._placingInstall = {
        mode:    'floor',
        floorX:  rawWorld.x,
        floorY:  rawWorld.y,
        refX:    rawWorld.x,
        refY:    rawWorld.y,
        wallH,   // parede referência Y (horizontal)
        wallV,   // parede referência X (vertical)
        // Distâncias da face de cada parede até o ponto tocado
        initDistX: wallV ? Math.max(0, Math.round((Math.abs(rawWorld.x - (wallV.x1+wallV.x2)/2) - (wallV.thickness||150)/2) / 10)) : 0,
        initDistY: wallH ? Math.max(0, Math.round((Math.abs(rawWorld.y - (wallH.y1+wallH.y2)/2) - (wallH.thickness||150)/2) / 10)) : 0,
      };
    } else {
      this._placingInstall = null;
    }
    this._draw();
  },

  _installCommit() {
    const pl = this._placingInstall;
    if (!pl) { Toast.show('Arraste até uma parede ou toque no piso', 'info'); this._draw(); return; }
    if (pl.mode === 'floor') {
      this._openInstallFormFloor(pl);
    } else {
      const wall = this.project.canvas.walls.find(w => w.id === pl.wallId);
      if (!wall) { this._placingInstall = null; this._draw(); return; }
      this._openInstallForm(wall, pl.wallT);
    }
  },

  _drawInstallPlacement(ctx) {
    const pl = this._placingInstall;
    if (!pl) return;
    const w = this.project.canvas.walls.find(w => w.id === pl.wallId);
    if (!w) return;

    // Realça a parede
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#5B9BD5';
    ctx.lineWidth   = (w.thickness || 150) + 70 / this.zoom;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
    ctx.restore();

    const refX = pl.refX;
    const refY = pl.refY;
    if (refX == null) return;

    if (this._installPreview) {
      const ip = this._installPreview;

      // Calcular face: refX + faceOffset na direção da instalação (mesmo critério da porta)
      const toInst = { x: ip.x - refX, y: ip.y - refY };
      const toInstL = Math.sqrt(toInst.x**2 + toInst.y**2);
      const faceOff = (w.thickness || 150) / 2;
      const faceX   = toInstL > 0 ? refX + (toInst.x/toInstL)*faceOff : refX;
      const faceY   = toInstL > 0 ? refY + (toInst.y/toInstL)*faceOff : refY;

      // Ponto azul NA FACE (não no eixo)
      ctx.strokeStyle = 'rgba(91,155,213,0.4)';
      ctx.lineWidth   = 1.5 / this.zoom;
      ctx.beginPath(); ctx.arc(faceX, faceY, 18 / this.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#5B9BD5';
      ctx.beginPath(); ctx.arc(faceX, faceY, 11 / this.zoom, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1A1814'; ctx.lineWidth = 2 / this.zoom; ctx.stroke();

      // Cota tracejada FACE → instalação (= o que o usuário digitou)
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const wlen = Math.sqrt(dx*dx + dy*dy);
      const perp = wlen > 0 ? { x: -dy/wlen, y: dx/wlen } : { x: 0, y: 1 };
      const offP = { x: perp.x * (w.thickness || 150) * 0.9, y: perp.y * (w.thickness || 150) * 0.9 };

      ctx.save();
      ctx.strokeStyle = '#5B9BD5';
      ctx.lineWidth   = 1.5 / this.zoom;
      ctx.setLineDash([12 / this.zoom, 6 / this.zoom]);
      ctx.beginPath();
      ctx.moveTo(faceX + offP.x, faceY + offP.y);
      ctx.lineTo(ip.x  + offP.x, ip.y  + offP.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [px, py] of [[faceX, faceY], [ip.x, ip.y]]) {
        const r = 5 / this.zoom;
        ctx.beginPath();
        ctx.moveTo(px + offP.x - perp.x*r, py + offP.y - perp.y*r);
        ctx.lineTo(px + offP.x + perp.x*r, py + offP.y + perp.y*r);
        ctx.stroke();
      }
      const userMm = Math.max(0, dist(faceX, faceY, ip.x, ip.y));
      const lbl = fmtM(userMm);
      const mx2 = (faceX + ip.x)/2 + offP.x*1.4;
      const my2 = (faceY + ip.y)/2 + offP.y*1.4;
      const fs2 = 11 / this.zoom;
      ctx.font = `600 ${fs2}px Inter,sans-serif`;
      ctx.fillStyle = '#5B9BD5';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, mx2, my2);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    } else {
      // Sem preview: ponto azul no eixo (antes de escolher tipo)
      ctx.strokeStyle = 'rgba(91,155,213,0.4)';
      ctx.lineWidth   = 1.5 / this.zoom;
      ctx.beginPath(); ctx.arc(refX, refY, 18 / this.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#5B9BD5';
      ctx.beginPath(); ctx.arc(refX, refY, 11 / this.zoom, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1A1814'; ctx.lineWidth = 2 / this.zoom; ctx.stroke();
    }
  },

  // Formulário de instalação NO PISO — amarração em duas paredes (X + Y)
  _openInstallFormFloor(pl) {
    const available = getAvailableInstallTypes(this.project);
    const byCategory = {};
    for (const e of available) {
      if (!byCategory[e.category]) byCategory[e.category] = [];
      byCategory[e.category].push(e);
    }
    const catLabel = c => ({ eletrica:'Elétrica', hidraulica:'Hidráulica / Gás', odonto:'Odontológico', restaurante:'Restaurante' }[c] || c);
    const catCss   = c => ({ eletrica:'electric', hidraulica:'hydro', odonto:'odonto', restaurante:'restaurante' }[c] || 'electric');
    const sectionsHtml = Object.entries(byCategory).map(([cat, entries]) => `
      <div class="modal-section">${catLabel(cat)}</div>
      <div class="install-grid">
        ${entries.map(e => `<button class="install-btn ${catCss(cat)}" data-type="${e.id}">${esc(e.label)}</button>`).join('')}
      </div>`).join('');

    const nameH = pl.wallH ? `Parede ${Math.abs(pl.wallH.x2-pl.wallH.x1) > Math.abs(pl.wallH.y2-pl.wallH.y1) ? 'horizontal' : 'vertical'} (Y)` : 'Parede Y';
    const nameV = pl.wallV ? `Parede ${Math.abs(pl.wallV.x2-pl.wallV.x1) < Math.abs(pl.wallV.y2-pl.wallV.y1) ? 'vertical' : 'horizontal'} (X)` : 'Parede X';

    const panel = this._openSidePanel(`
      <div class="op-header">
        <span class="op-title">Inserir instalação — Piso</span>
        <button class="op-close" id="op-x">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="op-ref-hint" style="background:rgba(91,155,213,0.07);">
        <span class="op-ref-dot" style="background:#5B9BD5;"></span>
        Ponto no piso — amarrado em 2 paredes
      </div>
      <div class="op-body" id="install-body">
        ${sectionsHtml}
      </div>
      <div class="op-footer" id="install-footer" style="display:none;">
        <button class="btn-ghost" id="inst-back" style="font-size:11px;">← Tipos</button>
        <button class="btn-primary" id="inst-confirm" style="flex:1;">Inserir</button>
      </div>
    `);

    let selectedType = null;
    const clearPreview = () => { this._installPreview = null; this._placingInstall = null; };
    const closeForm    = () => { clearPreview(); this._closeSidePanel(); this._draw(); };

    const syncFloor = (type, distXcm, distYcm) => {
      if (!type) return;
      const faceH = (pl.wallH?.thickness || 150) / 2;
      const faceV = (pl.wallV?.thickness || 150) / 2;
      const dXmm = parseLocaleFloat(String(distXcm)) * 10 + faceV;
      const dYmm = parseLocaleFloat(String(distYcm)) * 10 + faceH;

      // Calcular posição absoluta a partir das paredes de referência
      let px = pl.floorX, py = pl.floorY;
      if (pl.wallV) {
        const midVx = (pl.wallV.x1 + pl.wallV.x2) / 2;
        px = midVx + (pl.floorX > midVx ? 1 : -1) * dXmm;
      }
      if (pl.wallH) {
        const midHy = (pl.wallH.y1 + pl.wallH.y2) / 2;
        py = midHy + (pl.floorY > midHy ? 1 : -1) * dYmm;
      }
      this._installPreview = { x: px, y: py, type };
      this._placingInstall.refX = px;
      this._placingInstall.refY = py;
      this._draw();
    };

    const showStep2Floor = (type) => {
      selectedType = type;
      const entry = getInstallEntry(type) || { label: type, defaultHeight: null };
      const defH  = entry.defaultHeight != null ? String(entry.defaultHeight) : '';
      document.getElementById('install-body').innerHTML = `
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:12px;">${esc(entry.label)} — Piso</div>
        <div class="form-group">
          <label class="form-label">${nameV}: dist. da face (cm)</label>
          <div class="op-input-wrap">
            <input class="form-input op-num" id="inst-distX" inputmode="decimal" type="text" value="${pl.initDistX}">
            <span class="op-unit">cm</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">${nameH}: dist. da face (cm)</label>
          <div class="op-input-wrap">
            <input class="form-input op-num" id="inst-distY" inputmode="decimal" type="text" value="${pl.initDistY}">
            <span class="op-unit">cm</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Altura do piso (cm)</label>
          <div class="op-input-wrap">
            <input class="form-input op-num" id="inst-height" inputmode="decimal" type="text"
              value="${defH}" placeholder="${entry.defaultHeight != null ? 'padrão: '+entry.defaultHeight : '—'}">
            <span class="op-unit">cm</span>
          </div>
        </div>
      `;
      const footer = document.getElementById('install-footer');
      if (footer) footer.style.display = '';
      syncFloor(type, pl.initDistX, pl.initDistY);
    };

    if (!panel) return;

    panel.addEventListener('input', e => {
      if ((e.target.id === 'inst-distX' || e.target.id === 'inst-distY') && selectedType) {
        const dx = document.getElementById('inst-distX')?.value || '0';
        const dy = document.getElementById('inst-distY')?.value || '0';
        syncFloor(selectedType, dx, dy);
      }
    });

    panel.addEventListener('pointerup', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.stopPropagation();
      if (btn.id === 'op-x')    { closeForm(); return; }
      if (btn.id === 'inst-back') {
        selectedType = null;
        this._installPreview = null;
        document.getElementById('install-body').innerHTML = sectionsHtml;
        const f = document.getElementById('install-footer');
        if (f) f.style.display = 'none';
        this._draw();
        return;
      }
      if (btn.classList.contains('install-btn')) { showStep2Floor(btn.dataset.type); return; }
      if (btn.id === 'inst-confirm') {
        if (!selectedType || !this._installPreview) { Toast.show('Selecione o tipo', 'error'); return; }
        const ip = this._installPreview;
        const inst = createInstallation(selectedType, ip.x, ip.y, this.project.canvas);
        const hEl  = panel.querySelector('#inst-height');
        const hVal = parseLocaleFloatOrNull(hEl?.value || '');
        inst.height = hVal !== null ? Math.round(hVal) : inst.height;
        // Salvar referências de parede X e Y para documentação
        inst.wallId = pl.wallV?.id ?? pl.wallH?.id ?? null;
        inst.wallT  = null; // ponto de piso não tem T
        this._pushHistory();
        this.project.canvas.installations.push(inst);
        clearPreview();
        this._closeSidePanel();
        this._scheduleSave();
        this._draw();
        Toast.show(`${getInstallEntry(selectedType)?.label || selectedType} inserido no piso`, 'success');
      }
    });
  },

  _drawInstallPreview(ctx) {
    const p = this._installPreview;
    if (!p) return;
    const entry = getInstallEntry(p.type);
    const color = entry ? entry.color : '#5B9BD5';
    const r = 180;
    ctx.strokeStyle = color;
    ctx.fillStyle   = 'rgba(26,24,20,0.65)';
    ctx.lineWidth   = 2.5 / this.zoom;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const code = this._instCode(p.type);
    const fs   = 13 / this.zoom;
    ctx.font      = `700 ${fs}px Inter,sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, p.x, p.y);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  },

  // Formulário de instalação no painel lateral.
  // Passo 1: grade de tipos. Passo 2: distância do canto + altura.
  _openInstallForm(wall, wallT) {
    const available  = getAvailableInstallTypes(this.project);
    const wallLen    = dist(wall.x1, wall.y1, wall.x2, wall.y2);
    const catLabel   = cat => ({ eletrica:'Elétrica', hidraulica:'Hidráulica / Gás', odonto:'Odontológico', restaurante:'Restaurante' }[cat] || cat);
    const catCss     = cat => ({ eletrica:'electric', hidraulica:'hydro', odonto:'odonto', restaurante:'restaurante' }[cat] || 'electric');

    const byCategory = {};
    for (const e of available) {
      if (!byCategory[e.category]) byCategory[e.category] = [];
      byCategory[e.category].push(e);
    }

    // Passo 1: selecionar tipo
    const sectionsHtml = Object.entries(byCategory).map(([cat, entries]) => `
      <div class="modal-section">${catLabel(cat)}</div>
      <div class="install-grid">
        ${entries.map(e => `<button class="install-btn ${catCss(cat)}" data-type="${e.id}">${esc(e.label)}</button>`).join('')}
      </div>`).join('');

    const panel = this._openSidePanel(`
      <div class="op-header">
        <span class="op-title">Inserir instalação</span>
        <button class="op-close" id="op-x">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="op-ref-hint">
        <span class="op-ref-dot" style="background:#5B9BD5;"></span>
        Ponto azul na planta = posição atual
      </div>
      <div class="op-body" id="install-body">
        ${sectionsHtml}
      </div>
      <div class="op-footer" id="install-footer" style="display:none;">
        <button class="btn-ghost" id="inst-back" style="font-size:11px;">← Tipos</button>
        <button class="btn-primary" id="inst-confirm" style="flex:1;">Inserir</button>
      </div>
    `);

    let selectedType = null;
    // nearStart: true = referência no canto x1/y1, false = canto x2/y2
    let nearStart = this._placingInstall?.nearStart !== false; // default: canto mais próximo
    let fromEnd   = nearStart ? 'start' : 'end';

    const clearPreview = () => { this._installPreview = null; this._placingInstall = null; };
    const closeForm    = () => { clearPreview(); this._closeSidePanel(); this._draw(); };

    // Atualiza posição do ponto de referência (canto azul) e do preview da instalação
    const updateCornerRef = () => {
      const refX = nearStart ? wall.x1 : wall.x2;
      const refY = nearStart ? wall.y1 : wall.y2;
      if (this._placingInstall) {
        this._placingInstall.refX = refX;
        this._placingInstall.refY = refY;
        this._placingInstall.nearStart = nearStart;
      }
    };
    updateCornerRef(); // aplicar imediatamente

    const syncPreview = (type, distCm) => {
      if (!type) return;
      const dMm      = parseLocaleFloat(String(distCm)) * 10;
      const t        = fromEnd === 'start' ? dMm / wallLen : (wallLen - dMm) / wallLen;
      const tClamped = Math.max(0, Math.min(1, t));
      const px       = wall.x1 + (wall.x2 - wall.x1) * tClamped;
      const py       = wall.y1 + (wall.y2 - wall.y1) * tClamped;

      // _installPreview = posição da instalação (muda com a distância)
      this._installPreview = { x: px, y: py, type };

      // _placingInstall.wallT é atualizado mas refX/refY MANTÉM o canto fixo
      // (o ponto azul deve ficar no canto, não seguir a instalação)
      if (this._placingInstall) {
        this._placingInstall.wallT = tClamped;
        // refX/refY já estão no canto correto via updateCornerRef() — não sobrescrever
      }
      this._draw();
    };

    // Passo 2: ao selecionar o tipo, mostrar distância + altura
    const showStep2 = (type) => {
      selectedType = type;
      const entry    = getInstallEntry(type) || { label: type, defaultHeight: null };
      const defH     = entry.defaultHeight != null ? String(entry.defaultHeight) : '';
      // Distância inicial = do canto de referência até onde o dedo soltou
      const distCm   = this._placingInstall?.initDistCm ?? Math.round(wallT * wallLen / 10);

      document.getElementById('install-body').innerHTML = `
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:12px;">${esc(entry.label)}</div>
        <div class="form-group">
          <label class="form-label">Distância do canto até o ponto (cm)</label>
          <div class="op-input-wrap">
            <input class="form-input op-num" id="inst-dist" inputmode="decimal" type="text" value="${distCm}">
            <span class="op-unit">cm</span>
          </div>
        </div>
        <button type="button" class="op-flip" id="inst-flip">⇄ Medir a partir do outro canto</button>
        <div class="form-group">
          <label class="form-label">Altura do piso (cm)</label>
          <div class="op-input-wrap">
            <input class="form-input op-num" id="inst-height" inputmode="decimal" type="text"
              value="${defH}" placeholder="${entry.defaultHeight != null ? 'padrão: ' + entry.defaultHeight : '—'}">
            <span class="op-unit">cm</span>
          </div>
        </div>
      `;
      const footer = document.getElementById('install-footer');
      if (footer) footer.style.display = '';

      syncPreview(type, distCm);

      // Listeners do passo 2 via event delegation no painel
    };

    if (!panel) return;

    panel.addEventListener('pointerup', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.stopPropagation();

      if (btn.id === 'op-x')    { closeForm(); return; }
      if (btn.id === 'inst-back') {
        // Volta para a grade de tipos
        selectedType = null;
        this._installPreview = null;
        document.getElementById('install-body').innerHTML = sectionsHtml;
        const f = document.getElementById('install-footer');
        if (f) f.style.display = 'none';
        this._draw();
        return;
      }

      if (btn.classList.contains('install-btn')) {
        showStep2(btn.dataset.type);
        return;
      }

      if (btn.id === 'inst-flip') {
        // Troca o canto de referência — ponto azul move para o outro extremo da parede
        nearStart = !nearStart;
        fromEnd   = nearStart ? 'start' : 'end';
        updateCornerRef();  // move o ponto azul para o novo canto
        const hint = panel.querySelector('.op-ref-hint');
        if (hint) hint.lastChild.textContent =
          ` Canto ${nearStart ? 'inicial' : 'final'} (azul) = referência`;
        const d = panel.querySelector('#inst-dist');
        // Recalcular distância a partir do novo canto
        if (d && selectedType) {
          const oldDmm = parseLocaleFloat(d.value) * 10;
          const newDmm = wallLen - oldDmm;
          d.value = Math.max(0, Math.round(newDmm / 10));
          syncPreview(selectedType, d.value);
        }
        this._draw();
        return;
      }

      if (btn.id === 'inst-confirm') {
        if (!selectedType) { Toast.show('Selecione o tipo', 'error'); return; }
        const dEl = panel.querySelector('#inst-dist');
        const hEl = panel.querySelector('#inst-height');
        const dMm = parseLocaleFloat((dEl?.value || '0')) * 10;
        const t   = fromEnd === 'start' ? dMm / wallLen : (wallLen - dMm) / wallLen;
        const tC  = Math.max(0, Math.min(1, t));
        const px  = wall.x1 + (wall.x2 - wall.x1) * tC;
        const py  = wall.y1 + (wall.y2 - wall.y1) * tC;

        const inst = createInstallation(selectedType, px, py, this.project.canvas);
        inst.wallId = wall.id;
        inst.wallT  = tC;
        const hVal  = parseLocaleFloatOrNull(hEl?.value || '');
        inst.height = hVal !== null ? Math.round(hVal) : inst.height;

        this._pushHistory();
        this.project.canvas.installations.push(inst);
        clearPreview();
        this._closeSidePanel();
        this._scheduleSave();
        this._draw();
        const entry = getInstallEntry(selectedType);
        Toast.show(`${entry ? entry.label : selectedType} inserido`, 'success');
        return;
      }
    });

    // Input sync para prévia ao vivo
    panel.addEventListener('input', e => {
      if (e.target.id === 'inst-dist' && selectedType) {
        syncPreview(selectedType, e.target.value);
      }
    });

  },

  // Formulário de porta/janela no painel lateral.
  // Canvas permanece visível → prévia ao vivo e ponto verde aparecem na planta.
  _openOpeningForm(type, wall, position) {
    const isDoor  = type === 'door';
    const cm      = mm => Math.round(mm / 10);
    const wallLen = dist(wall.x1, wall.y1, wall.x2, wall.y2);

    const data = isDoor
      ? { width: 800,  height: 2100, hingeSide: 'right', openDir: 'in' }
      : { width: 1200, height: 1000, sill: 1000 };
    data.fromEnd = 'start';
    const centerMm = Math.max(0, Math.min(wallLen, position * wallLen));
    // Offset para face interna da parede: a distância exibida parte da face ACABADA,
    // não do eixo. Diferença = espessura/2 (ex: parede 15cm → offset 7,5cm).
    const faceOffset = (wall.thickness || 150) / 2;
    data.distCm = Math.max(0, Math.round((centerMm - data.width / 2 - faceOffset) / 10));

    const numField = (key, label, val) => `
      <div class="form-group">
        <label class="form-label">${label}</label>
        <div class="op-input-wrap">
          <input class="form-input op-num" id="op-${key}" inputmode="numeric" type="text"
            value="${val}" style="-webkit-user-select:text;user-select:text;">
          <span class="op-unit">cm</span>
        </div>
      </div>`;

    const seg = (name, opts) => `
      <div class="op-seg" data-seg="${name}">
        ${opts.map(o => `<button type="button" data-val="${o.v}" class="${o.v === data[name] ? 'active' : ''}">${o.t}</button>`).join('')}
      </div>`;

    const panelEl = this._openSidePanel(`
      <div class="op-header">
        <span class="op-title">${isDoor ? 'Nova porta' : 'Nova janela'}</span>
        <button class="op-close" id="op-x">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="op-ref-hint">
        <span class="op-ref-dot"></span>
        Canto verde na planta = referência das medidas
      </div>
      <div class="op-body">
        ${numField('width', 'Largura (vão)', cm(data.width))}
        ${numField('dist',  'Distância do canto até o vão', data.distCm)}
        <button type="button" class="op-flip" id="op-flip">⇄ Medir a partir do outro canto</button>
        ${numField('height', 'Altura', cm(data.height))}
        ${!isDoor ? numField('sill', 'Peitoril (piso até a janela)', cm(data.sill)) : ''}
        ${isDoor ? `
          <div class="form-group">
            <label class="form-label">Lado da dobradiça</label>
            ${seg('hingeSide', [{ v: 'left', t: 'Esquerda' }, { v: 'right', t: 'Direita' }])}
          </div>
          <div class="form-group">
            <label class="form-label">Abre para</label>
            ${seg('openDir', [{ v: 'in', t: 'Dentro' }, { v: 'out', t: 'Fora' }])}
          </div>` : ''}
      </div>
      <div class="op-footer">
        <button class="btn-ghost" id="op-cancel">Cancelar</button>
        <button class="btn-primary" id="op-save" style="flex:1;">${isDoor ? 'Inserir porta' : 'Inserir janela'}</button>
      </div>
    `);

    const readCm = id => {
      const v = parseLocaleFloat((document.getElementById(id)?.value || ''));
      return isNaN(v) ? 0 : Math.round(v * 10);
    };

    const computePosition = () => {
      const width = readCm('op-width') || 1;
      const distM = readCm('op-dist');
      // Somar faceOffset: o usuário digita da face acabada, não do eixo
      const faceMm = (wall.thickness || 150) / 2;
      let centerFromStart = (data.fromEnd === 'start')
        ? distM + width / 2 + faceMm
        : wallLen - (distM + width / 2 + faceMm);
      const minC = width / 2, maxC = wallLen - width / 2;
      centerFromStart = Math.max(minC, Math.min(maxC, centerFromStart));
      return wallLen > 0 ? centerFromStart / wallLen : 0.5;
    };

    const sync = () => {
      const pos = computePosition();
      this._openingPreview = {
        type, wallId: wall.id, position: pos,
        width: readCm('op-width') || 1,
        height: readCm('op-height') || null,
        sill: isDoor ? null : readCm('op-sill'),
        hingeSide: data.hingeSide, openDir: data.openDir, side: data.hingeSide,
      };
      const ref = data.fromEnd === 'start' ? { x: wall.x1, y: wall.y1 } : { x: wall.x2, y: wall.y2 };
      this._placingOpening = { wallId: wall.id, refX: ref.x, refY: ref.y };
      this._draw();
    };

    sync();  // prévia inicial — ponto verde aparece na planta imediatamente

    const clearPreview = () => { this._openingPreview = null; this._placingOpening = null; };
    const closeForm    = () => { clearPreview(); this._closeSidePanel(); this._draw(); };

    const saveOpening = () => {
      const width = readCm('op-width');
      if (!width || width <= 0) { Toast.show('Informe a largura', 'error'); return; }
      const opening = {
        id: generateId(), type, wallId: wall.id, position: computePosition(),
        width, height: readCm('op-height') || null,
      };
      if (isDoor) {
        opening.hingeSide = data.hingeSide;
        opening.openDir   = data.openDir;
        opening.side      = data.hingeSide;
      } else {
        opening.sill = readCm('op-sill') || null;
        opening.side = 'right';
      }
      this._pushHistory();
      this.project.canvas.openings.push(opening);
      clearPreview();
      this._closeSidePanel();
      this._scheduleSave();
      this._draw();
      Toast.show(isDoor ? 'Porta inserida' : 'Janela inserida', 'success');
    };

    // Usa panelEl (referência direta do _openSidePanel) — nunca getElementById
    const panel = panelEl;
    if (!panel) return;

    ['op-width', 'op-dist', 'op-height', 'op-sill'].forEach(id => {
      panel.querySelector(`#${id}`)?.addEventListener('input', sync);
    });

    panel.addEventListener('pointerup', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.stopPropagation();

      const id  = btn.id;
      const seg = btn.closest('.op-seg');

      if (id === 'op-x' || id === 'op-cancel') { closeForm(); return; }
      if (id === 'op-save')                     { saveOpening(); return; }
      if (id === 'op-flip') {
        data.fromEnd = data.fromEnd === 'start' ? 'end' : 'start';
        const hint = panel.querySelector('.op-ref-hint');
        if (hint) hint.lastChild.textContent =
          ` Canto ${data.fromEnd === 'start' ? 'inicial' : 'final'} (verde) = referência`;
        sync();
        return;
      }
      if (seg) {
        seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        data[seg.dataset.seg] = btn.dataset.val;
        sync();
      }
    });
  },

  _clickInstall(world) {
    this._showInstallModal(world);
  },

  _clickPhoto(world) {
    const input = document.getElementById('photo-input');
    const onchange = () => {
      const file = input.files[0];
      input.removeEventListener('change', onchange);
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async ev => {
        const seq = this.project.canvas.photoPins.length + 1;
        this._pushHistory();
        this.project.canvas.photoPins.push({
          id: generateId(), x: world.x, y: world.y,
          photoData: ev.target.result, sequenceNumber: seq,
          annotations: [], caption: '',
        });
        this._draw();
        // Salvar imediatamente no IndexedDB — não aguarda o debounce de 2s.
        // Se o tablet morrer logo após a captura, a foto já está persistida.
        await this._saveNow();
        Toast.show(`Foto F${seq} adicionada`, 'success');
      };
      reader.readAsDataURL(file);
    };
    input.value = '';
    input.addEventListener('change', onchange);
    input.click();
  },

  _clickNote(world) {
    Modal.open(`
      <div class="modal-header">
        <h2 class="modal-title">Nova nota</h2>
        <button class="modal-close" id="mc">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <textarea id="note-text" class="form-input"
          rows="3" placeholder="Ex: Verificar saída de água existente"
          style="resize:none; -webkit-user-select:text; user-select:text;"
          autofocus></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="mc-cancel">Cancelar</button>
        <button class="btn-primary" id="mc-save">Salvar nota</button>
      </div>
    `);
    setTimeout(() => document.getElementById('note-text')?.focus(), 80);
    document.getElementById('mc').addEventListener('click', () => Modal.close());
    document.getElementById('mc-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('mc-save').addEventListener('click', () => {
      const text = (document.getElementById('note-text')?.value || '').trim();
      if (!text) return;
      this._pushHistory();
      this.project.canvas.notes.push({ id: generateId(), x: world.x, y: world.y, text });
      this._scheduleSave();
      this._draw();
      Modal.close();
    });
  },

  // ── Install modal ─────────────────────────

  _showInstallModal(world) {
    // Lê tipos disponíveis da INSTALLATION_LIBRARY (inclui packs ativos do projeto)
    const available = getAvailableInstallTypes(this.project);

    // Agrupa por categoria
    const byCategory = {};
    for (const entry of available) {
      if (!byCategory[entry.category]) byCategory[entry.category] = [];
      byCategory[entry.category].push(entry);
    }

    const catLabel = (cat) => ({
      eletrica: 'Elétrica', hidraulica: 'Hidráulica / Gás',
      odonto: 'Odontológico', restaurante: 'Restaurante',
    }[cat] || cat);

    const catCss = (cat) => ({
      eletrica: 'electric', hidraulica: 'hydro',
      odonto: 'odonto', restaurante: 'restaurante',
    }[cat] || 'electric');

    const sectionsHtml = Object.entries(byCategory).map(([cat, entries]) => `
      <div class="modal-section">${catLabel(cat)}</div>
      <div class="install-grid">
        ${entries.map(e => {
          const heightHint = e.defaultHeight != null ? ` <small>(${e.defaultHeight}cm)</small>` : '';
          return `<button class="install-btn ${catCss(cat)}" data-type="${e.id}">${esc(e.label)}${heightHint}</button>`;
        }).join('')}
      </div>
    `).join('');

    Modal.open(`
      <div class="modal-header">
        <h2 class="modal-title">Inserir instalação</h2>
        <button class="modal-close" id="mc">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      ${sectionsHtml}
      <div class="modal-footer">
        <button class="btn-ghost" id="mc-cancel">Cancelar</button>
      </div>
    `);

    document.getElementById('mc').addEventListener('click', () => Modal.close());
    document.getElementById('mc-cancel').addEventListener('click', () => Modal.close());

    document.querySelectorAll('.install-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type  = btn.dataset.type;
        const entry = getInstallEntry(type);
        const label = entry ? entry.label : type;

        // C-05 step 2: mostrar mini-form de altura após escolha do tipo
        // A altura padrão da biblioteca já está sugerida — 1 toque para confirmar.
        const defaultH = entry ? entry.defaultHeight : null;
        const hDisplay = defaultH != null ? String(defaultH) : '';

        Modal.open(`
          <div class="modal-header">
            <h2 class="modal-title" style="font-size:14px;">${esc(label)}</h2>
            <button class="modal-close" id="mc2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Altura do piso <span style="color:var(--text-faint)">(cm)</span></label>
              <input class="form-input" id="inst-height" inputmode="decimal" type="text"
                value="${hDisplay}" placeholder="${defaultH != null ? defaultH : '—'}"
                style="-webkit-user-select:text;user-select:text;font-size:20px;padding:14px;text-align:center;">
            </div>
          </div>
          <div class="modal-footer" style="gap:8px;">
            <button class="btn-ghost" id="inst-skip" style="font-size:11px;">Inserir sem altura</button>
            <button class="btn-primary" id="inst-ok" style="flex:1;">Inserir</button>
          </div>
        `);
        setTimeout(() => document.getElementById('inst-height')?.select(), 60);

        const doInsert = (height) => {
          Modal.close();
          const inst = createInstallation(type, world.x, world.y, this.project.canvas);
          inst.height = height;
          this._pushHistory();
          this.project.canvas.installations.push(inst);
          this._scheduleSave();
          this._draw();
          const hMsg = inst.height != null ? ` · h=${inst.height}cm` : '';
          Toast.show(`${label}${hMsg} inserido`, 'success', 2500);
        };

        document.getElementById('mc2').addEventListener('click', () => Modal.close());
        document.getElementById('inst-skip').addEventListener('click', () => doInsert(null));
        document.getElementById('inst-ok').addEventListener('click', () => {
          const v = parseLocaleFloatOrNull(document.getElementById('inst-height')?.value);
          doInsert(v !== null ? Math.round(v) : defaultH);
        });
        // Enter confirma
        document.getElementById('inst-height')?.addEventListener('keydown', e => {
          if (e.key === 'Enter') document.getElementById('inst-ok')?.click();
        });
      });
    });
  },

  // ── Properties panel ─────────────────────

  _showProps(elem, type) {
    const panel = document.getElementById('props-content');
    if (!panel) return;

    if (!elem) {
      const bg = this.project.canvas.backgroundImage;
      const bgControls = bg ? `
        <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border);">
          <div class="sidebar-section-title">Imagem de fundo</div>
          <div class="prop-row">
            <div class="prop-label">Opacidade</div>
            <input type="range" id="bg-opacity" min="0.05" max="0.9" step="0.05"
              value="${bg.opacity != null ? bg.opacity : 0.3}"
              style="width:100%;accent-color:var(--accent);">
          </div>
          <button class="btn-danger-solid" id="bg-remove"
            style="width:100%;font-size:11px;padding:7px;margin-top:4px;">Remover fundo</button>
        </div>` : '';
      panel.innerHTML = `
        <span style="color:var(--text-faint);font-size:11px;">Toque num elemento para ver propriedades.</span>
        ${bgControls}
      `;
      if (bg) {
        document.getElementById('bg-opacity').addEventListener('input', e => {
          this.project.canvas.backgroundImage.opacity = parseFloat(e.target.value);
          this._draw();
        });
        document.getElementById('bg-opacity').addEventListener('change', () => this._scheduleSave());
        document.getElementById('bg-remove').addEventListener('click', () => {
          this.project.canvas.backgroundImage = null;
          this._bgImg = null;
          const btn = document.getElementById('btn-calib');
          if (btn) btn.style.display = 'none';
          this._scheduleSave();
          this._showProps(null);
          this._draw();
        });
      }
      return;
    }

    if (type === 'wall') {
      const len = Math.round(dist(elem.x1, elem.y1, elem.x2, elem.y2));
      const cm  = mm => Math.round(mm / 10);
      panel.innerHTML = `
        <div class="sidebar-section-title">Parede</div>
        <div class="prop-row">
          <div class="prop-label">Comprimento</div>
          <input class="prop-input" id="prop-len" type="text" value="${len >= 1000 ? (len / 1000).toFixed(3) : len}" readonly
            style="opacity:0.55;cursor:default;" title="Comprimento calculado automaticamente">
        </div>
        <div class="prop-row">
          <div class="prop-label">Espessura (mm)</div>
          <input class="prop-input" id="prop-thick" type="number" value="${elem.thickness || 150}" min="50" max="600">
        </div>
        <details style="margin-top:10px;">
          <summary style="font-size:10px;color:var(--text-faint);cursor:pointer;letter-spacing:.07em;text-transform:uppercase;">
            Posição avançada
          </summary>
          <div class="prop-row" style="margin-top:8px;">
            <div class="prop-label">Início X (cm)</div>
            <input class="prop-input" id="prop-x1" type="number" value="${cm(elem.x1)}">
          </div>
          <div class="prop-row">
            <div class="prop-label">Início Y (cm)</div>
            <input class="prop-input" id="prop-y1" type="number" value="${cm(elem.y1)}">
          </div>
          <div class="prop-row">
            <div class="prop-label">Fim X (cm)</div>
            <input class="prop-input" id="prop-x2" type="number" value="${cm(elem.x2)}">
          </div>
          <div class="prop-row">
            <div class="prop-label">Fim Y (cm)</div>
            <input class="prop-input" id="prop-y2" type="number" value="${cm(elem.y2)}">
          </div>
        </details>
        <div style="margin-top:8px;">
          <button class="btn-danger-solid" id="prop-delete" style="width:100%; font-size:11px; padding:7px;">Excluir parede</button>
        </div>
      `;
      const findW = () => this.project.canvas.walls.find(w => w.id === elem.id);
      document.getElementById('prop-thick').addEventListener('change', e => {
        const w = findW();
        if (w) { w.thickness = parseInt(e.target.value) || 150; this._scheduleSave(); this._draw(); }
      });
      // C-13: campos de posição — editáveis para correção de coordenadas (cm → mm)
      ['x1','y1','x2','y2'].forEach(k => {
        const el = document.getElementById('prop-' + k);
        if (el) el.addEventListener('change', e => {
          const w = findW();
          if (w) { const v = parseLocaleFloat(e.target.value); w[k] = Math.round(v * 10); this._scheduleSave(); this._draw(); }
        });
      });
      document.getElementById('prop-delete').addEventListener('click', () => this._deleteSelected());
    }

    if (type === 'opening') {
      const isDoor = elem.type === 'door';
      const cm = mm => (mm != null ? Math.round(mm / 10) : '');
      // Calcular distância do canto para exibição (C-04)
      const wall = this.project.canvas.walls.find(w => w.id === elem.wallId);
      const wallLen = wall ? dist(wall.x1, wall.y1, wall.x2, wall.y2) : 0;
      const halfW      = (elem.width || 0) / 2;
      const faceOffset = (wall ? (wall.thickness || 150) : 150) / 2;
      const distFromStart = Math.max(0, Math.round((elem.position * wallLen - halfW - faceOffset) / 10));
      const distFromEnd   = Math.max(0, Math.round((wallLen - elem.position * wallLen - halfW - faceOffset) / 10));
      const showFromEnd = elem.side === 'right' || elem.side === 'left';
      // Mostra distância da face acabada (subtrai faceOffset = espessura/2)
      const distCm = Math.min(distFromStart, distFromEnd);
      const isFromEnd = distFromEnd < distFromStart;

      panel.innerHTML = `
        <div class="sidebar-section-title">${isDoor ? 'Porta' : 'Janela'}</div>
        <div class="prop-row">
          <div class="prop-label">Largura (cm)</div>
          <input class="prop-input" id="prop-opw" type="number" value="${cm(elem.width)}">
        </div>
        <div class="prop-row">
          <div class="prop-label" title="Distância do canto mais próximo até a borda do vão">Dist. do canto (cm)</div>
          <input class="prop-input" id="prop-opdist" type="number" value="${distCm}" min="0">
        </div>
        <div class="prop-row">
          <div class="prop-label">Altura (cm)</div>
          <input class="prop-input" id="prop-oph" type="number" value="${cm(elem.height)}">
        </div>
        ${!isDoor ? `
        <div class="prop-row">
          <div class="prop-label">Peitoril (cm)</div>
          <input class="prop-input" id="prop-ops" type="number" value="${cm(elem.sill)}">
        </div>` : ''}
        ${isDoor ? `
        <div class="prop-row">
          <div class="prop-label">Dobradiça</div>
          <div class="op-seg" data-seg="hingeSide">
            <button type="button" data-val="left"  class="${elem.hingeSide === 'left' ? 'active' : ''}">Esq</button>
            <button type="button" data-val="right" class="${elem.hingeSide !== 'left' ? 'active' : ''}">Dir</button>
          </div>
        </div>
        <div class="prop-row">
          <div class="prop-label">Abre para</div>
          <div class="op-seg" data-seg="openDir">
            <button type="button" data-val="in"  class="${elem.openDir !== 'out' ? 'active' : ''}">Dentro</button>
            <button type="button" data-val="out" class="${elem.openDir === 'out' ? 'active' : ''}">Fora</button>
          </div>
        </div>` : ''}
        <div style="margin-top:8px;">
          <button class="btn-danger-solid" id="prop-delete" style="width:100%;font-size:11px;padding:7px;">Excluir ${isDoor ? 'porta' : 'janela'}</button>
        </div>
      `;
      const findO = () => this.project.canvas.openings.find(o => o.id === elem.id);
      const bindNum = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', e => {
          const o = findO();
          if (o) { const v = parseFloat(e.target.value); o[key] = isNaN(v) ? null : Math.round(v * 10); this._scheduleSave(); this._draw(); }
        });
      };
      bindNum('prop-opw', 'width');
      bindNum('prop-oph', 'height');
      if (!isDoor) bindNum('prop-ops', 'sill');
      // Listener para distância do canto — C-04
      const distEl = document.getElementById('prop-opdist');
      if (distEl && wall) {
        distEl.addEventListener('change', e => {
          const o = findO();
          if (!o) return;
          const w2 = this.project.canvas.walls.find(w => w.id === o.wallId);
          if (!w2) return;
          const wl  = dist(w2.x1, w2.y1, w2.x2, w2.y2);
          const hw  = (o.width || 0) / 2;
          const fo  = (w2.thickness || 150) / 2; // faceOffset — usuário digita da face acabada
          const dMm = parseLocaleFloat(e.target.value) * 10;
          // Calcular nova posição: distância da face acabada → somar faceOffset para obter centro do eixo
          let pos;
          if (isFromEnd) {
            pos = (wl - dMm - hw - fo) / wl;
          } else {
            pos = (dMm + hw + fo) / wl;
          }
          o.position = Math.max(hw / wl, Math.min(1 - hw / wl, pos));
          this._scheduleSave();
          this._draw();
        });
      }
      panel.querySelectorAll('.op-seg').forEach(segEl =>
        segEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
          segEl.querySelectorAll('button').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          const o = findO();
          if (o) {
            o[segEl.dataset.seg] = b.dataset.val;
            if (segEl.dataset.seg === 'hingeSide') o.side = b.dataset.val;
            this._scheduleSave(); this._draw();
          }
        })));
      document.getElementById('prop-delete').addEventListener('click', () => this._deleteSelected());
    }

    if (type === 'install') {
      // getInstallEntry safety — nunca null quando o código usa .color, .label, etc.
      const instEntry  = getInstallEntry(elem.type) || { label: elem.type, defaultHeight: null, color: '#C9A84C' };
      // Backfill: se height é null, mostrar default da biblioteca como placeholder
      const hVal       = elem.height != null ? String(elem.height) : '';
      const hPlaceholder = instEntry.defaultHeight != null ? `padrão: ${instEntry.defaultHeight}` : 'não definida';

      panel.innerHTML = `
        <div class="sidebar-section-title">${esc(instEntry.label)}</div>
        <div class="prop-row">
          <div class="prop-label">Altura do piso (cm)</div>
          <input class="prop-input" id="prop-height" inputmode="decimal" type="text"
            value="${esc(hVal)}" placeholder="${esc(hPlaceholder)}">
        </div>
        <div class="prop-row">
          <div class="prop-label">Observação</div>
          <input class="prop-input" id="prop-obs" type="text" value="${esc(elem.observation || '')}" placeholder="Opcional">
        </div>
        <div style="margin-top:8px;">
          <button class="btn-danger-solid" id="prop-delete" style="width:100%; font-size:11px; padding:7px;">Excluir</button>
        </div>
      `;
      document.getElementById('prop-height').addEventListener('change', e => {
        const inst = this.project.canvas.installations.find(i => i.id === elem.id);
        if (inst) {
          const v = parseLocaleFloatOrNull(e.target.value);
          inst.height = v !== null ? Math.round(v) : null;
          this._scheduleSave();
          this._draw();
        }
      });
      document.getElementById('prop-obs').addEventListener('change', e => {
        const inst = this.project.canvas.installations.find(i => i.id === elem.id);
        if (inst) { inst.observation = e.target.value; this._scheduleSave(); }
      });
      document.getElementById('prop-delete').addEventListener('click', () => this._deleteSelected());
    }

    if (type === 'dim') {
      const len = Math.round(dist(elem.x1, elem.y1, elem.x2, elem.y2));
      panel.innerHTML = `
        <div class="sidebar-section-title">Cota</div>
        <div class="prop-row">
          <div class="prop-label">Medida (mm) — deixe vazio para automático</div>
          <input class="prop-input" id="prop-dimval" type="number" value="${elem.value != null ? elem.value : ''}" placeholder="${len}">
        </div>
        <div style="margin-top:8px;">
          <button class="btn-danger-solid" id="prop-delete" style="width:100%; font-size:11px; padding:7px;">Excluir cota</button>
        </div>
      `;
      document.getElementById('prop-dimval').addEventListener('change', e => {
        const d = this.project.canvas.dimensions.find(d => d.id === elem.id);
        if (d) { d.value = e.target.value ? parseInt(e.target.value) : null; this._scheduleSave(); this._draw(); }
      });
      document.getElementById('prop-delete').addEventListener('click', () => this._deleteSelected());
    }

    if (type === 'photo') {
      const thumb = elem.photoData
        ? `<img src="${esc(elem.photoData)}" style="width:100%;border-radius:4px;object-fit:cover;max-height:110px;display:block;margin-bottom:10px;">`
        : '';
      const anns = (elem.annotations || []).length;
      panel.innerHTML = `
        <div class="sidebar-section-title">Foto F${elem.sequenceNumber}</div>
        ${thumb}
        ${anns > 0 ? `<div style="font-size:10px;color:var(--text-faint);margin-bottom:10px;">${anns} anotaç${anns === 1 ? 'ão' : 'ões'}</div>` : ''}
        <div style="margin-bottom:8px;">
          <button class="btn-primary" id="prop-annotate" style="width:100%;font-size:11px;padding:7px;justify-content:center;">
            ✏ Anotar foto
          </button>
        </div>
        <div>
          <button class="btn-danger-solid" id="prop-delete" style="width:100%;font-size:11px;padding:7px;">Excluir foto</button>
        </div>
      `;
      document.getElementById('prop-annotate').addEventListener('click', async () => {
        await this._saveNow();   // garante save antes de sair do editor
        this.destroy();
        PhotoAnnotator.open(this.project.id, elem.id);
      });
      document.getElementById('prop-delete').addEventListener('click', () => this._deleteSelected());
    }

    if (type === 'note') {
      panel.innerHTML = `
        <div class="sidebar-section-title">Nota</div>
        <div class="prop-row">
          <div class="prop-label">Texto</div>
          <textarea class="prop-input" id="prop-notetext" rows="3" style="resize:none;-webkit-user-select:text;user-select:text;">${esc(elem.text || '')}</textarea>
        </div>
        <div>
          <button class="btn-danger-solid" id="prop-delete" style="width:100%;font-size:11px;padding:7px;">Excluir nota</button>
        </div>
      `;
      document.getElementById('prop-notetext').addEventListener('change', e => {
        const n = this.project.canvas.notes.find(n => n.id === elem.id);
        if (n) { n.text = e.target.value; this._scheduleSave(); this._draw(); }
      });
      document.getElementById('prop-delete').addEventListener('click', () => this._deleteSelected());
    }

    if (type === 'environment') {
      const areaM2 = elem.area != null ? (elem.area / 1e6).toFixed(2) : '—';
      panel.innerHTML = `
        <div class="sidebar-section-title">Ambiente</div>
        <div class="prop-row">
          <div class="prop-label">Nome</div>
          <input class="prop-input" id="prop-envname" type="text" value="${esc(elem.name || '')}"
            style="-webkit-user-select:text;user-select:text;">
        </div>
        <div class="prop-row">
          <div class="prop-label">Área calculada</div>
          <input class="prop-input" type="text" value="${areaM2} m²" readonly>
        </div>
        <div class="prop-row">
          <div class="prop-label">Pé-direito (m)</div>
          <input class="prop-input" id="prop-pedireito" type="text" inputmode="decimal"
            value="${elem.peDireito || ''}" placeholder="Ex: 2,80"
            style="-webkit-user-select:text;user-select:text;">
        </div>
        <div class="prop-row">
          <div class="prop-label">Observação</div>
          <input class="prop-input" id="prop-envobs" type="text"
            value="${esc(elem.observation || '')}" placeholder="Opcional"
            style="-webkit-user-select:text;user-select:text;">
        </div>
        <div style="margin-top:8px;">
          <button class="btn-danger-solid" id="prop-delete" style="width:100%;font-size:11px;padding:7px;">Excluir ambiente</button>
        </div>
      `;
      document.getElementById('prop-envname').addEventListener('change', e => {
        const env = this.project.canvas.environments.find(v => v.id === elem.id);
        if (env) { env.name = e.target.value; this._scheduleSave(); this._draw(); }
      });
      document.getElementById('prop-pedireito').addEventListener('change', e => {
        const env = this.project.canvas.environments.find(v => v.id === elem.id);
        if (env) { env.peDireito = parseLocaleFloat(e.target.value) || null; this._scheduleSave(); this._draw(); }
      });
      document.getElementById('prop-envobs').addEventListener('change', e => {
        const env = this.project.canvas.environments.find(v => v.id === elem.id);
        if (env) { env.observation = e.target.value; this._scheduleSave(); }
      });
      document.getElementById('prop-delete').addEventListener('click', () => this._deleteSelected());
    }
  },

  _deleteSelected() {
    if (!this.selected) return;
    this._pushHistory();
    const id = this.selected.id;
    const c  = this.project.canvas;
    const wasWall = this.selected.type === 'wall';
    c.walls         = c.walls.filter(w => w.id !== id);
    c.dimensions    = c.dimensions.filter(d => d.id !== id);
    c.installations = c.installations.filter(i => i.id !== id);
    c.photoPins     = c.photoPins.filter(p => p.id !== id);
    c.notes         = c.notes.filter(n => n.id !== id);
    c.openings      = c.openings.filter(o => o.id !== id);
    c.environments  = c.environments.filter(e => e.id !== id);
    // Remove aberturas que ficaram sem parede
    if (wasWall) c.openings = c.openings.filter(o => o.wallId !== id);
    this.selected   = null;
    this._showProps(null);
    this._scheduleSave();
    this._draw();
  },

  // ── Editar comprimento da parede ──────────

  _editWallLength(w) {
    const dx  = w.x2 - w.x1, dy = w.y2 - w.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (!len) return;
    const current = (len / 1000).toFixed(2).replace('.', ',');
    this._numpad({
      title: 'Comprimento da parede (m)',
      hint:  'O endpoint final será ajustado',
      value: current,
      unit:  'm',
      onOk: newM => {
        const newLen = newM * 1000;
        if (newLen <= 50) { Toast.show('Mínimo 5cm', 'error'); return; }
        this._pushHistory();
        const dirX = dx / len, dirY = dy / len;
        w.x2 = w.x1 + dirX * newLen;
        w.y2 = w.y1 + dirY * newLen;
        this._scheduleSave();
        this._draw();
        Toast.show(`Parede ajustada para ${newM.toFixed(2)}m`, 'success', 1500);
      },
      onCancel: () => {},
    });
  },

  // Mostrar/ocultar barra de ações da parede selecionada
  _showSelWallActions(show) {
    const el = document.getElementById('sel-wall-actions');
    if (el) el.style.display = show ? '' : 'none';
  },

  // Atualizar HUD de dimensão durante arraste
  _updateDragDimHud() {
    const hud = document.getElementById('drag-dim-hud');
    if (!hud) return;
    if (!this._wallDrag) { hud.style.display = 'none'; return; }
    const w = this.project.canvas.walls.find(w => w.id === this._wallDrag.wallId);
    if (!w) { hud.style.display = 'none'; return; }
    const len = dist(w.x1, w.y1, w.x2, w.y2);
    hud.style.display = '';
    hud.textContent   = (len / 1000).toFixed(2) + ' m';
  },

  // ── Fit to screen ─────────────────────────

  _fitScreen() {
    const walls = this.project.canvas.walls;
    if (!walls.length) {
      this.zoom = 0.15; this.panX = this.canvas.width / 2; this.panY = this.canvas.height / 2;
      this._draw(); return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of walls) {
      minX = Math.min(minX, w.x1, w.x2); minY = Math.min(minY, w.y1, w.y2);
      maxX = Math.max(maxX, w.x1, w.x2); maxY = Math.max(maxY, w.y1, w.y2);
    }
    const pad = 80;
    const sw  = this.canvas.width  - pad * 2 - 240; // account for sidebar
    const sh  = this.canvas.height - pad * 2;
    const rw  = maxX - minX || 1000;
    const rh  = maxY - minY || 1000;
    this.zoom = Math.min(sw / rw, sh / rh, 5);
    this.panX = (this.canvas.width - 240) / 2 - (minX + rw / 2) * this.zoom;
    this.panY = this.canvas.height / 2     - (minY + rh / 2) * this.zoom;
    this._draw();
  },

  // ── Undo / Redo ──────────────────────────
  // history[0] = snapshot inicial (estado ao abrir o projeto)
  // history[historyIdx] = estado atual
  // history[historyIdx+1..] = estados "à frente" disponíveis para redo

  _pushHistory() {
    const snap = JSON.stringify(this.project.canvas);
    // Trunca o futuro ao fazer nova ação (invalida redo pendente)
    this.history = this.history.slice(0, this.historyIdx + 1);
    this.history.push(snap);
    if (this.history.length > 51) this.history.shift(); // 50 ações + snapshot inicial
    this.historyIdx = this.history.length - 1;
    this._updateUndoRedo();
  },

  _undo() {
    if (this.historyIdx <= 0) { Toast.show('Nada para desfazer', 'info'); return; }
    this.historyIdx--;
    this.project.canvas = JSON.parse(this.history[this.historyIdx]);
    this._resetWallChain();
    this._updateCancelBtn();
    this._scheduleSave();
    this._draw();
    this._updateUndoRedo();
  },

  _redo() {
    if (this.historyIdx >= this.history.length - 1) { Toast.show('Nada para refazer', 'info'); return; }
    this.historyIdx++;
    this.project.canvas = JSON.parse(this.history[this.historyIdx]);
    this._resetWallChain();
    this._updateCancelBtn();
    this._scheduleSave();
    this._draw();
    this._updateUndoRedo();
  },

  // Atualiza estado visual dos botões undo/redo
  _updateUndoRedo() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const chainActive = this._chainPts && this._chainPts.length > 0;
    if (btnUndo) {
      // Esconder btn-undo global durante cadeia de paredes (C-10)
      // para não conflitar com o botão flutuante "↶ Desfazer ponto"
      const canUndo = this.historyIdx > 0;
      btnUndo.style.display  = chainActive ? 'none' : '';
      btnUndo.style.opacity  = canUndo ? '1' : '0.35';
      btnUndo.disabled       = !canUndo;
    }
    if (btnRedo) {
      const canRedo = this.historyIdx < this.history.length - 1;
      btnRedo.style.opacity = canRedo ? '1' : '0.35';
      btnRedo.disabled      = !canRedo;
    }
  },

  // ── Keyboard ─────────────────────────────

  _initKeyboard() {
    this._keyHandler = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this._undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); this._redo(); return; }
      if (e.key === 'Escape') {
        this.drawStart  = null;
        this.envPoints  = [];
        this._scaleTool = null;
        this._chainPts  = null;
        this._aiming    = false;
        this._aimAngle  = null;
        this._aimClosing = false;
        this._updateCancelBtn();
        this._updateEnvBtn();
        this._draw();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
        e.preventDefault(); this._deleteSelected(); return;
      }
      const toolKeys = { w: 'wall', d: 'dimension', s: 'select', i: 'install', f: 'photo', n: 'note', p: 'door', j: 'window', a: 'environment' };
      if (!e.ctrlKey && !e.metaKey && !e.altKey && toolKeys[e.key]) this._setTool(toolKeys[e.key]);
    };
    window.addEventListener('keydown', this._keyHandler);
  },

  // ── Touch ─────────────────────────────────
  // Ferramentas de desenho: 1 dedo = sempre desenha (sem distinção tap/drag)
  // Ferramenta Selecionar: 1 dedo arrastar (>35px) = mover mapa
  // 2 dedos: sempre zoom + mover (em qualquer ferramenta)

  _touches: [],
  _lastTouchDist: 0,
  _lastTouchMid:  null,

  _onTouchStart(e) {
    e.preventDefault();
    this._touches      = Array.from(e.touches);
    this._touchStartPos = e.touches.length === 1
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : null;

    if (e.touches.length === 1) {
      const rect = this.canvas.getBoundingClientRect();
      const raw  = this.toWorld(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
      this.mouseWorld = this._snapWorld(raw, false);

      // Select + parede selecionada: verificar se tocou num handle de endpoint
      if (this.currentTool === 'select' && this.selected?.type === 'wall') {
        const w = this.project.canvas.walls.find(w => w.id === this.selected.id);
        if (w) {
          const HR = 28 / this.zoom;  // raio de hit em pixels de tela
          if (dist(raw.x, raw.y, w.x1, w.y1) <= HR) {
            this._wallDrag = { wallId: w.id, mode: 'p1', startWorld: raw,
              origX1: w.x1, origY1: w.y1, origX2: w.x2, origY2: w.y2 };
            this._draw();
            return;
          }
          if (dist(raw.x, raw.y, w.x2, w.y2) <= HR) {
            this._wallDrag = { wallId: w.id, mode: 'p2', startWorld: raw,
              origX1: w.x1, origY1: w.y1, origX2: w.x2, origY2: w.y2 };
            this._draw();
            return;
          }
          // Long press no CORPO da parede → travar/destravar dimensão
          const bodyR = 20 / this.zoom;
          if (this._pointNearSegment(raw, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }, bodyR)) {
            if (!w.locked) {
              // Drag do corpo (mover parede perpendicular)
              this._wallDrag = { wallId: w.id, mode: 'body', startWorld: raw,
                origX1: w.x1, origY1: w.y1, origX2: w.x2, origY2: w.y2 };
            }
            // Long press timer → travar/destravar
            this._longPressTimer = setTimeout(() => {
              this._longPressTimer = null;
              this._wallDrag = null;
              w.locked = !w.locked;
              this._scheduleSave();
              this._draw();
              Toast.show(w.locked ? '🔒 Parede travada' : '🔓 Parede destravada', 'info', 1500);
            }, 600);
            this._draw();
            return;
          }
        }
      }

      // Parede: se já há ponto inicial, este dedo começa a mirar a direção
      if (this.currentTool === 'wall' && this.drawStart) {
        this._aiming = true;
        this._wallAim(raw);
      } else if (this.currentTool === 'door' || this.currentTool === 'window') {
        this._aimingOpening = true;
        this._openingAim(raw);
      } else {
        this._draw();
      }
    } else if (e.touches.length === 2) {
      this._aiming = false;
      this._aimingOpening = false;
      // Se estava desenhando parede, sinalizar que houve zoom — impede commit acidental
      if (this.currentTool === 'wall' && this.drawStart) {
        this._hadTwoFingerGesture = true;
      }
      this._lastTouchDist = this._touchDist(e.touches[0], e.touches[1]);
      this._lastTouchMid  = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  },

  _onTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 1 && this._touches.length === 1) {
      const rect = this.canvas.getBoundingClientRect();
      const raw  = this.toWorld(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);

      // Parede: arrastar 1 dedo mira a direção (trava em 90°/45°)
      if (this.currentTool === 'wall' && this._aiming) {
        this._wallAim(raw);
        this._touches = Array.from(e.touches);
        return;
      }
      // Porta/janela: arrastar 1 dedo realça a parede alvo
      if (this._aimingOpening) {
        this._openingAim(raw);
        this._touches = Array.from(e.touches);
        return;
      }

      this.mouseWorld = this._snapWorld(raw, false);

      // Snap magnético — cota e paredes (início e aim)
      if (this.currentTool === 'dimension') {
        this._archSnapPt = this._snapToArchPoint(raw);
        this._wallSnapPt = null;
        if (this._archSnapPt) this.mouseWorld = this._archSnapPt;
      } else if (this.currentTool === 'wall') {
        // "Conectar" aparece tanto antes do 1º ponto quanto durante o aim
        this._wallSnapPt = this._snapToWallEndpoint(this._aiming ? (this.mouseWorld || raw) : raw);
        this._archSnapPt = null;
        if (this._wallSnapPt && !this.drawStart) {
          this.mouseWorld = this._wallSnapPt;
        }
      } else {
        this._archSnapPt = null;
        this._wallSnapPt = null;
      }

      // Drag de parede (endpoint ou corpo)
      if (this._wallDrag) {
        // Cancelar long press se arrastou
        if (this._longPressTimer) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
        const d = this._wallDrag;
        const w = this.project.canvas.walls.find(w => w.id === d.wallId);
        if (w && !w.locked) {
          const dx = raw.x - d.startWorld.x;
          const dy = raw.y - d.startWorld.y;
          if (d.mode === 'p1') { w.x1 = d.origX1 + dx; w.y1 = d.origY1 + dy; }
          if (d.mode === 'p2') { w.x2 = d.origX2 + dx; w.y2 = d.origY2 + dy; }
          if (d.mode === 'body') {
            w.x1 = d.origX1 + dx; w.y1 = d.origY1 + dy;
            w.x2 = d.origX2 + dx; w.y2 = d.origY2 + dy;
          }
        }
        this._updateDragDimHud();
        this._touches = Array.from(e.touches);
        this._draw();
        return;
      }

      // Selecionar: arrasto com 1 dedo move o mapa
      if (this.currentTool === 'select') {
        const dx = e.touches[0].clientX - this._touches[0].clientX;
        const dy = e.touches[0].clientY - this._touches[0].clientY;
        if (this._touchStartPos) {
          const tx = e.touches[0].clientX - this._touchStartPos.x;
          const ty = e.touches[0].clientY - this._touchStartPos.y;
          if (Math.sqrt(tx * tx + ty * ty) > 35) {
            this.panX += dx;
            this.panY += dy;
          }
        }
      }

      this._touches = Array.from(e.touches);
      this._draw();

    } else if (e.touches.length === 2) {
      // 2 dedos: zoom + pan simultâneos
      const d    = this._touchDist(e.touches[0], e.touches[1]);
      const mid  = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      const rect   = this.canvas.getBoundingClientRect();
      const px     = mid.x - rect.left;
      const py     = mid.y - rect.top;
      const factor = this._lastTouchDist > 0 ? d / this._lastTouchDist : 1;
      const newZ   = Math.max(0.02, Math.min(30, this.zoom * factor));
      this.panX    = px - (px - this.panX) * (newZ / this.zoom);
      this.panY    = py - (py - this.panY) * (newZ / this.zoom);
      // Deslocamento do centro dos dois dedos
      if (this._lastTouchMid) {
        this.panX += mid.x - this._lastTouchMid.x;
        this.panY += mid.y - this._lastTouchMid.y;
      }
      this.zoom           = newZ;
      this._lastTouchDist = d;
      this._lastTouchMid  = mid;
      this._touches       = Array.from(e.touches);
      this._draw();
    }
  },

  _onTouchEnd(e) {
    e.preventDefault();

    // 1 dedo levantado
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      const t     = e.changedTouches[0];
      const rect  = this.canvas.getBoundingClientRect();
      const raw   = this.toWorld(t.clientX - rect.left, t.clientY - rect.top);
      const world = this._snapWorld(raw, false);

      // Limpar long press ao levantar o dedo
      if (this._longPressTimer) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }

      // Finalizar drag de endpoint
      if (this._wallDrag) {
        const d = this._wallDrag;
        const w = this.project.canvas.walls.find(w => w.id === d.wallId);
        if (w) {
          // Snap ao endpoint mais próximo ao soltar
          const endPt = d.mode === 'p1' ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
          const snapPt = this._snapToNearestEndpoint(endPt, 300);
          if (snapPt) {
            if (d.mode === 'p1') { w.x1 = snapPt.x; w.y1 = snapPt.y; }
            if (d.mode === 'p2') { w.x2 = snapPt.x; w.y2 = snapPt.y; }
          }
          this._pushHistory();
          this._scheduleSave();
        }
        this._wallDrag = null;
        this._updateDragDimHud();
        this._touches = Array.from(e.touches);
        this._touchStartPos = null;
        this._draw();
        return;
      }

      // Parede: fluxo próprio (início por toque, direção por arraste/toque-alvo)
      if (this.currentTool === 'wall') {
        // Se houve zoom de 2 dedos, ignorar este touch end para não criar parede acidental
        if (this._hadTwoFingerGesture) {
          this._hadTwoFingerGesture = false;
          this._aiming = false;
          this._touches       = Array.from(e.touches);
          this._touchStartPos = null;
          this._draw();
          return;
        }
        if (!this._handleScaleCalibClick(world)) {
          if (!this.drawStart) {
            this._wallSetAnchor(world);
          } else {
            this._aiming = true;
            this._wallAim(raw);
            this._wallCommit();
          }
        }
        this._touches       = Array.from(e.touches);
        this._touchStartPos = null;
        return;
      }

      // Porta/janela: confirma a parede sob o dedo e abre o formulário
      if (this.currentTool === 'door' || this.currentTool === 'window') {
        this._openingAim(raw);
        this._openingCommit();
        this._touches       = Array.from(e.touches);
        this._touchStartPos = null;
        return;
      }

      // Instalação: confirma a parede sob o dedo e abre o formulário
      if (this.currentTool === 'install') {
        this._installAim(raw);
        this._aimingInstall = false;
        this._installCommit();
        this._touches       = Array.from(e.touches);
        this._touchStartPos = null;
        return;
      }

      // Selecionar: só dispara se não arrastou (tap)
      const isSelect = this.currentTool === 'select';
      let isTap = true;
      if (isSelect && this._touchStartPos) {
        const dx = t.clientX - this._touchStartPos.x;
        const dy = t.clientY - this._touchStartPos.y;
        isTap = Math.sqrt(dx * dx + dy * dy) < 35;
      }

      if (isTap) {
        if (!this._handleScaleCalibClick(world)) switch (this.currentTool) {
          case 'dimension':   this._clickDim(raw);                     break;
          case 'install':     this._clickInstall(world);               break;
          case 'photo':       this._clickPhoto(world);                 break;
          case 'note':        this._clickNote(world);                  break;
          case 'select':      this._clickSelect(raw);                  break;
          case 'environment': this._clickEnvironment(world);           break;
        }
        this.mouseWorld = world;
        this._draw();
      }
    }

    this._touches       = Array.from(e.touches);
    this._touchStartPos = null;
  },

  _touchDist(t1, t2) {
    return Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
  },

  // ── Environment tool ──────────────────────

  _clickEnvironment(world) {
    // Auto-close if tap is near first point (screen distance < 40px)
    if (this.envPoints.length >= 3) {
      const fp     = this.envPoints[0];
      const screenD = dist(fp.x, fp.y, world.x, world.y) * this.zoom;
      if (screenD < 40) { this._closeEnvironment(); return; }
    }
    this.envPoints.push({ x: world.x, y: world.y });
    this._updateEnvBtn();
    this._draw();
  },

  _updateEnvBtn() {
    const btn = document.getElementById('btn-close-env');
    if (btn) btn.style.display = (this.envPoints.length >= 3 || this._pendingEnvPts) ? '' : 'none';
  },

  _closeEnvironment() {
    // Se há um contorno pendente (cancelou o modal anteriormente), usa ele
    if (this._pendingEnvPts) {
      const pts = this._pendingEnvPts;
      this._pendingEnvPts = null;
      this._promptEnvironment(pts);
      return;
    }
    if (this.envPoints.length < 3) return;
    const pts = [...this.envPoints];
    this.envPoints = [];
    this._updateEnvBtn();
    this._promptEnvironment(pts);
  },

  // Pede nome/pé-direito e cria o ambiente a partir de um contorno de pontos.
  // Usado tanto pela ferramenta Ambiente quanto pelo fechamento automático de paredes.
  _promptEnvironment(pts) {
    const areaM2 = (polygonArea(pts) / 1e6).toFixed(2);
    const defaultName = `Ambiente ${(this.project.canvas.environments?.length || 0) + 1}`;
    Modal.open(`
      <div class="modal-header">
        <h2 class="modal-title">Fechar Ambiente</h2>
        <button class="modal-close" id="mc"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></button>
      </div>
      <div class="modal-body">
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px;">Área aproximada: <strong style="color:var(--accent);">${areaM2} m²</strong></p>
        <div class="form-group">
          <label class="form-label">Nome do ambiente</label>
          <input class="form-input" id="env-name" type="text"
            placeholder="${defaultName}"
            style="-webkit-user-select:text;user-select:text;">
        </div>
        <div class="form-group">
          <label class="form-label">Pé-direito (m)</label>
          <input class="form-input" id="env-pedireito" type="text" inputmode="decimal"
            placeholder="Ex: 2,80" style="-webkit-user-select:text;user-select:text;">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="mc-cancel">Cancelar</button>
        <button class="btn-primary" id="mc-save">Salvar ambiente</button>
      </div>
    `);

    const cancelFn = () => {
      // Preservar contorno para que btn-close-env possa reabrir o modal
      this._pendingEnvPts = pts;
      this._updateEnvBtn();
      Modal.close();
      this._draw();
    };
    document.getElementById('mc').addEventListener('click', cancelFn);
    document.getElementById('mc-cancel').addEventListener('click', cancelFn);
    document.getElementById('mc-save').addEventListener('click', () => {
      const name = (document.getElementById('env-name')?.value || '').trim() || defaultName;
      const pedireito = parseLocaleFloatOrNull(document.getElementById('env-pedireito')?.value);
      this._pushHistory();
      this.project.canvas.environments.push({
        id: generateId(),
        name,
        polygon:   pts,
        centroid:  polygonCentroid(pts),
        area:      polygonArea(pts),
        peDireito: pedireito,
        observation: '',
      });
      this._pendingEnvPts = null;
      this._scheduleSave();
      this._draw();
      Modal.close();
      Toast.show(`Ambiente "${name}" criado`, 'success');
    });
  },

  // ── Background image ──────────────────────

  _importBackground() {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img    = new Image();
        img.onload = async () => {
          this.project.canvas.backgroundImage = {
            data: ev.target.result,
            x: 0, y: 0,
            scale:   10,   // mm per image pixel (calibre depois)
            opacity: 0.3,
            rotation: 0,
            calibrationPoints: null,
          };
          this._bgImg = img;
          this._draw();
          const btn = document.getElementById('btn-calib');
          if (btn) btn.style.display = '';
          // Salvar imediatamente — imagem de fundo vai pro IndexedDB agora.
          await this._saveNow();
          Toast.show('Fundo importado — toque em "Calibrar" para ajustar a escala', 'info', 6000);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  _drawBackground(ctx) {
    const bg = this.project.canvas.backgroundImage;
    if (!bg || !bg.data) return;

    if (!this._bgImg || this._bgImg._src !== bg.data) {
      this._bgImg = new Image();
      this._bgImg._src = bg.data;
      this._bgImg.onload = () => this._draw();
      this._bgImg.src = bg.data;
      return;
    }
    if (!this._bgImg.complete || !this._bgImg.naturalWidth) return;

    const scale = bg.scale || 10;
    const w = this._bgImg.naturalWidth  * scale;
    const h = this._bgImg.naturalHeight * scale;

    ctx.globalAlpha = bg.opacity != null ? bg.opacity : 0.3;
    ctx.drawImage(this._bgImg, bg.x || 0, bg.y || 0, w, h);
    ctx.globalAlpha = 1;
  },

  _startScaleCalib() {
    this._scaleTool = { p1: null };
    Toast.show('Toque no 1º ponto de referência na imagem', 'info', 6000);
    this._showHint('Calibração: toque no 1º ponto → 2º ponto → informe a distância real');
  },

  _handleScaleCalibClick(world) {
    if (!this._scaleTool) return false;
    if (!this._scaleTool.p1) {
      this._scaleTool.p1 = world;
      Toast.show('Agora toque no 2º ponto', 'info', 5000);
      return true;
    }
    // Second point — ask for real distance
    const p1 = this._scaleTool.p1;
    const p2 = world;
    this._scaleTool = null;
    this._showHint('');

    Modal.open(`
      <div class="modal-header">
        <h2 class="modal-title">Calibrar escala</h2>
        <button class="modal-close" id="mc"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:12px;margin-bottom:10px;">
          Qual é a distância real entre os dois pontos marcados?
        </p>
        <input class="form-input" id="calib-dist" type="text" inputmode="decimal"
          placeholder="Ex: 1500 (em mm)" autofocus
          style="-webkit-user-select:text;user-select:text;">
        <p style="color:var(--text-faint);font-size:10px;margin-top:6px;">Informe em milímetros</p>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="mc-cancel">Cancelar</button>
        <button class="btn-primary" id="mc-ok">Aplicar</button>
      </div>
    `);

    setTimeout(() => document.getElementById('calib-dist')?.focus(), 80);
    document.getElementById('mc').addEventListener('click', () => Modal.close());
    document.getElementById('mc-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('mc-ok').addEventListener('click', () => {
      const realMm = parseLocaleFloat(document.getElementById('calib-dist')?.value);
      if (!realMm || realMm <= 0) return;
      const bg  = this.project.canvas.backgroundImage;
      if (!bg) { Modal.close(); return; }
      const worldDist = dist(p1.x, p1.y, p2.x, p2.y);
      if (!worldDist) { Modal.close(); return; }
      const oldScale  = bg.scale || 10;
      const d_px      = worldDist / oldScale;
      bg.scale        = realMm / d_px;
      // Manter p1 ancorado no espaço do mundo — ajustar X e Y
      const ix1   = (p1.x - (bg.x || 0)) / oldScale;
      const iy1   = (p1.y - (bg.y || 0)) / oldScale;
      bg.x        = p1.x - ix1 * bg.scale;
      bg.y        = p1.y - iy1 * bg.scale;
      this._scheduleSave();
      this._draw();
      Modal.close();
      Toast.show('Escala calibrada', 'success');
    });
    return true;
  },

  // ── Geometry helpers ──────────────────────

  _pointInPolygon(pt, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  // ── Auto-save ─────────────────────────────

  _startAutoSave() {
    this._autoInterval = setInterval(() => this._saveNow(), 30000);
  },

  _initOfflineBadge() {
    const update = () => {
      const badge = document.getElementById('offline-badge');
      if (badge) badge.style.display = navigator.onLine ? 'none' : '';
    };
    update();
    this._offlineHandler  = () => update();
    this._onlineHandler   = () => update();
    window.addEventListener('offline', this._offlineHandler);
    window.addEventListener('online',  this._onlineHandler);
  },

  // Salva quando o app vai para o fundo (aba/app minimizado, troca de app).
  // Fecha a janela em que o tablet derruba o processo antes do auto-save rodar.
  _initVisibility() {
    this._visibilityHandler = () => {
      if (document.visibilityState === 'hidden' && this.project) {
        this._saveNow();  // fire-and-forget aceitável — app está indo pro fundo
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
  },

  _scheduleSave() {
    this._setSaveState('saving');
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveNow(), 2000);
  },

  async _saveNow() {
    if (!this.project) return;
    this.project.canvas.zoom = this.zoom;
    this.project.canvas.panX = this.panX;
    this.project.canvas.panY = this.panY;
    const result = await Storage.save(this.project);
    if (result && result.error === 'quota') {
      this._setSaveState('error');
      Toast.show(
        '⚠ Armazenamento cheio — exporte o projeto (DXF/PDF) e exclua fotos antigas.',
        'error', 10000
      );
    } else {
      this._setSaveState('saved');
    }
  },

  _setSaveState(s) {
    const dot   = document.getElementById('save-dot');
    const label = document.getElementById('save-label');
    if (!dot || !label) return;
    dot.classList.toggle('saving', s === 'saving');
    dot.classList.toggle('error',  s === 'error');
    if (s === 'saving') {
      label.textContent = 'Salvando…';
    } else if (s === 'error') {
      label.textContent = 'Erro ao salvar';
      label.style.color = 'var(--red)';
    } else {
      label.textContent = 'Salvo';
      label.style.color = '';
    }
  },

  // ── Modo bússola ──────────────────────────

  async _toggleCompass() {
    if (this._compassMode) {
      if (this._compassHandler) window.removeEventListener('deviceorientation', this._compassHandler, true);
      this._compassHandler = null;
      this._compassMode    = false;
      this._compassRaw     = null;
      document.getElementById('btn-compass')?.classList.remove('active');
      this._draw();
      return;
    }
    // iOS requer permissão explícita
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') { Toast.show('Permissão da bússola negada', 'error'); return; }
      } catch { Toast.show('Bússola não disponível neste dispositivo', 'error'); return; }
    }
    if (typeof DeviceOrientationEvent === 'undefined') {
      Toast.show('Este dispositivo não tem bússola', 'error'); return;
    }
    this._compassMode    = true;
    this._compassHandler = e => this._onOrientation(e);
    window.addEventListener('deviceorientation', this._compassHandler, true);
    document.getElementById('btn-compass')?.classList.add('active');
    Toast.show('Bússola ativa — planta gira com o tablet', 'success', 2500);
    this._draw();
  },

  _onOrientation(e) {
    if (e.alpha == null) return;
    const raw = e.alpha;
    if (this._compassRaw == null) {
      this._compassRaw = raw;
    } else {
      // Suavização exponencial com tratamento do loop 0°/360°
      let diff = raw - this._compassRaw;
      if (diff >  180) diff -= 360;
      if (diff < -180) diff += 360;
      this._compassRaw = (this._compassRaw + diff * 0.15 + 360) % 360;
    }
    this._compassHeading = this._compassRaw;
    this._draw();
  },

  _drawCompassOverlay(ctx, W, H) {
    const r  = 20, margin = 14;
    const cx = W - r - margin, cy = r + margin;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Círculo de fundo
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(26,24,20,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.45)';
    ctx.lineWidth   = 1.2;
    ctx.stroke();

    // Agulha N (vermelho, aponta para o norte FÍSICO — sempre fixo na tela)
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 4);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.lineTo(cx + 4, cy + 4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(210,80,80,0.9)';
    ctx.fill();

    // Letra N
    ctx.font         = 'bold 9px Inter,sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.85)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - r + 9);

    ctx.restore();
  },

  // ── Cleanup ───────────────────────────────

  destroy() {
    window.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('resize', this._resizeHandler);
    window.removeEventListener('orientationchange', this._resizeHandler);
    document.removeEventListener('visibilitychange', this._visibilityHandler);
    if (this._compassHandler) window.removeEventListener('deviceorientation', this._compassHandler, true);
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    clearInterval(this._autoInterval);
    clearTimeout(this._saveTimer);
    if (this._offlineHandler) window.removeEventListener('offline', this._offlineHandler);
    if (this._onlineHandler)  window.removeEventListener('online',  this._onlineHandler);
    this._saveNow();
  },

  // ── Geometry helpers ──────────────────────

  _pointNearSegment(p, a, b, r) {
    const { t, d } = this._projectPointOnSegment(p, a, b);
    return t >= 0 && t <= 1 && d < r;
  },

  _projectPointOnSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (!lenSq) return { t: 0, d: dist(p.x, p.y, a.x, a.y) };
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    const cx = a.x + t * dx, cy = a.y + t * dy;
    return { t, d: dist(p.x, p.y, cx, cy) };
  },

  // ── Lookup helpers ────────────────────────

  // Símbolo curto para renderização na planta e no DXF.
  // Usa INSTALLATION_LIBRARY via getInstallEntry() — fallback para tipos desconhecidos.
  _instCode(type) {
    const entry = getInstallEntry(type);
    return entry ? entry.symbol : (type || 'X').slice(0, 3).toUpperCase();
  },

  // Label PT-BR para sidebar e relatórios.
  _instLabel(type) {
    const entry = getInstallEntry(type);
    return entry ? entry.label : type;
  },

  // ── Icons ─────────────────────────────────

  _ic(name) {
    const icons = {
      'chevron-left': `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2.5L4.5 6.5L8 10.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'undo':   `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 4.5h6a3.5 3.5 0 1 1 0 7H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 2L2 4.5L4.5 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'redo':   `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M11 4.5H5a3.5 3.5 0 1 0 0 7h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 2L11 4.5L8.5 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'download':`<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5v7M4 6.5l2.5 2.5 2.5-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.5 10.5h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
      'cursor': `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2L3 12L6 8.5L9 13L10.5 12L7.5 7L12 7L3 2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/></svg>`,
      'wall':   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10" stroke="currentColor" stroke-width="3" stroke-linecap="square"/></svg>`,
      'dim':    `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M2 4v6M12 4v6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      'door':   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 13V3h6v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10 6a4 4 0 0 1-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      'window': `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M3 5h8M3 9h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      'bolt':   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8 2L4 8h4l-2 4 6-7H8L10 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'camera': `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="4.5" width="11" height="8" rx="1.2" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="8.5" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M5 4.5l1-2h2l1 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'note':   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="1.5" width="9" height="11" rx="1.2" stroke="currentColor" stroke-width="1.3"/><path d="M5 5.5h4M5 8h4M5 10.5h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      'env':    `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 1.5"/></svg>`,
      'grid':   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2v10M9 2v10M2 5h10M2 9h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.7"/></svg>`,
      'fit':    `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 6.5h4M6.5 4.5v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      'pdf':    `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="1" width="10" height="11" rx="1.2" stroke="currentColor" stroke-width="1.3"/><path d="M4 4h5M4 6.5h5M4 9h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      'img':    `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="9" rx="1.2" stroke="currentColor" stroke-width="1.3"/><circle cx="5" cy="5.5" r="1" fill="currentColor"/><path d="M1.5 9.5l3-3 2.5 2.5 1.5-1.5 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'ruler2': `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5h10v4H2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 5v2M8 5v2M11 5v4M3 5v4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
      'check':  `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3.5 3.5L11.5 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'compass':`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 3v1M7 10v1M3 7h1M10 7h1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><path d="M7 4.5L8.5 9.5L7 8L5.5 9.5Z" fill="currentColor" opacity="0.9"/></svg>`,
      'ortho':  `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 11V3h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 7h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>`,
    };
    return icons[name] || '';
  },
};
