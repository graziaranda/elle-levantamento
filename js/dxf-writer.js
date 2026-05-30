/* ═══════════════════════════════════════════
   Elle Levantamento — DXF Writer (manual)
   Gera DXF ASCII 2D compatível com AutoCAD / SketchUp
   Unidades: milímetros (INSUNITS=4)
   ═══════════════════════════════════════════ */

const DxfWriter = {

  generate(project) {
    const c = project.canvas;
    const L = [];  // lines buffer

    this._header(L);
    this._tables(L);
    this._entities(L, c);
    L.push('0', 'EOF');

    return L.join('\r\n');
  },

  // ── Header ───────────────────────────────

  _header(L) {
    L.push(
      '0', 'SECTION', '2', 'HEADER',
      '9', '$ACADVER', '1', 'AC1015',
      '9', '$INSUNITS', '70', '4',     // 4 = mm
      '9', '$MEASUREMENT', '70', '1',  // metric
      '9', '$EXTMIN', '10', '0', '20', '0', '30', '0',
      '9', '$EXTMAX', '10', '50000', '20', '50000', '30', '0',
      '0', 'ENDSEC'
    );
  },

  // ── Tables (layer definitions) ───────────

  _tables(L) {
    L.push('0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '8');

    const layers = [
      ['PAREDES',    7, 'CONTINUOUS'],
      ['ABERTURAS',  3, 'CONTINUOUS'],
      ['ELETRICA',   2, 'CONTINUOUS'],
      ['HIDRAULICA', 5, 'CONTINUOUS'],
      ['COTAS',      1, 'CONTINUOUS'],
      ['TEXTO',      6, 'CONTINUOUS'],
      ['AMBIENTES',  4, 'CONTINUOUS'],
    ];

    for (const [name, color, ltype] of layers) {
      L.push('0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', ltype);
    }

    L.push('0', 'ENDTAB', '0', 'ENDSEC');
  },

  // ── Entities ─────────────────────────────

  _entities(L, c) {
    L.push('0', 'SECTION', '2', 'ENTITIES');

    // Walls — each wall drawn as two parallel lines + caps
    for (const w of (c.walls || [])) {
      const t = (w.thickness || 150) / 2;
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!len) continue;
      const nx = -dy / len * t;
      const ny = dx / len * t;

      this._line(L, 'PAREDES', w.x1 + nx, w.y1 + ny, w.x2 + nx, w.y2 + ny);
      this._line(L, 'PAREDES', w.x1 - nx, w.y1 - ny, w.x2 - nx, w.y2 - ny);
      this._line(L, 'PAREDES', w.x1 + nx, w.y1 + ny, w.x1 - nx, w.y1 - ny);
      this._line(L, 'PAREDES', w.x2 + nx, w.y2 + ny, w.x2 - nx, w.y2 - ny);
    }

    // Openings
    for (const o of (c.openings || [])) {
      const w = (c.walls || []).find(w => w.id === o.wallId);
      if (!w) continue;
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (!len) continue;
      const nx = dx / len;
      const ny = dy / len;
      const cx = w.x1 + dx * o.position;
      const cy = w.y1 + dy * o.position;
      const half = (o.width || 900) / 2;

      if (o.type === 'door') {
        this._line(L, 'ABERTURAS', cx - nx * half, cy - ny * half, cx + nx * half, cy + ny * half);
        // Door swing arc (approximated as 3 segments)
        const side = o.side === 'left' ? -1 : 1;
        const perpX = -ny * side;
        const perpY = nx * side;
        const hinge = { x: cx + nx * half, y: cy + ny * half };
        this._arc(L, 'ABERTURAS', hinge.x, hinge.y, o.width, 180 + Math.atan2(ny, nx) * 180 / Math.PI, 90);
      } else {
        // Window: triple line symbol
        const perp = { x: -ny * 40, y: nx * 40 };
        for (const off of [-1, 0, 1]) {
          this._line(L, 'ABERTURAS',
            cx - nx * half + perp.x * off, cy - ny * half + perp.y * off,
            cx + nx * half + perp.x * off, cy + ny * half + perp.y * off
          );
        }
      }
    }

    // Dimensions
    for (const d of (c.dimensions || [])) {
      const measured = Math.round(Math.sqrt((d.x2 - d.x1) ** 2 + (d.y2 - d.y1) ** 2));
      const val = d.value != null ? d.value : measured;
      this._dimension(L, d, val);
    }

    // Environment names, areas and pé-direito
    for (const env of (c.environments || [])) {
      if (env.centroid) {
        this._text(L, 'AMBIENTES', env.centroid.x, env.centroid.y, env.name || 'Ambiente', 250);
        if (env.area != null) {
          const areaM2 = (env.area / 1e6).toFixed(2);
          this._text(L, 'AMBIENTES', env.centroid.x, env.centroid.y - 350, `${areaM2}m²`, 180);
        }
        if (env.peDireito) {
          this._text(L, 'AMBIENTES', env.centroid.x, env.centroid.y - 700, `pd=${env.peDireito}m`, 140);
        }
        // Draw polygon outline
        if (env.polygon && env.polygon.length >= 3) {
          for (let i = 0; i < env.polygon.length; i++) {
            const a = env.polygon[i];
            const b = env.polygon[(i + 1) % env.polygon.length];
            this._line(L, 'AMBIENTES', a.x, a.y, b.x, b.y);
          }
        }
      }
    }

    // Installation points
    const ELEC = new Set(['tomada110','tomada220','interruptor','luzTeto','luzParede','dados','splitInterno','splitExterno']);
    for (const inst of (c.installations || [])) {
      const layer = ELEC.has(inst.type) ? 'ELETRICA' : 'HIDRAULICA';
      const r = 120;
      this._circle(L, layer, inst.x, inst.y, r);
      const code = this._instCode(inst.type);
      this._text(L, layer, inst.x - 80, inst.y - 80, `${code}${inst.sequenceNumber}`, 160);
      if (inst.height) {
        this._text(L, layer, inst.x - 80, inst.y - 300, `h=${inst.height}cm`, 120);
      }
    }

    // Notes
    for (const note of (c.notes || [])) {
      this._text(L, 'TEXTO', note.x, note.y, note.text, 180);
    }

    // Photo pin markers
    for (const pin of (c.photoPins || [])) {
      this._circle(L, 'TEXTO', pin.x, pin.y, 100);
      this._text(L, 'TEXTO', pin.x - 60, pin.y - 60, `F${pin.sequenceNumber}`, 140);
    }

    L.push('0', 'ENDSEC');
  },

  // ── Primitives ────────────────────────────

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

  _dimension(L, d, valueMm) {
    const dx = d.x2 - d.x1;
    const dy = d.y2 - d.y1;
    const lenPx = Math.sqrt(dx * dx + dy * dy);
    if (!lenPx) return;

    const nx = dx / lenPx;
    const ny = dy / lenPx;
    const perp = { x: -ny, y: nx };
    const off = d.offset || 400;

    // Dimension line
    const p1 = { x: d.x1 + perp.x * off, y: d.y1 + perp.y * off };
    const p2 = { x: d.x2 + perp.x * off, y: d.y2 + perp.y * off };
    this._line(L, 'COTAS', p1.x, p1.y, p2.x, p2.y);

    // Extension lines
    this._line(L, 'COTAS', d.x1, d.y1, p1.x, p1.y);
    this._line(L, 'COTAS', d.x2, d.y2, p2.x, p2.y);

    // Tick marks
    const tickSize = 80;
    for (const pt of [p1, p2]) {
      this._line(L, 'COTAS',
        pt.x - perp.x * tickSize, pt.y - perp.y * tickSize,
        pt.x + perp.x * tickSize, pt.y + perp.y * tickSize
      );
    }

    // Value label
    const label = valueMm >= 1000
      ? `${(valueMm / 1000).toFixed(3).replace('.', ',')}m`
      : `${Math.round(valueMm)}mm`;
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    this._text(L, 'COTAS', mx + perp.x * 100, my + perp.y * 100, label, 200);
  },

  // ── Helpers ───────────────────────────────

  _instCode(type) {
    const MAP = {
      tomada110: 'T', tomada220: 'T2', interruptor: 'I',
      luzTeto: 'L', luzParede: 'LP', dados: 'D',
      splitInterno: 'AR', splitExterno: 'AR-E',
      aguaFria: 'AF', aguaQuente: 'AQ', ralo: 'RA',
      esgoto: 'ES', gas: 'G',
    };
    return MAP[type] || 'X';
  },

  // ── Public export helper ─────────────────

  download(project) {
    const dxf = this.generate(project);
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${project.name.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_')}_levantamento.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
