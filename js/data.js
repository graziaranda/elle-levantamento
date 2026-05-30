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
// Suporta todos os formatos que chegam de teclado em campo:
//   "1,5"       → 1.5   (vírgula decimal BR)
//   "1.5"       → 1.5   (ponto decimal EN, hábito de teclado)
//   "1.234,56"  → 1234.56 (milhar BR + decimal)
//   "1.234.567" → 1234567 (milhar BR sem decimal)
//   "1.234"     → 1.234  (ambíguo: trata como decimal EN — safer)
//
// Algoritmo:
//   • Tem vírgula E ponto   → formato BR completo: remove pontos, troca vírgula
//   • Tem apenas vírgula    → decimal BR: troca vírgula por ponto
//   • Tem apenas ponto      → decimal EN ou inteiro: usa como está
//   • Nenhum               → inteiro: usa como está

function _parseLocaleStr(str) {
  let s = String(str ?? '').trim();
  const hasComma  = s.includes(',');
  const hasPeriod = s.includes('.');
  if (hasComma && hasPeriod) {
    // "1.234,56" ou "1.234.567,8" → remove pontos de milhar, troca vírgula
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // "1,5" → "1.5"
    s = s.replace(',', '.');
  }
  // caso só período ou nenhum: usar como está
  return s;
}

function parseLocaleFloat(str) {
  const n = parseFloat(_parseLocaleStr(str));
  return isNaN(n) ? 0 : n;
}

function parseLocaleFloatOrNull(str) {
  const s = String(str ?? '').trim();
  if (!s || s === '-') return null;
  const n = parseFloat(_parseLocaleStr(s));
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

// ── Factories de entidades ────────────────────
// Criam objetos novos com todos os defaults corretos.
// Canvas-editor chama estas funções — nunca monta o objeto inline.

// Cria uma nova instalação com height pré-preenchido da INSTALLATION_LIBRARY.
// height é COPIADO para a instância (não referência ao tipo) — cada ponto
// é independentemente editável em campo ("aquela tomada está a 110cm, não 30cm").
function createInstallation(type, x, y, canvas) {
  const entry   = getInstallEntry(type);
  const symbol  = entry ? entry.symbol : type.slice(0, 3).toUpperCase();

  // sequenceNumber: próximo número para este símbolo no canvas atual
  const existing = (canvas.installations || []).filter(i => {
    const e = getInstallEntry(i.type);
    return (e ? e.symbol : i.type.slice(0, 3).toUpperCase()) === symbol;
  });

  return {
    id:             generateId(),
    type,
    x,
    y,
    height:         entry ? entry.defaultHeight : null, // CÓPIA do default — editável por instância
    observation:    '',
    sequenceNumber: existing.length + 1,
    wallId:         null,
    wallT:          null,
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

// Retorna true se o tipo existe na INSTALLATION_LIBRARY.
// Usado para distinguir tipos conhecidos de tipos desconhecidos/customizados.
function isKnownInstallType(type) {
  return INSTALLATION_LIBRARY.some(e => e.id === type);
}

function normalizeInstallation(inst) {
  // 1. Tentar migrar tipo antigo
  let type = _OLD_TYPE_MAP[inst.type] || inst.type;

  // 2. Tipo null/undefined/vazio → fallback genérico
  if (!type) type = 'tomada_2pt';

  // 3. Tipo desconhecido (não está no mapa antigo nem na biblioteca):
  //    PRESERVAR o tipo original — a instalação não desaparece.
  //    Renderiza com código fallback (primeiras 3 letras em maiúsculas).
  //    Razão: pode ser um tipo customizado de outro dispositivo, ou um tipo
  //    que será adicionado à biblioteca no futuro. Silenciosamente mudar para
  //    'tomada_2pt' seria pior (perderia a intenção do levantamento).

  return {
    id:             inst.id             || generateId(),
    type,
    x:              inst.x              || 0,
    y:              inst.y              || 0,
    height:         inst.height         ?? null,
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

// ── ImageStore — IndexedDB para binários pesados ──────────────
// Fotos (photoPins[].photoData) e imagem de fundo (backgroundImage.data)
// ficam no IndexedDB (sem limite de 5 MB). O localStorage guarda apenas
// os metadados do projeto e referências (_photoRef / _dataRef).
//
// Fluxo de ESCRITA (Storage.save):
//   1. Storage._stripImages(project) → copia o projeto, remove base64,
//      armazena refs (_photoRef / _dataRef) — operação SÍNCRONA
//   2. O projeto "leve" vai pro localStorage normalmente
//   3. ImageStore.extractAndSave(project) salva as imagens no IndexedDB
//      em background (fire-and-forget) — o caller NÃO espera
//
// Fluxo de LEITURA (Storage.get + hydrateAsync):
//   1. Storage.get(id) → carrega do localStorage, devolve projeto com
//      photoData = null (mas _photoRef preenchido) — SÍNCRONO
//   2. Storage.hydrateAsync(project) → preenche photoData de volta do
//      IndexedDB — ASSÍNCRONO, chamado pelo canvas-editor após open()
//
// Compatibilidade retroativa:
//   Projetos antigos têm photoData como string base64 diretamente no
//   localStorage. Na próxima save() eles são migrados para IndexedDB
//   automaticamente. Até lá, o get() os devolve com photoData preenchido.

const ImageStore = {
  _DB_NAME:    'elle_levantamento_images',
  _DB_VERSION: 1,
  _STORE:      'images',
  _db:         null,

  _open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._DB_NAME, this._DB_VERSION);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(this._STORE, { keyPath: 'id' });
      };
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
      req.onerror   = e => reject(e.target.error);
    });
  },

  async put(id, dataUrl) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(this._STORE, 'readwrite');
      tx.objectStore(this._STORE).put({ id, dataUrl });
      tx.oncomplete = resolve;
      tx.onerror    = e => reject(e.target.error);
    });
  },

  async get(id) {
    if (!id) return null;
    try {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const req = db.transaction(this._STORE, 'readonly')
                      .objectStore(this._STORE).get(id);
        req.onsuccess = e => resolve(e.target.result ? e.target.result.dataUrl : null);
        req.onerror   = e => reject(e.target.error);
      });
    } catch {
      return null;
    }
  },

  async del(id) {
    if (!id) return;
    try {
      const db = await this._open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(this._STORE, 'readwrite');
        tx.objectStore(this._STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror    = e => reject(e.target.error);
      });
    } catch { /* ignore */ }
  },

  // Recebe o projeto EM MEMÓRIA (com base64 intacto).
  // Salva cada imagem no IndexedDB e retorna um mapa de refs.
  async extractAndSave(project) {
    const saves = [];
    const c = project.canvas;
    if (!c) return;

    for (const pin of (c.photoPins || [])) {
      if (pin.photoData && typeof pin.photoData === 'string' && pin.photoData.startsWith('data:')) {
        const ref = `img_${pin.id}`;
        saves.push(this.put(ref, pin.photoData));
      }
    }

    const bg = c.backgroundImage;
    if (bg && bg.data && typeof bg.data === 'string' && bg.data.startsWith('data:')) {
      const ref = `bg_${project.id}`;
      saves.push(this.put(ref, bg.data));
    }

    if (saves.length) await Promise.all(saves);
  },

  // Recarrega as imagens de volta no projeto (vindo do localStorage).
  // Chame após Storage.get() quando precisar exibir fotos.
  async loadImages(project) {
    const c = project.canvas;
    if (!c) return project;
    const loads = [];

    for (const pin of (c.photoPins || [])) {
      if (!pin.photoData && pin._photoRef) {
        loads.push(this.get(pin._photoRef).then(d => { pin.photoData = d; }));
      }
    }

    const bg = c.backgroundImage;
    if (bg && !bg.data && bg._dataRef) {
      loads.push(this.get(bg._dataRef).then(d => { bg.data = d; }));
    }

    if (loads.length) await Promise.all(loads);
    return project;
  },

  // Remove imagens do IndexedDB que não são mais referenciadas por nenhum projeto.
  async gc() {
    try {
      const all      = Storage.getAll();
      const usedRefs = new Set();
      for (const p of Object.values(all)) {
        for (const pin of (p.canvas?.photoPins || [])) {
          if (pin._photoRef) usedRefs.add(pin._photoRef);
        }
        const bgRef = p.canvas?.backgroundImage?._dataRef;
        if (bgRef) usedRefs.add(bgRef);
      }
      const db = await this._open();
      const keys = await new Promise((res, rej) => {
        const req = db.transaction(this._STORE, 'readonly').objectStore(this._STORE).getAllKeys();
        req.onsuccess = e => res(e.target.result);
        req.onerror   = e => rej(e.target.error);
      });
      const orphans = keys.filter(k => !usedRefs.has(k));
      await Promise.all(orphans.map(k => this.del(k)));
      return orphans.length;
    } catch {
      return 0;
    }
  },
};

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

  // Recarrega imagens pesadas do IndexedDB para o projeto (assíncrono).
  // Chamar após get() quando o canvas precisar exibir fotos.
  // Retorna Promise<project> com photoData e backgroundImage.data preenchidos.
  hydrateAsync(project) {
    return ImageStore.loadImages(project);
  },

  // Copia o projeto sem os binários pesados (base64).
  // Adiciona refs (_photoRef / _dataRef) para o IndexedDB.
  // Operação SÍNCRONA — não depende de I/O.
  _stripImages(project) {
    const p = JSON.parse(JSON.stringify(project));
    const c = p.canvas;
    if (!c) return p;

    for (const pin of (c.photoPins || [])) {
      if (pin.photoData && typeof pin.photoData === 'string' && pin.photoData.startsWith('data:')) {
        pin._photoRef = `img_${pin.id}`;
        pin.photoData = null;
      }
      // Retrocompat: se já estava em base64 curta (<200 chars = ícone SVG ou similar), mantém
    }

    const bg = c.backgroundImage;
    if (bg && bg.data && typeof bg.data === 'string' && bg.data.startsWith('data:')) {
      bg._dataRef = `bg_${project.id}`;
      bg.data     = null;
    }

    return p;
  },

  save(project) {
    const all = this.getAll();
    project.updatedAt = new Date().toISOString();

    // 1. Strip: retira base64 pesados e coloca refs
    const liteProject = this._stripImages(project);
    liteProject.updatedAt = project.updatedAt;

    all[liteProject.id] = liteProject;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('Storage quota exceeded:', e);
      return { error: 'quota', message: 'Espaço insuficiente. Exclua fotos antigas antes de continuar.' };
    }

    // 2. Salvar imagens no IndexedDB em background (fire-and-forget)
    ImageStore.extractAndSave(project).catch(err =>
      console.warn('ImageStore.extractAndSave falhou:', err)
    );

    return project;  // devolve o projeto ORIGINAL (com base64 em memória)
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
