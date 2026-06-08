/* ═══════════════════════════════════════════
   Elle Levantamento — Dashboard (Módulo 1)
   Lista de projetos, criar, exportar, excluir
   ═══════════════════════════════════════════ */

const Dashboard = {

  render() {
    const projects = Storage.getList();
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="dashboard">
        <header class="dash-header">
          <div class="dash-logo">
            ${this._logoSvg()}
            <span class="dash-logo-text">Elle <strong>Levantamento</strong></span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${projects.length > 0 ? `<span style="font-size:10px; color:var(--text-faint);">${Storage.storageUsedKb()} KB</span>` : ''}
            <button class="btn-primary" id="btn-novo">
              ${this._iconPlus()}
              Novo levantamento
            </button>
          </div>
        </header>
        <main class="dash-main">
          ${projects.length === 0 ? this._renderEmpty() : this._renderGrid(projects)}
        </main>
      </div>
    `;

    document.getElementById('btn-novo').addEventListener('click', () => this._openNewModal());
    this._bindCards();
  },

  // ── Grid & Cards ─────────────────────────

  _renderEmpty() {
    return `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect x="8" y="8" width="36" height="36" rx="4" stroke="#4A3F32" stroke-width="2"/>
            <path d="M17 35L26 20L35 35" stroke="#4A3F32" stroke-width="2" stroke-linejoin="round"/>
            <path d="M21.5 35L26 27L30.5 35" stroke="#4A3F32" stroke-width="1.5" stroke-linejoin="round" opacity="0.6"/>
            <path d="M13 42h26" stroke="#4A3F32" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
          </svg>
        </div>
        <p class="empty-title">Nenhum levantamento salvo</p>
        <p class="empty-sub">Clique em "Novo levantamento" para começar</p>
      </div>
    `;
  },

  _renderGrid(projects) {
    return `<div class="proj-grid">${projects.map(p => this._renderCard(p)).join('')}</div>`;
  },

  _renderCard(p) {
    const d = new Date(p.updatedAt);
    const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    // Suporta índice novo (_wallCount) e formato antigo (canvas.walls.length)
    const walls = p._wallCount ?? p.canvas?.walls?.length ?? 0;
    const insts = p._instCount ?? p.canvas?.installations?.length ?? 0;
    const envs  = p._envCount  ?? p.canvas?.environments?.length ?? 0;

    let stats = 'novo';
    if (walls > 0 || insts > 0 || envs > 0) {
      const parts = [];
      if (walls > 0)  parts.push(`${walls} parede${walls !== 1 ? 's' : ''}`);
      if (envs > 0)   parts.push(`${envs} amb.`);
      if (insts > 0)  parts.push(`${insts} inst.`);
      stats = parts.join(' · ');
    }

    return `
      <article class="proj-card" data-id="${esc(p.id)}">
        <div class="proj-card-thumb" data-action="open" data-id="${esc(p.id)}">
          ${p.thumbnail
            ? `<img src="${esc(p.thumbnail)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`
            : this._thumbPlaceholder(p)}
        </div>
        <div class="proj-card-body">
          <div class="proj-card-name">${esc(p.name)}</div>
          ${p.client ? `<div class="proj-card-client">${esc(p.client)}</div>` : ''}
          ${p.address ? `<div class="proj-card-address">${esc(p.address)}</div>` : ''}
          <div class="proj-card-meta">
            <span>${dateStr} ${timeStr}</span>
            <span>${stats}</span>
          </div>
          <div class="proj-card-actions">
            <button class="btn-card-primary" data-action="open" data-id="${esc(p.id)}">Abrir</button>
            <button class="btn-card-icon" data-action="dxf" data-id="${esc(p.id)}" title="Exportar DXF">
              ${this._iconDownload()} DXF
            </button>
            <button class="btn-card-icon" data-action="elle" data-id="${esc(p.id)}" title="Exportar backup .elle">
              ${this._iconDownload()} .elle
            </button>
            <button class="btn-card-icon btn-danger" data-action="delete" data-id="${esc(p.id)}" title="Excluir">
              ${this._iconTrash()}
            </button>
          </div>
        </div>
      </article>
    `;
  },

  _thumbPlaceholder(p) {
    const initials = p.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    const safeId = p.id.replace(/-/g, '');
    return `
      <div class="proj-thumb-placeholder">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="g${safeId}" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0L0 0 0 16" fill="none" stroke="#3D3226" stroke-width="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#g${safeId})"/>
        </svg>
        <span class="proj-thumb-initials">${esc(initials)}</span>
      </div>
    `;
  },

  _bindCards() {
    document.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const { action, id } = el.dataset;
        if (action === 'open')   App.openProject(id);
        if (action === 'dxf')    this._exportDxf(id);
        if (action === 'elle')   this._exportElle(id);
        if (action === 'delete') this._confirmDelete(id);
      });
    });
  },

  // ── New project modal ─────────────────────

  _openNewModal() {
    Modal.open(`
      <div class="modal-header">
        <h2 class="modal-title">Novo levantamento</h2>
        <button class="modal-close" id="mc">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <form class="modal-form" id="new-proj-form" autocomplete="off">
        <div class="form-group">
          <label class="form-label">Nome do projeto <span class="required">*</span></label>
          <input class="form-input" type="text" name="name"
            placeholder="Ex: Clínica Sorriso — Consultório Principal" required autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Cliente</label>
          <input class="form-input" type="text" name="client" placeholder="Ex: Dr. Paulo Mendes">
        </div>
        <div class="form-group">
          <label class="form-label">Endereço</label>
          <input class="form-input" type="text" name="address"
            placeholder="Ex: Rua das Flores, 123 — Curitiba/PR">
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-ghost" id="mc-cancel">Cancelar</button>
          <button type="submit" class="btn-primary">Criar levantamento</button>
        </div>
      </form>
    `);

    document.getElementById('mc').addEventListener('click', () => Modal.close());
    document.getElementById('mc-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('new-proj-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = (fd.get('name') || '').trim();
      if (!name) return;
      const project = createProject(name, fd.get('client') || '', fd.get('address') || '');
      Storage.save(project);
      Modal.close();
      App.openProject(project.id);
    });
  },

  // ── Delete confirm ────────────────────────

  _confirmDelete(id) {
    // Usa o índice síncrono do localStorage — só precisamos do nome para o modal.
    const idx = Storage.getAll()[id];
    if (!idx) return;
    Modal.open(`
      <div class="modal-header">
        <h2 class="modal-title">Excluir levantamento</h2>
      </div>
      <div class="modal-body">
        <p class="confirm-text">Excluir <strong>${esc(idx.name)}</strong>?</p>
        <p class="confirm-sub">Esta ação não pode ser desfeita. O projeto e todos os dados serão perdidos.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="mc-cancel">Cancelar</button>
        <button class="btn-danger-solid" id="mc-confirm">Excluir</button>
      </div>
    `);
    document.getElementById('mc-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('mc-confirm').addEventListener('click', () => {
      Storage.delete(id);
      Modal.close();
      Toast.show('Levantamento excluído', 'info');
      this.render();
    });
  },

  // ── DXF Export ────────────────────────────

  async _exportDxf(id) {
    try {
      const p = await Storage.get(id);
      if (!p) return;
      DxfWriter.download(p);
      Toast.show('DXF exportado', 'success');
    } catch (e) {
      Toast.show('Erro ao gerar DXF', 'error');
      console.error(e);
    }
  },

  // ── .elle Export ──────────────────────────

  async _exportElle(id) {
    try {
      Toast.show('Preparando backup…', 'info', 2000);
      await Storage.exportElle(id);
      Toast.show('Backup .elle exportado', 'success');
    } catch (e) {
      Toast.show('Erro ao exportar .elle', 'error');
      console.error(e);
    }
  },

  // ── SVG Icons ─────────────────────────────

  _logoSvg() {
    return `<svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <rect width="26" height="26" rx="5" fill="#C9A84C" opacity="0.12"/>
      <path d="M4 19L13 7L22 19" stroke="#C9A84C" stroke-width="1.75" stroke-linejoin="round"/>
      <path d="M8.5 19L13 12L17.5 19" stroke="#C9A84C" stroke-width="1.25" stroke-linejoin="round" opacity="0.55"/>
    </svg>`;
  },

  _iconPlus() {
    return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    </svg>`;
  },

  _iconDownload() {
    return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5v7M4 6.5L6.5 9 9 6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M1.5 10.5h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`;
  },

  _iconTrash() {
    return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M1.5 3.5h10M4.5 3.5V2.5h4v1M5 5.5v4M8 5.5v4M2.5 3.5L3 11h7l.5-7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  },
};
