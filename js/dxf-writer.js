/* ═══════════════════════════════════════════
   Elle Levantamento — DXF Writer
   Gera DXF ASCII 2D — AutoCAD R2000 (AC1015)
   Unidades: milímetros (INSUNITS=4)
   ═══════════════════════════════════════════ */

const DxfWriter = {

  generate(project) {
    const c = project.canvas;
    const L = [];

    const bbox = this._calcBbox(c);

    this._header(L, bbox);
    this._tables(L, c);
    this._blocks(L, c);   // seção BLOCKS com blocos anônimos das cotas
    this._entities(L, c);
    L.push('0', 'EOF');

    return L.join('\r\n');
  },

  // ── Bounding box dinâmica ────────────────────
  // Evita o bug de "planta minúscula ao abrir" causado pelo extents hardcoded.

  _calcBbox(c) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (x, y) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    };
    for (const w of (c.walls || []))         { add(w.x1, w.y1); add(w.x2, w.y2); }
    for (const i of (c.installations || [])) { add(i.x, i.y); }
    for (const n of (c.notes || []))         { add(n.x, n.y); }
    for (const p of (c.photoPins || []))     { add(p.x, p.y); }
    for (const e of (c.environments || []))  { for (const pt of (e.polygon || [])) add(pt.x, pt.y); }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 50000; maxY = 50000; }
    const pad = 1000;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  },

  // ── Header ───────────────────────────────────

  _header(L, bbox) {
    L.push(
      '0', 'SECTION', '2', 'HEADER',
      '9', '$ACADVER',    '1', 'AC1015',
      '9', '$INSUNITS',   '70', '4',    // mm
      '9', '$MEASUREMENT','70', '1',    // metric
      '9', '$EXTMIN',
        '10', bbox.minX.toFixed(1),
        '20', (-bbox.maxY).toFixed(1),  // Y invertido
        '30', '0',
      '9', '$EXTMAX',
        '10', bbox.maxX.toFixed(1),
        '20', (-bbox.minY).toFixed(1),
        '30', '0',
      '0', 'ENDSEC'
    );
  },

  // ── Tables (layer definitions) ───────────────
  // Layers separadas para elétrica, hidráulica, odonto, notas e fotos.

  _tables(L, c) {
    // Determinar se há instalações odonto no canvas
    const hasOdonto = (c.installations || []).some(i => {
      const e = getInstallEntry(i.type);
      return e && e.pack === 'odonto';
    });

    const layers = [
      ['PAREDES',    7, 'CONTINUOUS'],
      ['ABERTURAS',  3, 'CONTINUOUS'],
      ['ELETRICA',   2, 'CONTINUOUS'],
      ['HIDRAULICA', 5, 'CONTINUOUS'],
      ['COTAS',      1, 'CONTINUOUS'],
      ['AMBIENTES',  4, 'CONTINUOUS'],
      ['NOTAS',      6, 'CONTINUOUS'],   // separado de FOTOS
      ['FOTOS',      6, 'CONTINUOUS'],   // separado de NOTAS
    ];

    if (hasOdonto) layers.push(['ODONTO', 3, 'CONTINUOUS']);

    L.push('0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER',
      '70', String(layers.length));

    for (const [name, color, ltype] of layers) {
      L.push('0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', ltype);
    }

    L.push('0', 'ENDTAB', '0', 'ENDSEC');
  },

  // ── Entities ─────────────────────────────────

  _entities(L, c) {
    L.push('0', 'SECTION', '2', 'ENTITIES');

    this._writeWalls(L, c);
    this._writeOpenings(L, c);
    this._writeDimensions(L, c);
    this._writeEnvironments(L, c);
    this._writeInstallations(L, c);
    this._writeNotes(L, c);
    this._writePhotoPins(L, c);

    L.push('0', 'ENDSEC');
  },

  // ── Paredes ───────────────────────────────────

  _writeWalls(L, c) {
    for (const w of (c.walls || [])) {
      const t = (w.thickness || 150) / 2;
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!len) continue;
      const nx = -dy / len * t, ny = dx / len * t;

      this._line(L, 'PAREDES', w.x1 + nx, w.y1 + ny, w.x2 + nx, w.y2 + ny);
      this._line(L, 'PAREDES', w.x1 - nx, w.y1 - ny, w.x2 - nx, w.y2 - ny);
      this._line(L, 'PAREDES', w.x1 + nx, w.y1 + ny, w.x1 - nx, w.y1 - ny);
      this._line(L, 'PAREDES', w.x2 + nx, w.y2 + ny, w.x2 - nx, w.y2 - ny);
    }
  },

  // ── Aberturas (porta/janela) ─────────────────
  // O arco de porta usa a mesma lógica geométrica do canvas-editor
  // via _doorGeometry() para garantir consistência entre o que o
  // usuário vê e o que sai no DXF.

  _writeOpenings(L, c) {
    for (const o of (c.openings || [])) {
      const w = (c.walls || []).find(w => w.id === o.wallId);
      if (!w) continue;
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!len) continue;
      const nx = dx / len, ny = dy / len;
      const cx = w.x1 + dx * o.position;
      const cy = w.y1 + dy * o.position;
      const half = (o.width || 900) / 2;

      // Linha do vão (apaga a parede visualmente no canvas, representa o vão no DXF)
      this._line(L, 'ABERTURAS', cx - nx * half, cy - ny * half, cx + nx * half, cy + ny * half);

      if (o.type === 'door') {
        const geo = this._doorGeometry(cx, cy, nx, ny, o);
        this._arc(L, 'ABERTURAS', geo.hx, geo.hy, o.width || 900, geo.startDeg, geo.sweepDeg);
      } else {
        // Janela: linha tripla
        const perpX = -ny * 40, perpY = nx * 40;
        for (const k of [-1, 0, 1]) {
          this._line(L, 'ABERTURAS',
            cx - nx * half + perpX * k, cy - ny * half + perpY * k,
            cx + nx * half + perpX * k, cy + ny * half + perpY * k
          );
        }
      }
    }
  },

  // Calcula geometria do arco de porta.
  // Compartilha a lógica com canvas-editor._drawSingleOpening para garantir
  // que o arco no DXF bate com o arco na tela.
  _doorGeometry(cx, cy, nx, ny, o) {
    const side = (o.hingeSide === 'left' || o.side === 'left') ? 1 : -1;
    const half  = (o.width || 900) / 2;

    // Ponto da dobradiça (extremidade da parede onde fica a dobradiça)
    const hx = cx + nx * half * (side > 0 ? -1 : 1);
    const hy = cy + ny * half * (side > 0 ? -1 : 1);

    // Direção perpendicular (define para qual lado abre)
    const openSide = (o.openDir === 'out') ? -side : side;
    const perpX = -ny * openSide;
    const perpY =  nx * openSide;

    // Ângulo base em graus (no espaço DXF: Y invertido)
    // atan2 no espaço canvas → inverte ny para DXF
    const baseAngleDeg = Math.atan2(-perpY, perpX) * 180 / Math.PI;
    const startDeg = baseAngleDeg;
    const sweepDeg = 90;

    return { hx, hy, startDeg, sweepDeg };
  },

  // ── Dimensões (cotas) ─────────────────────────
  // Gera entidade DIMENSION nativa (AC1015 = AutoCAD R2000).
  // A entidade referencia um bloco anônimo *Dn que contém a geometria visual
  // como fallback para viewers que não processam DIMENSION nativamente.

  _writeDimensions(L, c) {
    const dims = c.dimensions || [];
    for (let i = 0; i < dims.length; i++) {
      const d = dims[i];
      const measuredMm = Math.sqrt((d.x2 - d.x1) ** 2 + (d.y2 - d.y1) ** 2);
      const val = (d.value != null) ? d.value : Math.round(measuredMm);
      this._dimEntity(L, d, val, i + 1);
    }
  },

  // ── Ambientes ─────────────────────────────────

  _writeEnvironments(L, c) {
    for (const env of (c.environments || [])) {
      // Contorno do polígono
      if (env.polygon && env.polygon.length >= 3) {
        for (let i = 0; i < env.polygon.length; i++) {
          const a = env.polygon[i];
          const b = env.polygon[(i + 1) % env.polygon.length];
          this._line(L, 'AMBIENTES', a.x, a.y, b.x, b.y);
        }
      }
      // Labels no centroide (calculado aqui pois não é mais persistido)
      if (env.polygon && env.polygon.length >= 3) {
        const cen = polygonCentroid(env.polygon);
        this._text(L, 'AMBIENTES', cen.x, cen.y, env.name || 'Ambiente', 250);

        const area = polygonArea(env.polygon);
        if (area > 0) {
          const areaM2 = (area / 1e6).toFixed(2);
          this._text(L, 'AMBIENTES', cen.x, cen.y - 350, `${areaM2}m²`, 180);
        }
        if (env.peDireito) {
          this._text(L, 'AMBIENTES', cen.x, cen.y - 700, `pd=${env.peDireito}m`, 140);
        }
      }
    }
  },

  // ── Instalações ───────────────────────────────
  // Usa INSTALLATION_LIBRARY para símbolo e layer corretos.
  // Fallback para tipos legados não mapeados.

  _writeInstallations(L, c) {
    const r = 120;
    for (const inst of (c.installations || [])) {
      const entry  = getInstallEntry(inst.type);
      const layer  = entry ? entry.layerDXF : 'ELETRICA';
      const symbol = entry ? entry.symbol   : inst.type.slice(0, 3).toUpperCase();
      const code   = `${symbol}${inst.sequenceNumber}`;

      this._circle(L, layer, inst.x, inst.y, r);
      this._text(L, layer, inst.x - 80, inst.y - 80, code, 160);
      if (inst.height != null) {
        this._text(L, layer, inst.x - 80, inst.y - 300, `h=${inst.height}cm`, 120);
      }
    }
  },

  // ── Notas e Fotos em layers separadas ─────────

  _writeNotes(L, c) {
    for (const note of (c.notes || [])) {
      this._text(L, 'NOTAS', note.x, note.y, note.text, 180);
    }
  },

  _writePhotoPins(L, c) {
    for (const pin of (c.photoPins || [])) {
      this._circle(L, 'FOTOS', pin.x, pin.y, 100);
      this._text(L, 'FOTOS', pin.x - 60, pin.y - 60, `F${pin.sequenceNumber}`, 140);
      if (pin.caption) {
        this._text(L, 'FOTOS', pin.x - 60, pin.y - 280, pin.caption, 120);
      }
    }
  },

  // ── Primitivas DXF ────────────────────────────
  // Todas as coordenadas Y são invertidas (canvas Y-down → DXF Y-up).

  _line(L, layer, x1, y1, x2, y2) {
    L.push(
      '0', 'LINE', '8', layer,
      '10', x1.toFixed(1), '20', (-y1).toFixed(1), '30', '0',
      '11', x2.toFixed(1), '21', (-y2).toFixed(1), '31', '0'
    );
  },

  _circle(L, layer, cx, cy, r) {
    L.push(
      '0', 'CIRCLE', '8', layer,
      '10', cx.toFixed(1), '20', (-cy).toFixed(1), '30', '0',
      '40', r.toFixed(1)
    );
  },

  // startAngle e sweepAngle em graus, no espaço DXF (Y-up).
  _arc(L, layer, cx, cy, r, startAngle, sweepAngle) {
    const endAngle = startAngle + sweepAngle;
    L.push(
      '0', 'ARC', '8', layer,
      '10', cx.toFixed(1), '20', (-cy).toFixed(1), '30', '0',
      '40', r.toFixed(1),
      '50', startAngle.toFixed(2),
      '51', endAngle.toFixed(2)
    );
  },

  _text(L, layer, x, y, text, height) {
    L.push(
      '0', 'TEXT', '8', layer,
      '10', x.toFixed(1), '20', (-y).toFixed(1), '30', '0',
      '40', height.toFixed(1),
      '1', String(text)
    );
  },

  // Entidade DIMENSION nativa DXF R2000 (AC1015) — tipo 1 = aligned linear.
  // n: índice 1-based para nomear o bloco anônimo (*D1, *D2, ...).
  //
  // Grupos de código usados:
  //   100 AcDbEntity + AcDbDimension + AcDbAlignedDimension
  //   2  → nome do bloco anônimo com a geometria visual (fallback)
  //   10/20 → ponto do texto (inserção, espaço DXF Y-up)
  //   11/21 → ponto do texto (coincide com 10/20 para aligned)
  //   70  → flags: 1 = aligned linear
  //   1   → texto sobreposto (vazio = auto); usa label se definido
  //   42  → medida real em mm (usada pelo AutoCAD para verificar texto sobreposto)
  //   13/23 → ponto de definição 1 (xdef1, espaço DXF)
  //   14/24 → ponto de definição 2 (xdef2, espaço DXF)
  _dimEntity(L, d, valueMm, n) {
    const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (!len) return;

    const off  = d.offset || 400;
    const nx = dx / len, ny = dy / len;
    const perp = { x: -ny, y: nx };

    // Pontos no espaço DXF (Y invertido: dxfY = -canvasY)
    const x1d  = d.x1,           y1d = -d.y1;
    const x2d  = d.x2,           y2d = -d.y2;
    const p1dx = d.x1 + perp.x * off, p1dy = -(d.y1 + perp.y * off);
    const p2dx = d.x2 + perp.x * off, p2dy = -(d.y2 + perp.y * off);
    const txd  = (p1dx + p2dx) / 2;   // midpoint da linha de cota (AutoCAD posiciona o texto)
    const tyd  = (p1dy + p2dy) / 2;

    const blockName = `*D${n}`;
    const labelText = d.label ? String(d.label) : '';   // vazio = AutoCAD usa a medida automática

    L.push(
      '0', 'DIMENSION',
      '100', 'AcDbEntity',
      '8',   'COTAS',
      '100', 'AcDbDimension',
      '2',   blockName,           // bloco anônimo com geometria visual (fallback)
      '10',  txd.toFixed(1), '20', tyd.toFixed(1), '30', '0',
      '11',  txd.toFixed(1), '21', tyd.toFixed(1), '31', '0',
      '70',  '1',                 // 1 = aligned linear
      '1',   labelText,           // texto sobreposto (vazio = usa 42 automaticamente)
      '42',  valueMm.toFixed(1),  // valor real em mm
      '100', 'AcDbAlignedDimension',
      '13',  x1d.toFixed(1), '23', y1d.toFixed(1), '33', '0',
      '14',  x2d.toFixed(1), '24', y2d.toFixed(1), '34', '0'
    );
  },

  // Seção BLOCKS — blocos anônimos com geometria visual das cotas.
  // Viewers que não processam a entidade DIMENSION usam o bloco como fallback.
  _blocks(L, c) {
    L.push('0', 'SECTION', '2', 'BLOCKS');

    // Bloco MODEL_SPACE obrigatório em AC1015
    L.push(
      '0', 'BLOCK', '2', '*Model_Space', '70', '0',
      '10', '0', '20', '0', '30', '0', '3', '', '1', '',
      '0', 'ENDBLK'
    );
    L.push(
      '0', 'BLOCK', '2', '*Paper_Space', '70', '0',
      '10', '0', '20', '0', '30', '0', '3', '', '1', '',
      '0', 'ENDBLK'
    );

    // Um bloco por cota
    const dims = c.dimensions || [];
    for (let i = 0; i < dims.length; i++) {
      const d = dims[i];
      const n = i + 1;
      const measuredMm = Math.sqrt((d.x2 - d.x1) ** 2 + (d.y2 - d.y1) ** 2);
      const val = (d.value != null) ? d.value : Math.round(measuredMm);
      this._dimBlock(L, d, val, n);
    }

    L.push('0', 'ENDSEC');
  },

  // Bloco anônimo *Dn — contém a geometria visual (fallback) da cota n.
  // Mesmo algoritmo do antigo _dimension(), usando coordenadas relativas à origem do bloco.
  _dimBlock(L, d, valueMm, n) {
    const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (!len) return;

    const off  = d.offset || 400;
    const nx = dx / len, ny = dy / len;
    const perp = { x: -ny, y: nx };

    const p1 = { x: d.x1 + perp.x * off, y: d.y1 + perp.y * off };
    const p2 = { x: d.x2 + perp.x * off, y: d.y2 + perp.y * off };
    const mx  = (p1.x + p2.x) / 2 + perp.x * 100;
    const my  = (p1.y + p2.y) / 2 + perp.y * 100;
    const labelText = d.label || fmtMm(valueMm);
    const tick = 80;

    L.push(
      '0', 'BLOCK',
      '2',   `*D${n}`,
      '70',  '4',    // 4 = anonymous block (flag)
      '10',  '0', '20', '0', '30', '0',
      '3',   '', '1', ''
    );

    // Linha de cota
    this._line(L, 'COTAS', p1.x, p1.y, p2.x, p2.y);
    // Linhas de extensão
    this._line(L, 'COTAS', d.x1, d.y1, p1.x, p1.y);
    this._line(L, 'COTAS', d.x2, d.y2, p2.x, p2.y);
    // Ticks
    for (const pt of [p1, p2]) {
      this._line(L, 'COTAS',
        pt.x - perp.x * tick, pt.y - perp.y * tick,
        pt.x + perp.x * tick, pt.y + perp.y * tick
      );
    }
    // Texto
    this._text(L, 'COTAS', mx, my, labelText, 200);

    L.push('0', 'ENDBLK');
  },

  // ── Export ────────────────────────────────────

  download(project) {
    const dxf  = this.generate(project);
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${project.name.replace(/[^\w\s\-]/gi, '').replace(/\s+/g, '_')}_levantamento.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
