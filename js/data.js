/* ═══════════════════════════════════════════
   Elle Levantamento — Data Layer & Storage
   Schema v1 · coordenadas internas em mm
   ═══════════════════════════════════════════ */

const SCHEMA_VERSION = 1;
const STORAGE_KEY    = 'elle_levantamento_v1';

// ── ID Generator ──────────────────────────────

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Utilitário de parse PT-BR ─────────────────
// Converte "2,80" ou "2.80" para 2.8 sem NaN.
// Usar em TODO parseFloat que lê campos de formulário.

function parseLocaleFloat(str) {
  return parseFloat(String(str ?? '').trim().replace(',', '.')) || 0;
}

function parseLocaleFloatOrNull(str) {
  const s = String(str ?? '').trim();
  if (s === '' || s === '-') return null;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ── INSTALLATION_LIBRARY ──────────────────────
// Catálogo de tipos PT-BR com altura padrão de obra.
// Nunca serializado no projeto — apenas installation.type (id) e
// installation.height (override confirmado pelo usuário) são salvos.
//
// pack: null  → genérico, aparece em qualquer projeto
// pack: 'odonto'     → ativo quando project.packs inclui 'odonto'
// pack: 'restaurante'→ ativo quando project.packs inclui 'restaurante'
//
// defaultHeight: cm do piso | null = sem padrão (ex: luminária de teto)
// symbol: código curto para DXF e planta (ex: T1, AF2)
// layerDXF: layer no arquivo DXF
// color: cor CSS para UI

const INSTALLATION_LIBRARY = [

  // ── Elétrica genérica ───────────────────────
  { id: 'tomada_2pt',          label: 'Tomada 2P+T (NBR 14136)',       category: 'eletrica',   defaultHeight: 30,   symbol: 'T',   layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'tomada_alta',         label: 'Tomada alta / bancada',          category: 'eletrica',   defaultHeight: 105,  symbol: 'TA',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'interruptor_simples', label: 'Interruptor simples',            category: 'eletrica',   defaultHeight: 120,  symbol: 'I',   layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'interruptor_duplo',   label: 'Interruptor duplo',              category: 'eletrica',   defaultHeight: 120,  symbol: 'ID',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'interruptor_3vias',   label: 'Interruptor 3 vias (paralelo)',  category: 'eletrica',   defaultHeight: 120,  symbol: 'I3',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'luz_teto',            label: 'Luminária de teto',              category: 'eletrica',   defaultHeight: null, symbol: 'LT',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'luz_parede',          label: 'Arandela / parede',              category: 'eletrica',   defaultHeight: 200,  symbol: 'LP',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'ponto_dados',         label: 'Ponto de dados (RJ-45)',         category: 'eletrica',   defaultHeight: 30,   symbol: 'D',   layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'ponto_tv',            label: 'Ponto de TV / coaxial',          category: 'eletrica',   defaultHeight: 30,   symbol: 'TV',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'ponto_cftv',          label: 'Câmera CFTV',                    category: 'eletrica',   defaultHeight: null, symbol: 'CF',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'split_interno',       label: 'Split — unidade interna',        category: 'eletrica',   defaultHeight: 200,  symbol: 'AC',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'split_externo',       label: 'Split — unidade externa',        category: 'eletrica',   defaultHeight: null, symbol: 'ACE', layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'qd_distribuicao',     label: 'Quadro de distribuição',         category: 'eletrica',   defaultHeight: 160,  symbol: 'QD',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },
  { id: 'ponto_externo',       label: 'Tomada externa / área molhada',  category: 'eletrica',   defaultHeight: 100,  symbol: 'TE',  layerDXF: 'ELETRICA',   color: '#C9A84C', pack: null },

  // ── Hidráulica genérica ─────────────────────
  { id: 'agua_fria',           label: 'Água fria',                      category: 'hidraulica', defaultHeight: 60,   symbol: 'AF',  layerDXF: 'HIDRAULICA', color: '#5B9BD5', pack: null },
  { id: 'agua_quente',         label: 'Água quente',                    category: 'hidraulica', defaultHeight: 60,   symbol: 'AQ',  layerDXF: 'HIDRAULICA', color: '#C05050', pack: null },
  { id: 'esgoto',              label: 'Saída de esgoto',                category: 'hidraulica', defaultHeight: 10,   symbol: 'ES',  layerDXF: 'HIDRAULICA', color: '#5B9BD5', pack: null },
  { id: 'ralo',                label: 'Ralo / caixa sifônica',          category: 'hidraulica', defaultHeight: 0,    symbol: 'RL',  layerDXF: 'HIDRAULICA', color: '#5B9BD5', pack: null },
  { id: 'gas_ponto',           label: 'Ponto de gás',                   category: 'hidraulica', defaultHeight: 45,   symbol: 'GS',  layerDXF: 'HIDRAULICA', color: '#FF9800', pack: null },
  { id: 'cx_gordura',          label: 'Caixa de gordura',               category: 'hidraulica', defaultHeight: 0,    symbol: 'CG',  layerDXF: 'HIDRAULICA', color: '#5B9BD5', pack: null },
  { id: 'cx_inspecao',         label: 'Caixa de inspeção',              category: 'hidraulica', defaultHeight: 0,    symbol: 'CI',  layerDXF: 'HIDRAULICA', color: '#5B9BD5', pack: null },
  { id: 'registro_gaveta',     label: 'Registro de gaveta',             category: 'hidraulica', defaultHeight: 100,  symbol: 'RG',  layerDXF: 'HIDRAULICA', color: '#5B9BD5', pack: null },
  { id: 'chuveiro_ponto',      label: 'Ponto de chuveiro',              category: 'hidraulica', defaultHeight: 220,  symbol: 'CH',  layerDXF: 'HIDRAULICA', color: '#5B9BD5', pack: null },
  { id: 'torneira_jardim',     label: 'Torneira de jardim',             category: 'hidraulica', defaultHeight: 40,   symbol: 'TJ',  layerDXF: 'HIDRAULICA', color: '#5B9BD5', pack: null },
  { id: 'maq_lavar_ponto',     label: 'Ponto máquina de lavar',         category: 'hidraulica', defaultHeight: 80,   symbol: 'ML',  layerDXF: 'HIDRAULICA', color: '#5B9BD5', pack: null },

  // ── Pack: odonto ────────────────────────────
  { id: 'ar_comprimido',       label: 'Ar comprimido (cadeira)',         category: 'odonto',     defaultHeight: 90,   symbol: 'AR',  layerDXF: 'ODONTO',     color: '#5A9A70', pack: 'odonto' },
  { id: 'sugador',             label: 'Ponto de sugador',                category: 'odonto',     defaultHeight: 90,   symbol: 'SG',  layerDXF: 'ODONTO',     color: '#5A9A70', pack: 'odonto' },
  { id: 'dreno_cuspe',         label: 'Dreno do cuspe',                  category: 'odonto',     defaultHeight: 10,   symbol: 'DC',  layerDXF: 'ODONTO',     color: '#5A9A70', pack: 'odonto' },
  { id: 'gases_odonto',        label: 'Rede de gases (O₂/N₂O)',          category: 'odonto',     defaultHeight: 90,   symbol: 'GO',  layerDXF: 'ODONTO',     color: '#5A9A70', pack: 'odonto' },
  { id: 'rx_periapical',       label: 'Ponto de RX periapical',          category: 'odonto',     defaultHeight: null, symbol: 'RX',  layerDXF: 'ODONTO',     color: '#5A9A70', pack: 'odonto' },
  { id: 'autoclave_agua',      label: 'Água para autoclave',             category: 'odonto',     defaultHeight: 80,   symbol: 'AA',  layerDXF: 'ODONTO',     color: '#5A9A70', pack: 'odonto' },
  { id: 'aspirador_cirurgico', label: 'Aspirador cirúrgico',             category: 'odonto',     defaultHeight: 90,   symbol: 'AS',  layerDXF: 'ODONTO',     color: '#5A9A70', pack: 'odonto' },

  // ── Pack: restaurante ───────────────────────
  { id: 'exaustao_coifa',      label: 'Exaustão / coifa',               category: 'restaurante', defaultHeight: null, symbol: 'EX',  layerDXF: 'HIDRAULICA', color: '#9C27B0', pack: 'restaurante' },
  { id: 'gas_industrial',      label: 'Gás industrial',                 category: 'restaurante', defaultHeight: 45,   symbol: 'GI',  layerDXF: 'HIDRAULICA', color: '#FF9800', pack: 'restaurante' },
  { id: 'tomada_trifasica',    label: 'Tomada trifásica (380V)',         category: 'restaurante', defaultHeight: 30,   symbol: 'T3F', layerDXF: 'ELETRICA',   color: '#C9A84C', pack: 'restaurante' },
  { id: 'cx_gordura_rest',     label: 'Caixa de gordura (restaurante)', category: 'restaurante', defaultHeight: 0,    symbol: 'CGR', layerDXF: 'HIDRAULICA', color: '#9C27B0', pack: 'restaurante' },
];

// Retorna tipos disponíveis para um projeto (genéricos + packs ativos)
function getAvailableInstallTypes(project) {
  const packs = (project && project.packs) ? project.packs : [];
  return INSTALLATION_LIBRARY.filter(e => e.pack === null || packs.includes(e.pack));
}

// Busca entrada da biblioteca pelo id
function getInstallEntry(typeId) {
  return INSTALLATION_LIBRARY.find(e => e.id === typeId) || null;
}

// ── Default canvas state ──────────────────────

function defaultCanvas() {
  return {
    zoom:             0.15,    // px/mm (0.15 ≈ 1:50 em 1366px)
    panX:             200,
    panY:             200,
    gridVisible:      true,
    snapEnabled:      true,
    defaultPeDireito: null,    // m | null = herda default do projeto/não definido
    walls:         [],         // { id, x1, y1, x2, y2, thickness, label? }
    openings:      [],         // { id, type, wallId, position, width, height, sill, hingeSide, openDir, side }
    installations: [],         // { id, type, x, y, height(cm), observation, sequenceNumber, wallId?, wallT? }
    photoPins:     [],         // { id, x, y, photoData, sequenceNumber, annotations, caption }
    notes:         [],         // { id, x, y, text, environmentId? }
    dimensions:    [],         // { id, x1, y1, x2, y2, value, offset, wallId?, label? }
    environments:  [],         // { id, name, polygon, peDireito, observation, color? }
    backgroundImage: null,     // { data, x, y, scale, opacity, rotation, calibrationPoints? }
    elevations:    [],         // { id, wallId, name, environmentId?, showDimensions, showInstallations }
  };
}

// ── Normalizadores por entidade ───────────────
// Cada função garante que todos os campos existem com defaults seguros.
// Nunca remove campos desconhecidos (compatibilidade futura).

function normalizeWall(w) {
  return {
    id:        w.id        || generateId(),
    x1:        w.x1        || 0,
    y1:        w.y1        || 0,
    x2:        w.x2        || 0,
    y2:        w.y2        || 0,
    thickness: w.thickness || 150,
    label:     w.label     ?? null,
  };
}

function normalizeOpening(o) {
  return {
    id:        o.id        || generateId(),
    type:      o.type      || 'door',
    wallId:    o.wallId    || '',
    position:  o.position  ?? 0.5,
    width:     o.width     || 800,
    height:    o.height    ?? null,
    sill:      o.sill      ?? null,
    hingeSide: o.hingeSide || 'right',
    openDir:   o.openDir   || 'in',
    side:      o.side      || o.hingeSide || 'right',
  };
}

// Migração de IDs antigos (v0) para novos (v1)
const _OLD_TYPE_MAP = {
  tomada110:    'tomada_2pt',
  tomada220:    'tomada_alta',
  interruptor:  'interruptor_simples',
  luzTeto:      'luz_teto',
  luzParede:    'luz_parede',
  dados:        'ponto_dados',
  splitInterno: 'split_interno',
  splitExterno: 'split_externo',
  aguaFria:     'agua_fria',
  aguaQuente:   'agua_quente',
  ralo:         'ralo',
  esgoto:       'esgoto',
  gas:          'gas_ponto',
};

function normalizeInstallation(inst) {
  const type = _OLD_TYPE_MAP[inst.type] || inst.type || 'tomada_2pt';
  return {
    id:             inst.id             || generateId(),
    type,
    x:              inst.x              || 0,
    y:              inst.y              || 0,
    height:         inst.height         ?? null,   // cm | null
    observation:    inst.observation    ?? '',
    sequenceNumber: inst.sequenceNumber ?? 1,
    wallId:         inst.wallId         ?? null,
    wallT:          inst.wallT          ?? null,
  };
}

function normalizePhotoPin(p) {
  return {
    id:             p.id             || generateId(),
    x:              p.x              || 0,
    y:              p.y              || 0,
    photoData:      p.photoData      ?? null,
    sequenceNumber: p.sequenceNumber ?? 1,
    annotations:    Array.isArray(p.annotations) ? p.annotations : [],
    caption:        p.caption        ?? '',
  };
}

function normalizeNote(n) {
  return {
    id:            n.id            || generateId(),
    x:             n.x             || 0,
    y:             n.y             || 0,
    text:          n.text          ?? '',
    environmentId: n.environmentId ?? null,
  };
}

function normalizeDimension(d) {
  return {
    id:     d.id     || generateId(),
    x1:     d.x1     || 0,
    y1:     d.y1     || 0,
    x2:     d.x2     || 0,
    y2:     d.y2     || 0,
    value:  d.value  ?? null,   // null = calculado de dist(x1,y1,x2,y2)
    offset: d.offset ?? 400,   // mm
    wallId: d.wallId ?? null,
    label:  d.label  ?? null,
  };
}

function normalizeEnvironment(e) {
  // centroid e area são calculados no render — NÃO persistir
  return {
    id:          e.id          || generateId(),
    name:        e.name        || 'Ambiente',
    polygon:     Array.isArray(e.polygon) ? e.polygon : [],
    peDireito:   e.peDireito   ?? null,   // m | null = herda defaultPeDireito
    observation: e.observation ?? '',
    color:       e.color       ?? null,
  };
}

function normalizeElevation(ev) {
  return {
    id:                ev.id                || generateId(),
    wallId:            ev.wallId            || '',
    name:              ev.name              || 'Elevação',
    environmentId:     ev.environmentId     ?? null,
    showDimensions:    ev.showDimensions    ?? true,
    showInstallations: ev.showInstallations ?? true,
  };
}

function normalizeBackgroundImage(bg) {
  if (!bg) return null;
  return {
    data:               bg.data               ?? null,
    x:                  bg.x                  || 0,
    y:                  bg.y                  || 0,
    scale:              bg.scale              || 10,
    opacity:            bg.opacity            ?? 0.3,
    rotation:           bg.rotation           ?? 0,
    calibrationPoints:  bg.calibrationPoints  ?? null,
  };
}

function normalizeCanvas(c) {
  if (!c || typeof c !== 'object') c = {};
  const def = defaultCanvas();
  return {
    zoom:             c.zoom             ?? def.zoom,
    panX:             c.panX             ?? def.panX,
    panY:             c.panY             ?? def.panY,
    gridVisible:      c.gridVisible      ?? def.gridVisible,
    snapEnabled:      c.snapEnabled      ?? def.snapEnabled,
    defaultPeDireito: c.defaultPeDireito ?? null,
    walls:            (c.walls         || []).map(normalizeWall),
    openings:         (c.openings      || []).map(normalizeOpening),
    installations:    (c.installations || []).map(normalizeInstallation),
    photoPins:        (c.photoPins     || []).map(normalizePhotoPin),
    notes:            (c.notes         || []).map(normalizeNote),
    dimensions:       (c.dimensions    || []).map(normalizeDimension),
    environments:     (c.environments  || []).map(normalizeEnvironment),
    backgroundImage:  normalizeBackgroundImage(c.backgroundImage),
    elevations:       (c.elevations    || []).map(normalizeElevation),
  };
}

// ── Schema migration ──────────────────────────
// Migra projetos antigos e garante que todos os campos existam.
// Regras:
//   1. Nunca remove campos desconhecidos (retrocompatibilidade futura)
//   2. Migração v0→v1 (single-floor → multi-floor) ocorre na Fase 3
//   3. Aplica-se em leitura (lazy) — Storage.get/getList — e no save

function normalizeProject(p) {
  if (!p || typeof p !== 'object') return p;

  // Garantir campos raiz
  if (!Array.isArray(p.photos)) p.photos = [];
  if (!Array.isArray(p.packs))  p.packs  = [];

  // ── Migração Fase 3 (multi-pavimento) ──────
  // Quando p.floors existir, migrar p.canvas para floors[0].
  // Por enquanto (Fase 1/2) o app ainda usa p.canvas diretamente.
  // Este bloco já está aqui para quando a Fase 3 for implementada:
  //
  // if (p.canvas && !p.floors) {
  //   const floorId = generateId();
  //   p.floors = [{ id: floorId, name: 'Térreo', level: 0, canvas: p.canvas }];
  //   p.activeFloorId = floorId;
  //   delete p.canvas;
  //   p.schemaVersion = SCHEMA_VERSION;
  // }

  // Normalizar canvas (Fase 1/2)
  p.canvas = normalizeCanvas(p.canvas);

  p.schemaVersion = SCHEMA_VERSION;
  return p;
}

// ── Project Factory ───────────────────────────

function createProject(name, client, address) {
  const now = new Date().toISOString();
  return {
    id:            generateId(),
    schemaVersion: SCHEMA_VERSION,
    name:          name.trim(),
    client:        client.trim(),
    address:       address.trim(),
    createdAt:     now,
    updatedAt:     now,
    thumbnail:     null,
    packs:         [],
    canvas:        defaultCanvas(),
    photos:        [],
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
      // localStorage quota excedida — retornar erro para quem chamou
      console.warn('Storage quota exceeded:', e);
      return { error: 'quota', message: 'Espaço insuficiente. Exclua fotos antigas antes de continuar.' };
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

  // Quota restante estimada em KB (heurística — localStorage máx ~5MB)
  storageRemainingKb() {
    const used = this.storageUsedKb();
    return Math.max(0, 5120 - used);
  },
};

// ── Geometry helpers ──────────────────────────

function polygonArea(pts) {
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

// Comprimento de segmento (mm)
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Projeta ponto P no segmento AB; retorna { t: fração 0..1, d: distância ao segmento }
function projectPointOnSegment(P, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { t: 0, d: dist(P.x, P.y, A.x, A.y) };
  const t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq));
  const cx = A.x + t * dx, cy = A.y + t * dy;
  return { t, d: dist(P.x, P.y, cx, cy) };
}

function pointNearSegment(P, A, B, radius) {
  return projectPointOnSegment(P, A, B).d <= radius;
}

function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Sanitiza string para uso em HTML (previne XSS)
function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Formata mm para exibição: ≥1000mm → "1,250m" / <1000mm → "850mm"
function fmtMm(mm) {
  if (mm == null) return '—';
  return mm >= 1000
    ? `${(mm / 1000).toFixed(3).replace('.', ',')}m`
    : `${Math.round(mm)}mm`;
}

// Formata m² (área em mm²) para exibição
function fmtM2(mm2) {
  if (mm2 == null) return '—';
  return `${(mm2 / 1e6).toFixed(2)} m²`;
}
