/* ═══════════════════════════════════════════
   Elle Levantamento — Data Layer & Storage
   ═══════════════════════════════════════════ */

const STORAGE_KEY = 'elle_levantamento_v1';

// ── ID Generator ──────────────────────────────

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Default canvas state ──────────────────────

function defaultCanvas() {
  return {
    zoom: 0.15,        // px per mm (0.15 ≈ 1:50 on 1366px wide display)
    panX: 200,
    panY: 200,
    gridVisible: true,
    snapEnabled: true,
    walls: [],         // { id, x1, y1, x2, y2, thickness }
    openings: [],      // { id, type, wallId, position, width, side }
    installations: [], // { id, type, x, y, height, observation, sequenceNumber }
    photoPins: [],     // { id, x, y, photoData, sequenceNumber }
    notes: [],         // { id, x, y, text }
    dimensions: [],    // { id, x1, y1, x2, y2, value, offset }
    environments: [],    // { id, name, polygon, centroid, area, peDireito, observation }
    backgroundImage: null, // { data, x, y, scale, opacity } — imagem de fundo para rastrear
  };
}

// ── Schema migration ──────────────────────────
// Garante que projetos salvos com versões antigas tenham todos os campos
// do schema atual. Sem isso, os loops de desenho (for..of) quebram quando
// um array esperado (openings, photoPins, etc.) está ausente e o canvas
// inteiro fica em branco.

function normalizeProject(p) {
  if (!p || typeof p !== 'object') return p;
  const def = defaultCanvas();
  p.canvas = p.canvas || {};
  for (const key in def) {
    if (p.canvas[key] === undefined || p.canvas[key] === null) {
      // backgroundImage tem default null — só preenche arrays/escalares ausentes
      if (key === 'backgroundImage') {
        if (!('backgroundImage' in p.canvas)) p.canvas.backgroundImage = null;
      } else {
        p.canvas[key] = def[key];
      }
    }
  }
  if (!Array.isArray(p.photos)) p.photos = [];
  return p;
}

// ── Project Factory ───────────────────────────

function createProject(name, client, address) {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: name.trim(),
    client: client.trim(),
    address: address.trim(),
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
    canvas: defaultCanvas(),
    photos: [],  // annotated photos (separate from photoPins)
  };
}

// ── Storage API ───────────────────────────────

const Storage = {
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  getList() {
    return Object.values(this.getAll())
      .map(normalizeProject)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  get(id) {
    const p = this.getAll()[id];
    return p ? normalizeProject(p) : null;
  },

  save(project) {
    const all = this.getAll();
    project.updatedAt = new Date().toISOString();
    all[project.id] = project;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      // Storage quota exceeded — warn user
      console.warn('Storage quota exceeded:', e);
    }
    return project;
  },

  delete(id) {
    const all = this.getAll();
    delete all[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },

  storageUsedKb() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || '';
      return Math.round(raw.length / 1024);
    } catch {
      return 0;
    }
  },
};

// ── Geometry helpers ──────────────────────────

function polygonArea(pts) {
  // Shoelace formula — returns area in same units² as pts
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function polygonCentroid(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  return { x: cx / pts.length, y: cy / pts.length };
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
