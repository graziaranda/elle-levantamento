/* ═══════════════════════════════════════════
   Elle Levantamento — PDF Report (Módulo 5)
   Relatório de levantamento via Blob + print()
   ═══════════════════════════════════════════ */

const PdfReport = {

  generate(project, canvasDataUrl) {
    const c       = project.canvas;
    const dateStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    // ── Ambientes ─────────────────────────────
    const envRows = c.environments.map(env => {
      // area não é mais persistida — calcular do polígono
      const areaVal  = (env.polygon && env.polygon.length >= 3)
        ? polygonArea(env.polygon)
        : null;
      const areaM2   = areaVal != null ? (areaVal / 1e6).toFixed(2) : '—';
      const pd       = env.peDireito ? `${env.peDireito}m` : '—';
      const obs      = env.observation
        ? `<br><span style="color:#888;font-size:11px;">${esc(env.observation)}</span>`
        : '';
      return `<tr>
        <td>${esc(env.name || 'Ambiente')}${obs}</td>
        <td>${areaM2} m²</td>
        <td>${pd}</td>
      </tr>`;
    }).join('');

    // ── Instalações — agrupadas por categoria ──
    const byCategory = {};
    for (const inst of c.installations) {
      const entry    = getInstallEntry(inst.type);
      const cat      = entry ? entry.category : 'eletrica';
      const catLabel = this._catLabel(cat);
      if (!byCategory[catLabel]) byCategory[catLabel] = [];
      byCategory[catLabel].push({ inst, entry });
    }

    const instSections = Object.entries(byCategory).map(([cat, items]) => {
      const rows = items.map(({ inst, entry }) => {
        const symbol  = entry ? entry.symbol : inst.type.slice(0, 3).toUpperCase();
        const label   = entry ? entry.label  : inst.type;
        const code    = `${symbol}${inst.sequenceNumber}`;
        const height  = inst.height != null ? ` &nbsp;·&nbsp; h=${inst.height}cm` : '';
        const obs     = inst.observation
          ? ` &nbsp;·&nbsp; <em>${esc(inst.observation)}</em>`
          : '';
        return `<tr>
          <td><strong>${code}</strong></td>
          <td>${esc(label)}${height}${obs}</td>
        </tr>`;
      }).join('');
      return `<div class="cat-group">
        <div class="cat-title">${cat}</div>
        <table>
          <thead><tr><th>Código</th><th>Descrição</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join('');

    // ── Notas ─────────────────────────────────
    const noteRows = c.notes.map((n, i) =>
      `<tr><td>${i + 1}</td><td>${esc(n.text)}</td></tr>`
    ).join('');

    // ── Fotos ──────────────────────────────────
    const photosHtml = c.photoPins.filter(p => p.photoData).map(pin => {
      const anns    = (pin.annotations || []).length;
      const caption = pin.caption ? `<div class="photo-caption">${esc(pin.caption)}</div>` : '';
      const annBadge = anns > 0
        ? ` &nbsp;·&nbsp; ${anns} anotaç${anns === 1 ? 'ão' : 'ões'}`
        : '';
      return `
        <div class="photo-block">
          <div class="photo-label">F${pin.sequenceNumber}${annBadge}</div>
          ${caption}
          <img src="${pin.photoData}"
               style="max-width:100%;max-height:320px;object-fit:contain;display:block;">
        </div>`;
    }).join('');

    // ── Stats ──────────────────────────────────
    const nWalls  = c.walls.length;
    const nEnvs   = c.environments.length;
    const nInsts  = c.installations.length;
    const nPhotos = c.photoPins.filter(p => p.photoData).length;

    // ── HTML ───────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Levantamento — ${esc(project.name)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         color:#222; background:#fff; font-size:13px; }

  .print-bar { position:fixed; top:0; left:0; right:0; background:#f9f6f0;
    border-bottom:2px solid #C9A84C; display:flex; align-items:center;
    gap:10px; padding:10px 20px; z-index:999; }
  .print-bar h1 { font-size:14px; font-weight:600; flex:1; color:#333;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .btn-pdf { background:#C9A84C; color:#1a1814; border:none;
    padding:9px 20px; border-radius:6px; font-weight:700;
    cursor:pointer; font-size:13px; white-space:nowrap; }
  .btn-close { background:#eee; color:#444; border:none;
    padding:9px 14px; border-radius:6px; cursor:pointer; font-size:13px; }

  .page { max-width:860px; margin:0 auto; padding:70px 40px 60px; }

  .cover { min-height:calc(100vh - 70px); display:flex; flex-direction:column;
    justify-content:center; padding-bottom:60px; border-bottom:3px solid #C9A84C;
    margin-bottom:60px; }
  .cover-brand { font-size:11px; font-weight:700; letter-spacing:0.1em;
    text-transform:uppercase; color:#C9A84C; margin-bottom:32px; }
  .cover-title  { font-size:34px; font-weight:800; color:#1a1814; line-height:1.2; margin-bottom:10px; }
  .cover-client { font-size:16px; color:#555; margin-bottom:4px; }
  .cover-address { font-size:13px; color:#888; margin-bottom:40px; }
  .cover-stats  { display:flex; gap:20px; flex-wrap:wrap; }
  .stat    { background:#f9f6f0; padding:14px 20px; border-radius:8px; border-left:3px solid #C9A84C; }
  .stat-n  { font-size:22px; font-weight:800; color:#1a1814; }
  .stat-l  { font-size:10px; color:#888; font-weight:600;
    text-transform:uppercase; letter-spacing:0.08em; margin-top:2px; }
  .cover-date { margin-top:40px; font-size:11px; color:#aaa; }

  .section { margin-bottom:56px; page-break-inside:avoid; }
  .section-title { font-size:16px; font-weight:700; color:#1a1814;
    padding-bottom:8px; border-bottom:2px solid #C9A84C; margin-bottom:20px;
    display:flex; align-items:center; gap:10px; }
  .section-title .badge { background:#f9f6f0; font-size:11px;
    padding:2px 8px; border-radius:10px; color:#888; font-weight:600; }

  .cat-group { margin-bottom:20px; }
  .cat-title { font-size:10px; font-weight:700; text-transform:uppercase;
    letter-spacing:0.1em; color:#888; margin-bottom:8px; padding-left:2px; }

  table { width:100%; border-collapse:collapse; }
  th { background:#f9f6f0; text-align:left; padding:9px 12px;
    font-size:11px; font-weight:700; text-transform:uppercase;
    letter-spacing:0.08em; color:#888; }
  td { padding:9px 12px; border-bottom:1px solid #f0ece6;
    font-size:12px; vertical-align:top; }
  tr:last-child td { border-bottom:none; }

  .plan-img { width:100%; border:1px solid #e8e2d8; border-radius:4px; display:block; }

  .photos-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:20px; }
  .photo-block { page-break-inside:avoid; }
  .photo-label   { font-size:10px; font-weight:700; color:#888;
    text-transform:uppercase; letter-spacing:0.08em; margin-bottom:4px; }
  .photo-caption { font-size:11px; color:#555; margin-bottom:8px; font-style:italic; }

  @media print {
    .print-bar { display:none; }
    .page { padding-top:40px; }
    .section { page-break-inside:avoid; }
    .cover { page-break-after:always; }
    .photo-block { page-break-inside:avoid; }
  }
</style>
</head>
<body>

<div class="print-bar">
  <h1>${esc(project.name)} — Levantamento Arquitetônico</h1>
  <button class="btn-close" onclick="window.close()">✕ Fechar</button>
  <button class="btn-pdf" onclick="window.print()">⬇ Salvar como PDF</button>
</div>

<div class="page">

  <div class="cover">
    <div class="cover-brand">Elle Levantamento Arquitetônico</div>
    <div class="cover-title">${esc(project.name)}</div>
    ${project.client  ? `<div class="cover-client">${esc(project.client)}</div>` : ''}
    ${project.address ? `<div class="cover-address">${esc(project.address)}</div>` : ''}
    <div class="cover-stats">
      ${nWalls  > 0 ? `<div class="stat"><div class="stat-n">${nWalls}</div><div class="stat-l">Paredes</div></div>` : ''}
      ${nEnvs   > 0 ? `<div class="stat"><div class="stat-n">${nEnvs}</div><div class="stat-l">Ambientes</div></div>` : ''}
      ${nInsts  > 0 ? `<div class="stat"><div class="stat-n">${nInsts}</div><div class="stat-l">Instalações</div></div>` : ''}
      ${nPhotos > 0 ? `<div class="stat"><div class="stat-n">${nPhotos}</div><div class="stat-l">Fotos</div></div>` : ''}
    </div>
    <div class="cover-date">Gerado em ${dateStr}</div>
  </div>

  ${canvasDataUrl ? `
  <div class="section">
    <div class="section-title">Planta — Levantamento</div>
    <img class="plan-img" src="${canvasDataUrl}" alt="Planta levantamento">
  </div>` : ''}

  ${c.environments.length > 0 ? `
  <div class="section">
    <div class="section-title">Ambientes <span class="badge">${c.environments.length}</span></div>
    <table>
      <thead><tr><th>Ambiente</th><th>Área</th><th>Pé-direito</th></tr></thead>
      <tbody>${envRows}</tbody>
    </table>
  </div>` : ''}

  ${c.installations.length > 0 ? `
  <div class="section">
    <div class="section-title">Instalações <span class="badge">${c.installations.length}</span></div>
    ${instSections}
  </div>` : ''}

  ${c.notes.length > 0 ? `
  <div class="section">
    <div class="section-title">Notas <span class="badge">${c.notes.length}</span></div>
    <table>
      <thead><tr><th>#</th><th>Texto</th></tr></thead>
      <tbody>${noteRows}</tbody>
    </table>
  </div>` : ''}

  ${photosHtml ? `
  <div class="section">
    <div class="section-title">Fotos <span class="badge">${nPhotos}</span></div>
    <div class="photos-grid">${photosHtml}</div>
  </div>` : ''}

</div>
</body>
</html>`;

    // Gera via Blob + anchor (evita bloqueio de pop-up no iOS Safari/Chrome)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href   = url;
    a.target = '_blank';
    a.rel    = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revogar após delay para dar tempo do browser abrir
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  // ── Helpers ───────────────────────────────────

  // Label PT-BR da categoria de instalação
  _catLabel(category) {
    const MAP = {
      eletrica:    'Elétrica',
      hidraulica:  'Hidráulica / Gás',
      odonto:      'Odontológico',
      restaurante: 'Restaurante',
    };
    return MAP[category] || category;
  },
};
