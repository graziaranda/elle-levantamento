# ROADMAP DE IMPLEMENTAÇÃO — Elle Levantamento

## Visão geral

20 features organizadas em 6 sprints + bloco P0. O app é uma PWA vanilla JS, offline-first, sem módulos ES. Toda mudança de schema usa `??` para retrocompatibilidade — projetos antigos nunca quebram na leitura.

**Arquivos principais:**

| Arquivo | Responsabilidade |
|---|---|
| `js/data.js` | Schema, Storage, normalizers, utilitários puros |
| `js/canvas-editor.js` | Editor principal, draw, hit tests, sidebar |
| `js/dashboard.js` | Lista de projetos, cards, ações de exportação |
| `js/pdf-report.js` | Geração de HTML/PDF |
| `js/dxf-writer.js` | Geração de DXF |
| `js/app.js` | Boot, router, PWA |

---

## P0 — Fundação e ordem de execução

### Dependências entre os 4 itens P0

```
IndexedDB completo  →  deve ser PRIMEIRO
Export .elle        →  depende de IndexedDB (usa getAsync + hydrateAsync)
PDF com carimbo     →  independente do IndexedDB
DXF fixes           →  independente (pode correr em paralelo)
```

**Ordem recomendada:** IndexedDB → Export .elle → PDF carimbo (DXF em paralelo)

---

### P0-1: IndexedDB completo — migrar leitura de projetos do localStorage

#### Schema

Nenhum campo novo. A mudança é no **caminho de leitura**, não no objeto projeto.

#### Arquivos e linhas

| Arquivo | Linha aprox. | O que muda |
|---|---|---|
| `js/data.js` | 692–719 (`Storage.save`) | confirmar que já chama `ImageStore.putProject(project)` |
| `js/data.js` | 655–658 (`Storage.get`) | adicionar fallback IDB → localStorage |
| `js/data.js` | 640–647 (`Storage.getAll`) | adicionar `Storage.getAllAsync()` |
| `js/data.js` | 649–653 (`Storage.getList`) | adicionar `Storage.getListAsync()` |
| `js/dashboard.js` | 8–35 (`Dashboard.render`) | usar `await getListAsync()` |
| `js/app.js` | 20–23 (router) | await no `CanvasEditor.open(id)` |

#### Implementação

```js
// Storage.get() — ANTES (síncrono)
get(id) {
  return normalizeProject(this.getAll()[id]) ?? null;
}

// Storage.getAsync() — DEPOIS (async, IDB primeiro)
async getAsync(id) {
  let p = await ImageStore.getProject(id);       // IDB
  if (!p) p = this.getAll()[id];                 // fallback localStorage
  if (!p) return null;
  return normalizeProject(p);
  // hydrateAsync (fotos) continua sendo chamado separadamente
}

// Storage.getListAsync()
async getListAsync() {
  const idbProjects = await ImageStore.getAllProjects();
  if (idbProjects && idbProjects.length > 0) return idbProjects.map(normalizeProject);
  return Object.values(this.getAll()).map(normalizeProject); // fallback
}
```

`Storage.getAll()` síncrono permanece para uso interno de `save()` e `delete()`.

#### Ordem de implementação

1. Confirmar que `Storage.save()` (linha 692–719) já chama `ImageStore.putProject(project)` — se não, adicionar `await ImageStore.putProject(cloneWithoutImages)` após o `setItem`
2. Adicionar `Storage.getAsync(id)` sem remover `Storage.get()` síncrono
3. Adicionar `Storage.getListAsync()`
4. Migrar `Dashboard.render()` para `getListAsync()`
5. Migrar `CanvasEditor.open()` para `getAsync()`
6. Chamar `ImageStore.gc()` em `App.start()` para limpar imagens órfãs

#### Como testar

- Criar projeto, adicionar paredes, fechar aba, reabrir → projeto aparece no dashboard
- DevTools → Application → IndexedDB → `elle_levantamento_images` → store `projects` → projetos listados
- `localStorage.clear()` manualmente → projetos ainda aparecem (lendo do IDB)
- Adicionar foto → IDB store `images` tem entrada `img_<pinId>`

---

### P0-2: Export .elle — JSON download do projeto completo

#### Schema

Nenhum campo novo. O arquivo `.elle` é um envelope JSON com o projeto completo incluindo imagens inline em base64.

**Estrutura do arquivo exportado:**

```json
{
  "elleVersion": 1,
  "exportedAt": "2026-06-07T...",
  "project": { "...objeto projeto completo com photoData inline..." }
}
```

#### Dependência

**Requer P0-1 concluído** — usa `getAsync` e `hydrateAsync`.

#### Arquivos e linhas

| Arquivo | Linha aprox. | O que muda |
|---|---|---|
| `js/data.js` | após linha 763 | novo método `Storage.exportElle(id)` |
| `js/dashboard.js` | ~130 (switch de actions) | novo `case 'elle'` |
| `js/dashboard.js` | ~80 (`_renderCard`) | novo botão "Exportar .elle" no card |

#### Implementação

```js
// data.js — Storage.exportElle(id)
async exportElle(id) {
  let project = await this.getAsync(id);
  if (!project) throw new Error('Projeto não encontrado');
  project = await this.hydrateAsync(project);
  const json = JSON.stringify({
    elleVersion: 1,
    exportedAt: new Date().toISOString(),
    project
  });
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.elle`;
  a.click();
  URL.revokeObjectURL(url);
}
```

#### Ordem de implementação

1. P0-1 deve estar pronto
2. Implementar `Storage.exportElle(id)` em `data.js`
3. Adicionar botão no card (`data-action="elle"`) em `_renderCard()`
4. Adicionar `case 'elle': await Storage.exportElle(pid); break;` no switch do dashboard

#### Como testar

- Clicar "Exportar .elle" → browser baixa arquivo `Nome_Projeto.elle`
- Abrir no editor de texto → JSON válido com `elleVersion: 1`
- Projeto com fotos → `photoData` dos pins é string base64 longa
- Tamanho proporcional ao número de fotos

---

### P0-3: PDF com carimbo configurável

#### Schema — campos novos em `createProject`

```js
// data.js — createProject() linha ~403
scale:       null,   // number | null — ex: 50 = escala 1:50
responsible: '',     // string — nome do responsável técnico
```

```js
// data.js — normalizeProject() linha ~365
p.scale       = p.scale       ?? null;
p.responsible = p.responsible ?? '';
```

#### Arquivos e linhas

| Arquivo | Linha aprox. | O que muda |
|---|---|---|
| `js/data.js` | 394–409 (`createProject`) | adicionar `scale`, `responsible` |
| `js/data.js` | 365 (`normalizeProject`) | normalizar os dois campos |
| `js/pdf-report.js` | 87–90 (stats) | ler `project.scale`, `project.responsible` |
| `js/pdf-report.js` | 93–166 (CSS) | adicionar estilos `.stamp`, `.north-arrow`, `.scale-bar` |
| `js/pdf-report.js` | 190–196 | inserir bloco HTML do carimbo |

#### Implementação

```js
// pdf-report.js — cálculo da escala
const scaleLabel = project.scale ? `1:${project.scale}` : 'Sem escala';

// Bloco HTML do carimbo (inserir entre capa e planta)
const stampHtml = `
<div class="stamp">
  <div class="stamp-row"><strong>${esc(project.name)}</strong></div>
  <div class="stamp-row">${esc(project.client || '—')}</div>
  <div class="stamp-row">${esc(project.address || '—')}</div>
  <div class="stamp-row">
    <span>Escala: ${scaleLabel}</span>
    <span>Resp.: ${esc(project.responsible || '—')}</span>
    <span>Data: ${new Date().toLocaleDateString('pt-BR')}</span>
  </div>
</div>`;
```

#### Ordem de implementação

1. Adicionar `scale` e `responsible` ao schema em `data.js`
2. Adicionar CSS do carimbo na `<style>` do pdf-report.js
3. Inserir HTML do carimbo entre a capa e a seção de planta
4. Calcular `scaleLabel` a partir de `project.scale`
5. Adicionar campo "Escala" e "Responsável" na sidebar de propriedades do projeto

#### Como testar

- Exportar PDF → carimbo aparece entre capa e planta
- `project.scale = null` → mostra "Sem escala" sem erro
- `Ctrl+P` → layout não quebra entre páginas

---

### P0-4: DXF fixes — LTYPE, STYLE, DIMSTYLE BR

#### Schema

Nenhuma mudança. Pura geração de texto DXF.

#### Arquivo e linhas

| Arquivo | Linha aprox. | O que muda |
|---|---|---|
| `js/dxf-writer.js` | 66–94 (`_tables`) | adicionar sub-tabelas LTYPE, STYLE, DIMSTYLE |

#### Ordem das sub-tabelas na seção TABLES (obrigatória pelo padrão DXF)

`LTYPE → LAYER → STYLE → DIMSTYLE`

#### Implementação

```js
// _tables() — adicionar LTYPE antes do bloco LAYER (linha 86)
L.push(
  '0','TABLE','2','LTYPE','70','1',
    '0','LTYPE','2','CONTINUOUS','70','0','3','Solid line','72','65','73','0','40','0.0',
  '0','ENDTAB'
);

// Após ENDTAB do LAYER — adicionar STYLE
L.push(
  '0','TABLE','2','STYLE','70','1',
    '0','STYLE','2','STANDARD','70','0','40','0.0','41','1.0','50','0.0',
    '71','0','42','2.5','3','arial.ttf','4','',
  '0','ENDTAB'
);

// Após STYLE — adicionar DIMSTYLE BR
L.push(
  '0','TABLE','2','DIMSTYLE','70','1',
    '0','DIMSTYLE','2','ELLE_BR','70','0',
    '3','','4','','5','','6','','7','',
    '40','1.0','41','2.5','42','0.625','43','3.75','44','1.25',
    '46','0.0','47','0.0','48','0.0',
    '140','2.5','141','2.5','146','1.0','147','0.625',
    '71','0','72','0','73','1','74','1','75','0','76','0','77','0',
    '78','8',    // suprimir zeros: não suprimir nenhum
    '270','2',   // DIMLUNIT: decimal
    '271','0',   // DIMDEC: 0 casas = inteiro (mm)
    '278','44',  // DIMDSEP: 44 = vírgula ',' em ASCII
    '279','0','280','0','281','0','282','0',
    '289','3',   // DIMATFIT: move texto e setas
    '340','5',   // DIMTXSTY: handle do STYLE STANDARD
  '0','ENDTAB'
);
```

Em `_dimEntity()` (linha ~325), adicionar referência ao DIMSTYLE:

```js
L.push('3', 'ELLE_BR');  // após grupo '2' (nome do bloco anônimo)
```

#### Como testar

- Exportar DXF com cotas, paredes e janelas
- Abrir no LibreCAD → sem warnings de "layer undefined" ou "linetype not found"
- Cotas mostram vírgula decimal (ex: `1234` em vez de `1.234`)
- Validar em `dxfvalidator.com` → zero erros na seção TABLES

---

## Sprint 0 — Pré-condições para distribuição externa

> **Nao distribuir o app para usuarios externos sem completar este sprint.**
> Criterio de saida: o app pode ser entregue a um arquiteto desconhecido sem supervisao e sem produzir dados incorretos.

**Ordem de implementacao dentro do sprint:** 0-A (ParseLocaleFloat) → 0-B (IDB failure) → 0-C (Import .elle) → 0-D (PWA install) → 0-E (Onboarding prototipo validado)

---

### Feature 0-A: ParseLocaleFloat em todos os inputs — BUG ATIVO EM PRODUCAO

> **Reclassificado de Sprint 3 para Sprint 0.** O app ja tem projeto real (Peixoto Campo Largo). Uma cota com virgula que chega como NaN no DXF do cliente e bug silencioso de producao. Custo de fix: horas. Custo de nao fixar: abandono silencioso.

#### Diagnostico

Ocorrencias de `parseFloat` direto em campos de texto (podem ter virgula):

| Linha | Contexto |
|---|---|
| ~3268 | `opening height/sill/dist` na sidebar |
| ~3447 | `env.peDireito` na sidebar |
| ~3851 | `env-pedireito` no modal de criacao de ambiente |
| ~3970 | `calib-dist` no modal de calibracao de imagem |

A linha ~3139 (`backgroundImage.opacity`) usa `parseFloat` em `<input type="range">` — nao precisa de alteracao.

#### Implementacao

```js
// Substituir nas 4 linhas identificadas:

// Linha ~3268:
const v = parseLocaleFloat(e.target.value);
o[key] = v === 0 && e.target.value.trim() === '' ? null : Math.round(v * 10);

// Linha ~3447:
env.peDireito = parseLocaleFloat(e.target.value) || null;

// Linha ~3851:
const pedireito = parseLocaleFloat(document.getElementById('env-pedireito')?.value || '') || null;

// Linha ~3970:
const realMm = parseLocaleFloat(document.getElementById('calib-dist')?.value || '');
```

`parseLocaleFloat` — verificar se ja existe em `data.js`; se nao, criar:

```js
function parseLocaleFloat(str) {
  if (typeof str !== 'string') return parseFloat(str) || 0;
  return parseFloat(str.replace(',', '.')) || 0;
}
```

Verificar tambem `_wallCommit` (~linha 1741): se usa `parseFloat(m)`, trocar para `parseLocaleFloat(m)`.

**Dependencia critica:** Feature 2 (Cota editavel in-line) usa `_numpad`. Se o numpad retornar NaN para "3,45", a geometria da parede fica corrompida sem nenhum aviso. ParseLocaleFloat deve estar pronto antes de qualquer feature que receba input numerico.

---

### Feature 0-B: Tela de erro amigavel para falha do IndexedDB

> **Item novo — nao estava no roadmap original.**
> Modo privado (anonimo) do Chrome nao persiste IndexedDB. O app nao deve deixar o usuario perder trabalho sem aviso.

#### Implementacao

```js
// data.js — testar IDB no boot, antes de qualquer operacao de Storage
async function probeIDB() {
  try {
    const test = await ImageStore._openDB();
    const tx = test.transaction(['images'], 'readwrite');
    const store = tx.objectStore('images');
    await new Promise((res, rej) => {
      const req = store.put({ id: '__probe__', data: '1' });
      req.onsuccess = res; req.onerror = rej;
    });
    await new Promise((res, rej) => {
      const req = store.delete('__probe__');
      req.onsuccess = res; req.onerror = rej;
    });
    return true;
  } catch (e) { return false; }
}

// app.js — App.start(), apos inicializar o SW:
const idbOk = await probeIDB();
if (!idbOk) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="idb-warning" style="
      position:fixed;bottom:0;left:0;right:0;
      background:#7c2d12;color:#fff;padding:12px 16px;
      font-size:13px;z-index:9999;display:flex;align-items:center;gap:12px;">
      <span>Modo privado detectado — projetos nao serao salvos entre sessoes.</span>
      <button onclick="this.parentElement.remove()" style="
        margin-left:auto;background:rgba(255,255,255,.2);
        border:none;color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;">OK</button>
    </div>`);
  ImageStore._idbAvailable = false;
}
```

#### Como testar
- Abrir em aba anonima → banner aparece imediatamente
- Criar projeto, fechar aba, reabrir → projeto perdido (comportamento esperado e informado)
- Aba normal → banner nao aparece

---

### Feature 0-C: Import .elle com schema versioning obrigatorio

> **Urgencia reclassificada.** O export .elle foi implementado (P0-2). Existe agora uma janela onde usuarios exportam esperando reimportar — e nao conseguem.
> **Schema versioning e obrigatorio** — sem ele, a primeira mudanca de schema (Sprint 5: modo reforma) quebra todos os arquivos exportados por usuarios reais.

#### Schema do arquivo .elle

```json
{
  "elleVersion": 1,
  "exportedAt": "2026-06-07T...",
  "project": { "...projeto completo..." }
}
```

O campo `elleVersion` ja existe no export (P0-2). O import deve:
1. Verificar `elleVersion` — aceitar 1; alertar para versoes futuras
2. Passar o `project` pelo `normalizeProject()` — migracao automatica via `??`
3. Gerar novo ID — nunca sobrescrever projeto existente

#### Implementacao

```js
// data.js — Storage.importElle(file)
async importElle(file) {
  const text = await file.text();
  let envelope;
  try { envelope = JSON.parse(text); }
  catch { throw new Error('Arquivo corrompido — JSON invalido'); }

  if (!envelope.elleVersion || !envelope.project)
    throw new Error('Arquivo invalido — nao e um projeto Elle');

  if (envelope.elleVersion > 1)
    throw new Error(`Versao ${envelope.elleVersion} nao suportada. Atualize o app.`);

  const project = normalizeProject(envelope.project);
  project.id        = generateId();
  project.name      = project.name + ' (importado)';
  project.updatedAt = new Date().toISOString();

  await this.save(project);
  return project;
},
```

**UI em dashboard.js:**
```js
<input type="file" id="import-elle-input" accept=".elle" style="display:none">
<button class="btn-secondary" id="btn-import-elle">Importar .elle</button>

document.getElementById('btn-import-elle').addEventListener('click', () => {
  document.getElementById('import-elle-input').click();
});
document.getElementById('import-elle-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const project = await Storage.importElle(file);
    Toast.show(`"${project.name}" importado`, 'success');
    Dashboard.render();
  } catch (err) {
    Toast.show(err.message, 'error', 5000);
  }
  e.target.value = '';
});
```

#### Tabela de versoes e migracoes

| elleVersion | Schema | Migracao automatica via normalizeProject |
|---|---|---|
| 1 | Schema atual | — |
| 2 (Sprint 5) | + `wall.status`, `opening.status` | `?? 'existente'` em normalizeOpening |
| 3 (Sprint 6) | + `floors[]` | `?? [{ canvas: p.canvas }]` em normalizeProject |

#### Como testar
- Export → Import round-trip: projeto aparece com nome "(importado)"
- JSON sem campo `project` → modal com mensagem clara
- JSON `elleVersion: 99` → modal "versao nao suportada"
- Import com fotos → fotos acessiveis no canvas

---

### Feature 0-D: Instrucao de instalacao PWA

> **Reclassificado de Sprint 3 para Sprint 0.**
> Sem instrucao visivel, o usuario usa pelo navegador sem instalar, perde o cache offline, reclama que "o app nao funciona sem internet".

#### Implementacao

```js
// app.js — mostrar instrucao contextual 10s apos a primeira abertura
function showInstallPrompt() {
  if (localStorage.getItem('elle_pwa_prompt')) return;
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS     = /iphone|ipad/i.test(navigator.userAgent);
  const isChrome  = /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);

  let instruction = '';
  if (isAndroid && isChrome) {
    instruction = 'Toque nos (tres pontos) > "Adicionar a tela inicial" para usar offline.';
  } else if (isIOS) {
    instruction = 'Toque em (compartilhar) > "Adicionar a Tela de Inicio" para usar offline.';
  } else { return; }

  document.body.insertAdjacentHTML('beforeend', `
    <div class="pwa-prompt" style="
      position:fixed;bottom:16px;left:16px;right:16px;max-width:480px;margin:0 auto;
      background:#1e1c18;border:1px solid #3d3630;border-radius:12px;
      padding:16px;z-index:9998;box-shadow:0 8px 32px rgba(0,0,0,.6);">
      <p style="margin:0 0 12px;font-size:14px;color:#e8ddd0;">
        Instale o app para usar offline:<br>
        <span style="color:#c9a84c;">${instruction}</span>
      </p>
      <button id="pwa-ok" style="
        background:#c9a84c;color:#1a1814;border:none;border-radius:8px;
        padding:8px 20px;cursor:pointer;font-weight:600;">Entendi</button>
    </div>`);
  document.getElementById('pwa-ok').addEventListener('click', () => {
    document.querySelector('.pwa-prompt').remove();
    localStorage.setItem('elle_pwa_prompt', '1');
  });
}
setTimeout(showInstallPrompt, 10000);
```

---

### Feature 0-E: Onboarding 60 segundos (prototipo primeiro)

> **Reclassificado de Sprint 3 para Sprint 0, MAS como prototipo validado antes de codificar.**
>
> **Ordem correta:** (1) Prototipo HTML/Figma → (2) Testar com arquiteta real → (3) Observar onde trava → (4) Codificar so o que passou

#### O que o onboarding deve cobrir (hipotese a validar)
1. Como desenhar a primeira parede (toque + arraste + numpad)
2. Como inserir porta ou janela (toque na parede)
3. Como exportar (botao DXF/PDF)

#### Quando aparece
- Primeira abertura (flag `elle_onboarding_done` ausente no localStorage)
- Pode ser pulado ("Pular")
- Pode ser reaberto via "?" no header

---

## Sprint 1
> **Pre-requisito nao documentado:** Feature 13 (Snap de endpoint ao arrastar) PRECISA ser entregue antes da Feature 1 (Area ao vivo). Sem snap, o poligono nao fecha corretamente no tablet touch e a area nunca e calculada. Mover #13 para o inicio desta sprint.

 — Área ao vivo + Cota editável in-line

### Feature 1: Área ao vivo no canvas

#### Schema

**Nenhuma mudança.** O campo `area` já existe em `environments[]`. A feature recalcula a área do `polygon` em tempo real em vez de ler o campo gravado.

A fórmula já existe em `data.js` linha 855:

```js
function polygonArea(pts) {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2; // resultado em mm²
}
// Para exibir em m²: area / 1e6
```

#### Lógica de negócio

O `env.area` gravado continua existindo para PDF e DXF (verdade persistida). O canvas recalcula do `polygon` a cada frame — não muta `env.area` durante o draw.

**Área durante o desenho** (enquanto `envPoints` está em construção): exibir a área parcial acumulada a partir do 3° ponto clicado.

#### Arquivos e linhas

| Arquivo | Linha aprox. | O que muda |
|---|---|---|
| `js/canvas-editor.js` | 693–697 (`_drawEnvironments`) | calcular do polygon ao vivo |
| `js/canvas-editor.js` | 3413 (`_showProps` environment) | calcular do polygon na sidebar |
| `js/canvas-editor.js` | bloco de preview de `envPoints` no `_draw` | exibir área parcial durante construção |

#### Implementação

**Ponto 1 — `_drawEnvironments` (linha 693–697):**

```js
// ANTES:
if (env.area != null) {
  ctx.fillText(`${(env.area / 1e6).toFixed(2)} m²`, env.centroid.x, env.centroid.y + fs * 1.1);
}

// DEPOIS:
const liveArea = env.polygon.length >= 3
  ? polygonArea(env.polygon)
  : (env.area || 0);
ctx.font      = `400 ${fs * 0.68}px Inter,sans-serif`;
ctx.fillStyle = 'rgba(168,152,128,0.45)';
ctx.fillText(`${(liveArea / 1e6).toFixed(2)} m²`, env.centroid.x, env.centroid.y + fs * 1.1);
```

**Ponto 2 — sidebar (`_showProps` linha 3413):**

```js
// ANTES:
const areaM2 = elem.area != null ? (elem.area / 1e6).toFixed(2) : '—';

// DEPOIS:
const liveArea = (elem.polygon && elem.polygon.length >= 3)
  ? polygonArea(elem.polygon)
  : (elem.area || null);
const areaM2 = liveArea != null ? (liveArea / 1e6).toFixed(2) : '—';
```

**Ponto 3 — preview durante construção (localizar bloco de `envPoints` em `_draw`):**

```js
// Adicionar após ctx.stroke() do polígono em construção:
if (this.envPoints.length >= 3) {
  const partialArea = polygonArea(this.envPoints);
  const cen = polygonCentroid(this.envPoints);
  const fs = 16 / this.zoom;
  const label = `${(partialArea / 1e6).toFixed(2)} m²`;
  const tw = ctx.measureText(label).width;
  const pad = 6 / this.zoom;
  ctx.font      = `600 ${fs}px Inter,sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  // Fundo para legibilidade
  ctx.fillStyle = 'rgba(26,24,20,0.82)';
  ctx.beginPath();
  ctx.roundRect(cen.x - tw/2 - pad, cen.y - fs/2 - pad, tw + pad*2, fs + pad*2, 4/this.zoom);
  ctx.fill();
  ctx.fillStyle = 'rgba(201,168,76,0.95)';
  ctx.fillText(label, cen.x, cen.y);
  ctx.textBaseline = 'alphabetic';
}
```

#### Ordem de implementação

1. Modificar `_drawEnvironments`: trocar `env.area` por `polygonArea(env.polygon)`
2. Modificar sidebar (`_showProps` linha 3413): mesmo padrão
3. Localizar bloco de preview do polígono em construção em `_draw` e adicionar label de área parcial
4. Verificar que `_promptEnvironment` (linha 3858) ainda grava `area: polygonArea(pts)` — sem mudança necessária

#### Como testar

1. Criar ambiente quadrado com cliques em (0,0), (3000,0), (3000,3000), (0,3000) → área = 9,00 m²
2. Abrir sidebar do mesmo ambiente → exibe 9,00 m²
3. Fechar e reabrir projeto → área correta (recalculada do polygon salvo)
4. Construir polígono com 3+ pontos sem fechar → label de área aparece no canvas
5. Exportar PDF → tabela de ambientes mostra a mesma área

---

### Feature 2: Cota editável in-line (numpad ao tocar)

#### Schema

**Nenhuma mudança.** O campo `value` já existe em `dimensions[]`:

```js
dimensions: [] // { id, x1, y1, x2, y2, value, offset, wallId?, label? }
// value: null = automático (distância real), number = override do usuário
```

#### Lógica de negócio

Ao tocar em uma cota no canvas, o numpad abre diretamente (sem passar pela sidebar). O `value` editado é uma etiqueta — **a parede não se move** (a cota não tem vínculo bidirecional com a parede nesta implementação).

Buffer vazio no numpad → `dim.value = null` → automático (distância real exibida).

#### Arquivo e linhas

| Arquivo | Linha aprox. | O que muda |
|---|---|---|
| `js/canvas-editor.js` | 2085–2090 (`_clickSelect` bloco dim) | substituir `_showProps` por `_numpad` direto |

#### Implementação

```js
// ANTES (linha 2085–2090):
if (this._pointNearSegment(rawWorld, p1, p2, HIT)) {
  this.selected = { type: 'dim', id: d.id };
  this._showProps(d, 'dim');
  this._draw();
  return;
}

// DEPOIS:
if (this._pointNearSegment(rawWorld, p1, p2, HIT)) {
  this.selected = { type: 'dim', id: d.id };
  this._draw(); // mostra a cota selecionada antes do numpad
  const len = Math.round(dist(d.x1, d.y1, d.x2, d.y2));
  this._numpad({
    title: 'Valor da cota',
    hint:  d.value != null
      ? `Automático: ${len} mm. Apague tudo para automático.`
      : `Medida atual: ${fmtM(len)}. Apague tudo para automático.`,
    unit:  'mm',
    value: d.value != null ? String(d.value) : String(len),
    onOk: val => {
      const dim = this.project.canvas.dimensions.find(x => x.id === d.id);
      if (!dim) return;
      const n = val ? parseInt(String(val).replace(',', '.')) : null;
      dim.value = (n && n > 0) ? n : null;
      this._scheduleSave();
      this._draw();
    },
    onCancel: () => { this._showProps(d, 'dim'); },
  });
  return;
}
```

**Compatibilidade com a sidebar:** quando o usuário cancela o numpad, `onCancel` chama `_showProps(d, 'dim')` que abre a sidebar com o campo de input convencional como fallback.

#### Ordem de implementação

1. Modificar `_clickSelect` bloco dim: substituir `_showProps` por `_numpad`
2. Validar que valor digitado atualiza `d.value` e canvas redesenha
3. Validar que buffer vazio (backspace + OK) reseta para `null`
4. Verificar que `_scheduleSave` é chamado e o projeto persiste

#### Como testar

1. Parede de 2500mm → cota entre endpoints → canvas mostra "2,50m"
2. Tocar na cota → numpad abre com "2500" pré-preenchido
3. Digitar "3000" → confirmar → canvas mostra "3,00m" (parede não se move)
4. Tocar na cota → apagar tudo (4x backspace) → OK → volta a "2,50m" (automático)
5. Fechar e reabrir projeto → valor "3000" persiste
6. DXF exportado usa `d.value` no grupo `42` (`dVal = d.value ?? Math.round(len)`)

#### Mudanças por arquivo — Sprint 1

| Arquivo | O que muda | Linhas |
|---|---|---|
| `js/canvas-editor.js` | `_drawEnvironments`: área do polygon ao vivo | ~693–697 |
| `js/canvas-editor.js` | `_showProps` ambiente: área do polygon | ~3413 |
| `js/canvas-editor.js` | preview `envPoints`: exibir área parcial | localizar no `_draw` |
| `js/canvas-editor.js` | `_clickSelect` dim: abrir `_numpad` direto | ~2086–2090 |
| `js/data.js` | Nenhuma mudança | — |
| `js/pdf-report.js` | Nenhuma mudança | — |

---

## Sprint 2 — Editar abertura + Área PDF + CSV + Import .elle

### Feature 3: Editar abertura após inserção

#### Schema

**Nenhuma mudança.** O objeto abertura já tem todos os campos editáveis:

```js
// opening existente (normalizeOpening em data.js)
{ id, wallId, type,         // imutáveis
  t,                         // posição ao longo da parede (0..1)
  width, height, sill,       // editáveis
  hingeSide, openDir }       // editáveis (porta)
```

Mutação in-place via `Object.assign`, igual ao padrão já usado em `_showProps` para instalações.

#### Lógica de negócio

**Campo `t` ao editar "distância do canto":**

```js
function distToT(wall, distMm) {
  const wallLen = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) * SCALE_MM_PER_PX;
  return Math.max(0, Math.min(1, distMm / wallLen));
}
```

**Distância exibida (t → mm):**

```js
function tToCornerDist(wall, t, openingWidth) {
  const wallLen = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) * SCALE_MM_PER_PX;
  return Math.round((t * wallLen) - openingWidth / 2);
}
```

#### Arquivos e linhas

| Arquivo | Linha aprox. | O que muda |
|---|---|---|
| `js/canvas-editor.js` | ~2774 (`_openOpeningForm`) | extrair campos para `_openingFields()` reutilizável |
| `js/canvas-editor.js` | ~3212 (`_showProps` tipo opening) | renderizar `_openingFields` editável |

#### Ordem de implementação

1. Extrair `_openingFields(opening, wall, onChange)` — retorna HTML dos campos
2. Refatorar `_openOpeningForm` para usar `_openingFields`
3. Em `_showProps` tipo `opening`: renderizar `_openingFields` no painel lateral com `onChange` que faz mutação + save + redraw (preview ao vivo)
4. Validar: valor inválido (ex: largura > comprimento da parede) → campo fica vermelho, não salva

#### Como testar

- Selecionar porta → sidebar abre com valores corretos
- Editar largura → canvas redesenha o arco no tamanho novo
- Editar distância do canto → abertura se move na parede
- Editar peitoril em janela → DXF exportado reflete valor
- Editar sentido de abertura → arco de porta muda de lado

---

### Feature 4: Área por ambiente no PDF

#### Schema

**Nenhuma mudança.** O perímetro é calculado on-the-fly.

```js
// Adicionar inline em pdf-report.js
function polygonPerimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p; // em px — multiplicar por SCALE para mm
}
```

#### Arquivos e linhas

| Arquivo | Linha aprox. | O que muda |
|---|---|---|
| `js/pdf-report.js` | ~15–30 (map de environments) | adicionar cálculo de `perimM` |
| `js/pdf-report.js` | 186–190 (stats da capa) | adicionar stat "Área total: X m²" |
| `js/pdf-report.js` | tabela de ambientes | adicionar coluna "Perímetro" |

#### Implementação

```js
// Dentro do map de environments (~linha 17):
const envRows = environments.map(env => {
  const areaM2 = (env.area / 1e6).toFixed(2);
  const perimM = env.polygon && env.polygon.length > 1
    ? (polygonPerimeter(env.polygon) / 1000).toFixed(2)
    : '—';
  return { ...env, areaM2, perimM };
});

// Área total
const totalAreaM2 = environments
  .filter(e => e.area > 0)
  .reduce((sum, e) => sum + e.area / 1e6, 0)
  .toFixed(2);
```

#### Ordem de implementação

1. Adicionar `polygonPerimeter` inline no pdf-report.js
2. Adicionar cálculo de `perimM` no map de environments
3. Adicionar stat de área total na capa
4. Adicionar coluna "Perímetro" na tabela de ambientes
5. Adicionar linha de área total abaixo da tabela

#### Como testar

- Projeto sem ambientes → PDF não quebra, stat mostra "0 m²"
- Ambiente retangular 3×4m → área = 12,00 m², perímetro = 14,00 m
- Ambiente com `polygon null/vazio` → linha exibe "—" no perímetro

---

### Feature 5: CSV de áreas por ambiente

#### Schema

**Nenhuma mudança.** Arquivo novo: `js/csv-writer.js`.

#### Associação openings ↔ ambiente (ponto médio da abertura próximo à borda do polígono)

```js
function openingsForEnvironment(env, canvas) {
  return canvas.openings.filter(o => {
    const wall = canvas.walls.find(w => w.id === o.wallId);
    if (!wall) return false;
    const mx = wall.x1 + (wall.x2 - wall.x1) * o.t;
    const my = wall.y1 + (wall.y2 - wall.y1) * o.t;
    return isPointNearPolygonBoundary(mx, my, env.polygon, 200);
  });
}
```

#### Formato do CSV

- Separador: `;` (padrão Excel Brasil)
- Encoding: UTF-8 com BOM (`\uFEFF`)
- Decimal: vírgula `,`

#### Implementação

```js
// js/csv-writer.js
function generateAreasCSV(project) {
  const c = project.canvas;
  const BOM = '\uFEFF';
  const SEP = ';';
  const NL  = '\r\n';

  const rows = [];
  rows.push([`Projeto: ${project.name}`, `Cliente: ${project.client || ''}`,
             `Data: ${new Date().toLocaleDateString('pt-BR')}`].join(SEP));
  rows.push(['Ambiente','Área (m²)','Perímetro (m)','Vãos','Pé-direito (m)','Observação'].join(SEP));

  for (const env of c.environments) {
    const areaM2 = (env.area / 1e6).toFixed(2).replace('.', ',');
    const perimM = env.polygon?.length > 1
      ? (polygonPerimeter(env.polygon) / 1000).toFixed(2).replace('.', ',')
      : '';
    const vans = openingsForEnvironment(env, c)
      .map(o => `${o.type === 'door' ? 'Porta' : 'Janela'} ${(o.width/1000).toFixed(2).replace('.',',')}m`)
      .join(' · ');
    const pe  = env.peDireito ? String(env.peDireito).replace('.', ',') : '';
    const obs = env.observation || '';
    rows.push([env.name, areaM2, perimM, `"${vans}"`, pe, obs].join(SEP));
  }

  const totalM2 = c.environments.reduce((s, e) => s + (e.area || 0), 0) / 1e6;
  rows.push(['TOTAL', totalM2.toFixed(2).replace('.', ','), '', '', '', ''].join(SEP));

  return BOM + rows.join(NL);
}
```

#### Arquivos e linhas

| Arquivo | O que muda |
|---|---|
| `js/csv-writer.js` | arquivo novo: `polygonPerimeter`, `isPointNearPolygonBoundary`, `openingsForEnvironment`, `generateAreasCSV`, `downloadCSV` |
| `index.html` | adicionar `<script src="js/csv-writer.js">` |
| `js/dashboard.js` | botão "CSV" no card (`data-action="csv"`) + handler |

#### Ordem de implementação

1. Criar `js/csv-writer.js` com todas as funções
2. Adicionar `<script>` no HTML
3. Adicionar botão "CSV" no card (`data-action="csv"`)
4. Wiring em dashboard.js (mesmo padrão do botão "DXF")

#### Como testar

- CSV abre no Excel BR sem configuração → acentos ok, decimais com vírgula
- Vãos associados corretamente → porta da sala na linha da sala
- Linha TOTAL = soma correta de todas as áreas
- Projeto sem ambientes → CSV com só cabeçalho + TOTAL zerada

---

### Feature 6: Import .elle

#### Schema

Nenhum campo novo. Validação do envelope + `normalizeProject` para migrar versões antigas.

**Formato canônico do arquivo .elle:**

```json
{
  "type": "elle_export",
  "exportedAt": "2026-06-07T10:00:00Z",
  "appVersion": "1",
  "project": { "...objeto projeto completo..." }
}
```

#### Implementação

```js
// data.js — importElleFile(jsonStr)
function importElleFile(jsonStr) {
  let raw;
  try { raw = JSON.parse(jsonStr); }
  catch { return { error: 'invalid_json', message: 'Arquivo corrompido ou não é um .elle válido.' }; }

  const project = raw.type === 'elle_export' ? raw.project : raw;

  if (!project || !project.id || !project.canvas) {
    return { error: 'invalid_structure', message: 'Estrutura inválida ou campos obrigatórios ausentes.' };
  }
  if (project.schemaVersion && project.schemaVersion > SCHEMA_VERSION) {
    return { error: 'future_version',
             message: `Versão ${project.schemaVersion} não suportada (máx: ${SCHEMA_VERSION}).` };
  }

  // Validar arrays essenciais
  const arrays = ['walls','openings','installations','environments','notes','dimensions','photoPins'];
  for (const key of arrays) {
    if (project.canvas[key] && !Array.isArray(project.canvas[key])) {
      return { error: 'invalid_canvas', message: `Campo canvas.${key} inválido.` };
    }
  }

  const normalized = normalizeProject(project);
  const imported = { ...normalized, id: generateId(), name: normalized.name + ' (importado)' };
  return { ok: true, project: imported };
}
```

**Handler no dashboard:**

```js
async function _handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.elle,.json';
  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const result = importElleFile(text);
    if (result.error) { Modal.alert('Erro ao importar', result.message); return; }
    await Storage.save(result.project);
    Dashboard.render();
  });
  input.click();
}
```

#### Arquivos e linhas

| Arquivo | O que muda |
|---|---|
| `js/data.js` | adicionar `importElleFile(jsonStr)` e `exportElleFile(project)` |
| `js/dashboard.js` | botão "Importar" no header + `_handleImport` |
| `js/dashboard.js` | `data-action="export-elle"` no card + `_handleExportElle` |

#### Ordem de implementação

1. `data.js`: `exportElleFile(project)` e `importElleFile(jsonStr)`
2. `dashboard.js`: botão "Importar" no header
3. `dashboard.js`: wiring com file picker + `importElleFile` + `Storage.save`
4. `dashboard.js`: `data-action="export-elle"` no card com `hydrateAsync` antes do export
5. Testar round-trip: exportar → reimportar → verificar dados e fotos

#### Como testar

- Export com fotos → arquivo contém base64 das fotos
- Import do arquivo → projeto aparece com nome "(importado)"
- Import de JSON corrompido → modal de erro, app não quebra
- Import de `schemaVersion=99` → modal de erro de versão
- Import gera novo ID → não sobrescreve projeto original
- Fotos do projeto importado visíveis no canvas
- Funciona offline — fluxo 100% local

---

## Sprint 3 — Norte + Layers AsBEA + Onboarding + PWA + Duplicar

> Nota: ParseLocaleFloat (Vírgula BR) foi movida para Sprint 0. Onboarding e PWA install tambem estao em Sprint 0 — a implementacao final de codigo fica aqui apos o prototipo ser validado.

**Ordem de implementação dentro da sprint:** Feature 12 → 11 → 8 → 7 → 9 → 10

### Feature 12: Duplicar projeto

#### Schema

Nenhum campo novo. `Storage.duplicate(id)` é um novo método.

**Campos que mudam no clone:**

| Campo | Valor no clone |
|---|---|
| `id` | novo UUID |
| `name` | `"Cópia de " + original.name` |
| `createdAt` | `new Date().toISOString()` |
| `updatedAt` | igual ao `createdAt` |
| `thumbnail` | `null` |

**IDs das entidades do canvas** devem ser todos reatribuídos para evitar colisão no IndexedDB (chaves `img_<pin.id>`).

#### Implementação

```js
// data.js — Storage.duplicate(id) após o método delete() (~linha 804)
async duplicate(id) {
  const original = await this.getAsync(id);
  if (!original) return null;
  await this.hydrateAsync(original);

  const clone = JSON.parse(JSON.stringify(original));
  clone.id        = generateId();
  clone.name      = 'Cópia de ' + original.name;
  clone.createdAt = new Date().toISOString();
  clone.updatedAt = clone.createdAt;
  clone.thumbnail = null;

  // Reatribuir IDs de todas as entidades (manter referências internas)
  const idMap = {};
  const reId = obj => { const n = generateId(); idMap[obj.id] = n; obj.id = n; };

  (clone.canvas.walls         || []).forEach(reId);
  (clone.canvas.openings      || []).forEach(o => { reId(o); o.wallId = idMap[o.wallId] || o.wallId; });
  (clone.canvas.installations || []).forEach(reId);
  (clone.canvas.dimensions    || []).forEach(d => { reId(d); if (d.wallId) d.wallId = idMap[d.wallId] || d.wallId; });
  (clone.canvas.environments  || []).forEach(reId);
  (clone.canvas.notes         || []).forEach(reId);
  (clone.canvas.photoPins     || []).forEach(pin => { delete pin._photoRef; reId(pin); });
  (clone.canvas.elevations    || []).forEach(ev => {
    reId(ev);
    if (ev.wallId) ev.wallId = idMap[ev.wallId] || ev.wallId;
  });
  if (clone.canvas.backgroundImage) delete clone.canvas.backgroundImage._dataRef;

  await this.save(clone);
  return clone;
},
```

**UI em dashboard.js:**

```js
// _renderCard — adicionar botão após DXF
<button class="btn-card-icon" data-action="duplicate" data-id="${esc(p.id)}" title="Duplicar">
  Clonar
</button>

// Handler
async _duplicateProject(id) {
  Toast.show('Duplicando…', 'info', 2000);
  try {
    const clone = await Storage.duplicate(id);
    if (!clone) { Toast.show('Erro ao duplicar', 'error'); return; }
    Toast.show(`"${clone.name}" criado`, 'success');
    this.render();
  } catch (e) {
    Toast.show('Erro ao duplicar', 'error');
    console.error(e);
  }
},
```

#### Como testar

- Duplicar sem fotos: novo ID, nome "Cópia de X", canvas idêntico
- Duplicar com fotos: fotos acessíveis no clone, original intacto após `gc()`
- Excluir clone: original ainda tem fotos (refs IDB independentes)

---


### Feature 8: Layers AsBEA no DXF

#### Schema

Adicionar `dxfLayerMode` em `createProject()`:

```js
// data.js — createProject()
dxfLayerMode: 'legacy', // 'legacy' | 'asbea'

// normalizeProject():
p.dxfLayerMode = p.dxfLayerMode || 'legacy';
```

#### Mapeamento AsBEA

| Layer atual | Layer AsBEA | Cor DXF |
|---|---|---|
| PAREDES | ARQ-ALV | 7 |
| ABERTURAS (portas) | ARQ-ESQ-POR | 3 |
| ABERTURAS (janelas) | ARQ-ESQ-JAN | 5 |
| COTAS | ARQ-CTA-GER | 1 |
| AMBIENTES | ARQ-AMB | 4 |
| NOTAS | ARQ-NOI | 6 |
| ELETRICA | ELE-INS | 2 |
| HIDRAULICA | HID-INS | 5 |
| ODONTO | ESP-ODO | 3 |

#### Implementação

```js
// dxf-writer.js — topo do arquivo
const LAYER_ASBEA = {
  PAREDES:   'ARQ-ALV',
  ABERTURAS: 'ARQ-ESQ',
  DOOR:      'ARQ-ESQ-POR',
  WINDOW:    'ARQ-ESQ-JAN',
  COTAS:     'ARQ-CTA-GER',
  AMBIENTES: 'ARQ-AMB',
  NOTAS:     'ARQ-NOI',
  FOTOS:     'ARQ-FOI',
  ELETRICA:  'ELE-INS',
  HIDRAULICA:'HID-INS',
  ODONTO:    'ESP-ODO',
};

// Em generate():
this._asbea = project.dxfLayerMode === 'asbea';

// Helper:
_L(name) { return this._asbea ? (LAYER_ASBEA[name] || name) : name; },

// Em _writeOpenings() — separar layer porta/janela quando asbea:
const layer = this._asbea
  ? (o.type === 'door' ? this._L('DOOR') : this._L('WINDOW'))
  : 'ABERTURAS';
```

`_tables()` gera layers dinamicamente com base em `this._asbea`. Substituir todas as strings de layer hardcoded por `this._L('PAREDES')`, `this._L('COTAS')`, etc.

#### Como testar

- DXF com `dxfLayerMode: 'asbea'` → layers `ARQ-ALV`, `ARQ-ESQ-POR`, etc.
- DXF com `dxfLayerMode: 'legacy'` → layers `PAREDES`, `ABERTURAS`, etc. (sem regressão)
- Abrir no AutoCAD Web → cotas com vírgula decimal

---

### Feature 7: Norte automático via bússola

#### Schema

Adicionar em `defaultCanvas()`:

```js
// data.js — defaultCanvas() (~linha 133)
northAngle:  null,   // number | null — graus geodésicos (0=N, 90=L, 180=S, 270=O)
northLocked: false,  // true = usuário confirmou
```

```js
// normalizeCanvas():
c.northAngle  = c.northAngle  ?? null;
c.northLocked = c.northLocked ?? false;
```

#### Implementação — canvas-editor.js

```js
_openNorthPanel() {
  let compassVal = null;
  let handler = null;
  const supportsCompass = 'DeviceOrientationEvent' in window;

  Modal.open(`
    <div class="modal-header">
      <h2 class="modal-title">Orientação Norte</h2>
      <button class="modal-close" id="mc">×</button>
    </div>
    <div class="modal-body">
      <p>Aponte o lado superior do tablet para o Norte e confirme.</p>
      ${supportsCompass
        ? `<div id="compass-live" style="font-size:28px;text-align:center;margin:16px 0;">—°</div>
           <button class="btn-primary" id="btn-use-compass" style="width:100%;margin-bottom:12px;">
             Usar bússola agora
           </button>`
        : ''}
      <label class="form-label">Ângulo Norte (graus, 0–359)</label>
      <input class="form-input" id="north-angle-input" type="number"
             min="0" max="359" step="1"
             value="${this.project.canvas.northAngle ?? ''}">
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="mc-cancel">Cancelar</button>
      <button class="btn-primary" id="mc-ok">Salvar</button>
    </div>
  `);

  if (supportsCompass) {
    handler = e => {
      const heading = e.webkitCompassHeading ?? e.alpha ?? null;
      if (heading === null) return;
      compassVal = Math.round(heading);
      const el = document.getElementById('compass-live');
      if (el) el.textContent = `${compassVal}°`;
    };
    window.addEventListener('deviceorientation', handler);
    document.getElementById('btn-use-compass').addEventListener('click', () => {
      if (compassVal !== null)
        document.getElementById('north-angle-input').value = compassVal;
    });
  }

  const cleanup = () => {
    if (handler) window.removeEventListener('deviceorientation', handler);
    Modal.close();
  };

  document.getElementById('mc').addEventListener('click', cleanup);
  document.getElementById('mc-cancel').addEventListener('click', cleanup);
  document.getElementById('mc-ok').addEventListener('click', () => {
    const v = parseInt(document.getElementById('north-angle-input').value, 10);
    if (!isNaN(v)) {
      this.project.canvas.northAngle  = ((v % 360) + 360) % 360;
      this.project.canvas.northLocked = true;
      this._scheduleSave();
      this._draw();
    }
    cleanup();
    Toast.show('Norte salvo', 'success');
  });
},
```

**Seta no canvas** — chamar `this._drawNorthArrow()` ao final de `_draw()`:

```js
_drawNorthArrow() {
  const angle = this.project.canvas.northAngle;
  if (angle === null) return;
  const ctx = this._ctx;
  const x = this._canvas.width - 48, y = 48, r = 20;
  const rad = (angle - 90) * Math.PI / 180;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rad);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(5, r * 0.4);
  ctx.lineTo(0, r * 0.2);
  ctx.lineTo(-5, r * 0.4);
  ctx.closePath();
  ctx.fillStyle = '#C9A84C';
  ctx.fill();
  ctx.rotate(-rad);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -r - 8);
  ctx.restore();
},
```

**Seta SVG no PDF** (`pdf-report.js`, após o bloco da planta ~linha 195):

```js
${project.canvas.northAngle !== null ? `
  <div style="display:flex;justify-content:flex-end;margin-top:4px;">
    <div style="text-align:center;">
      <svg width="32" height="40" viewBox="0 0 32 40">
        <polygon points="16,2 22,28 16,22 10,28" fill="#C9A84C"/>
        <polygon points="16,22 22,28 16,34 10,28" fill="#888"/>
      </svg>
      <div style="font-size:9px;color:#888;">${project.canvas.northAngle}°</div>
    </div>
  </div>` : ''}
```

**Norte no DXF** — bloco `NORTE` na seção BLOCKS + `INSERT` nas ENTITIES (ver Sprint 3 — Integração DXF):

```js
_northBlock(L, angle) {
  if (angle === null) return;
  L.push('0','BLOCK','8','0','2','NORTE','70','0','10','0','20','0','3','NORTE','1','');
  L.push('0','LINE','8','NOTAS','10','0','20','0','11','0','21','500');
  L.push('0','LINE','8','NOTAS','10','-80','20','400','11','0','21','500');
  L.push('0','LINE','8','NOTAS','10','80','20','400','11','0','21','500');
  L.push('0','TEXT','8','NOTAS','10','-60','20','560','40','120','1','N');
  L.push('0','ENDBLK','8','0');
},

_northInsert(L, bbox, angle) {
  const x = (bbox.maxX + 1000).toFixed(1);
  const y = (-(bbox.maxY + 1000)).toFixed(1);
  const dxfAngle = ((90 - angle) + 360) % 360;
  L.push('0','INSERT','8','NOTAS','2','NORTE',
    '10', x, '20', y, '30', '0',
    '41','1','42','1','43','1',
    '50', dxfAngle.toFixed(2));
},
```

#### Ordem de implementação (commits)

**Commit 1 — data.js:** `northAngle`, `northLocked` em `defaultCanvas` e `normalizeCanvas`; `dxfLayerMode` em `createProject` e `normalizeProject`; `Storage.duplicate()`

**Commit 2 — dxf-writer.js:** `LAYER_ASBEA`, `_L()`, `_asbea` em `generate()`, `_tables()` dinâmico, `_writeOpenings()` separando porta/janela, `_northBlock()`, `_northInsert()`

**Commit 3 — canvas-editor.js:** 4 `parseFloat` → `parseLocaleFloat`; `_openNorthPanel()`; `_drawNorthArrow()`; chamada no `_draw()`; botão Norte na toolbar

**Commit 4 — pdf-report.js:** seta SVG de norte após planta

**Commit 5 — dashboard.js:** botão "Clonar" nos cards; `_duplicateProject()`; `_showOnboarding()`, `_finishOnboarding()`

**Commit 6 — app.js:** `beforeinstallprompt`; `showPwaInstallBanner()`; `setTimeout` 30s

---

### Feature 9: Onboarding em 60 segundos

#### Lógica de exibição

```js
const ONBOARDING_KEY = 'elle_onboarding_v1_done';

// Em Dashboard.render(), após renderizar:
if (!localStorage.getItem(ONBOARDING_KEY)) {
  requestAnimationFrame(() => this._showOnboarding());
}
```

#### Implementação

```js
_showOnboarding() {
  const steps = [
    {
      title: 'Crie seu primeiro levantamento',
      text:  'Toque em "Novo levantamento" e preencha nome, cliente e endereço.',
    },
    {
      title: 'Desenhe as paredes',
      text:  'Segure e arraste no canvas para criar paredes. Solte e confirme a medida.',
    },
    {
      title: 'Exporte quando pronto',
      text:  'DXF abre no AutoCAD e no BricsCAD. Arquivo .elle é o backup completo.',
    },
  ];
  let step = 0;
  const total = steps.length;

  const render = () => {
    const s = steps[step];
    const dots = steps.map((_, i) =>
      `<span style="width:8px;height:8px;border-radius:50%;
        background:${i === step ? '#C9A84C' : '#4A3F32'};display:inline-block;"></span>`
    ).join('');
    Modal.open(`
      <div style="text-align:center;padding:8px 0 0;">
        <h2 style="font-size:18px;margin-bottom:8px;">${s.title}</h2>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:24px;line-height:1.5;">${s.text}</p>
        <div style="display:flex;justify-content:center;gap:6px;margin-bottom:20px;">${dots}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn-ghost" id="ob-skip">Pular</button>
          ${step < total - 1
            ? `<button class="btn-primary" id="ob-next">Próximo</button>`
            : `<button class="btn-primary" id="ob-done">Começar</button>`}
        </div>
      </div>`);

    document.getElementById('ob-skip').addEventListener('click', () => this._finishOnboarding());
    document.getElementById('ob-next')?.addEventListener('click', () => { step++; render(); });
    document.getElementById('ob-done')?.addEventListener('click', () => this._finishOnboarding());

    // Prevenir fechamento pelo backdrop durante onboarding
    document.getElementById('modal-backdrop')?.style.setProperty('pointer-events', 'none');
  };
  render();
},

_finishOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, '1');
  Modal.close();
},
```

---

### Feature 10: Instrução de instalação PWA

#### Implementação (app.js)

```js
const PWA_KEY = 'elle_pwa_install_dismissed';
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

function showPwaInstallBanner() {
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (localStorage.getItem(PWA_KEY)) return;

  const isIos    = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);

  if (isIos && isSafari) {
    _showPwaBanner(`Toque em <strong>Compartilhar</strong> (ícone na barra inferior) e depois
      <strong>"Adicionar à Tela de Início"</strong> para instalar o app.`, null);
    return;
  }
  if (deferredInstallPrompt) {
    _showPwaBanner(
      'Instale o Elle Levantamento para usar sem internet e sem abrir o navegador.',
      async () => {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (outcome === 'accepted') Toast.show('App instalado!', 'success');
      }
    );
  }
}

function _showPwaBanner(text, onInstall) {
  const banner = document.createElement('div');
  banner.id = 'pwa-banner';
  banner.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;z-index:9000;
    background:#2A2418;border-top:1px solid #4A3F32;
    padding:12px 16px;display:flex;align-items:center;gap:12px;
    font-size:13px;color:var(--text-muted);`;
  banner.innerHTML = `
    <div style="flex:1;line-height:1.4;">${text}</div>
    ${onInstall ? `<button class="btn-primary" id="pwa-install-btn" style="white-space:nowrap;">Instalar</button>` : ''}
    <button class="btn-ghost" id="pwa-dismiss-btn">Agora não</button>`;
  document.body.appendChild(banner);

  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    localStorage.setItem(PWA_KEY, '1');
    banner.remove();
  });
  if (onInstall) {
    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      await onInstall();
      banner.remove();
    });
  }
}

setTimeout(() => showPwaInstallBanner(), 30_000);
```

---

## Sprint 4 — Ângulo livre + Snap de endpoint

### Feature 15: Ângulo livre ao desenhar parede

#### Schema

**Nenhuma mudança em data.js.** O ângulo é estado efêmero de UI — não persiste.

```js
// Estado interno do editor (construtor ou init)
this._lockedAngle = null;  // number em graus ou null
```

#### Lógica de negócio

Camadas de decisão ao calcular o ângulo durante o preview:

```
1. Se _lockedAngle !== null → usar ângulo fixado (lock total)
2. Senão se snap ativo (padrão) → passar por _snapWallAngle()
3. Senão → rawAng puro
```

#### Implementação

**Cálculo no preview/draw:**

```js
// No método de preview da parede, antes de chamar _snapWallAngle:
let ang;
if (this._lockedAngle !== null) {
  ang = this._lockedAngle;
  const len = Math.hypot(rawX2 - this.drawStart.x, rawY2 - this.drawStart.y);
  rawX2 = this.drawStart.x + Math.cos(ang * Math.PI / 180) * len;
  rawY2 = this.drawStart.y + Math.sin(ang * Math.PI / 180) * len;
} else {
  const rawAng = Math.atan2(rawY2 - this.drawStart.y, rawX2 - this.drawStart.x) * 180 / Math.PI;
  ang = this._snapWallAngle(rawAng);
}
```

**Badge de ângulo sempre visível e clicável:**

```js
// Exibir o ângulo atual durante o desenho (não só quando há snap)
ctx.fillStyle = this._lockedAngle !== null ? '#f0a500' : '#aaa';
ctx.fillText(`${Math.round(ang)}°`, midX + 10, midY - 10);
```

**Overlay de input de ângulo:**

```js
_showAngleInput(currentAngle) {
  const div = document.createElement('div');
  div.className = 'angle-input-overlay';
  div.innerHTML = `
    <label>Ângulo °</label>
    <input type="number" id="ang-input" min="-180" max="360" step="1"
           value="${Math.round(currentAngle)}">
    <button id="ang-ok">OK</button>
    <button id="ang-clear">Livre</button>`;
  // Posicionar próximo ao badge
  document.body.appendChild(div);

  document.getElementById('ang-ok').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('ang-input').value);
    this._lockedAngle = isNaN(v) ? null : v % 360;
    div.remove();
  });
  document.getElementById('ang-clear').addEventListener('click', () => {
    this._lockedAngle = null;
    div.remove();
  });
  document.getElementById('ang-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('ang-ok').click();
    if (e.key === 'Escape') { this._lockedAngle = null; div.remove(); }
  });
}
```

**Limpar ao finalizar:** em `_wallCommit()`: `this._lockedAngle = null;` + remover overlay.

#### Ordem de implementação

1. Adicionar `this._lockedAngle = null` no estado do editor
2. Modificar o cálculo de `ang` no preview para respeitar `_lockedAngle`
3. Tornar o badge de ângulo sempre visível + clicável (chama `_showAngleInput`)
4. Implementar `_showAngleInput()` com overlay
5. Limpar `_lockedAngle` no `_wallCommit()` e no cancelamento (Escape)

#### Como testar

| Teste | Esperado |
|---|---|
| Arrastar ~89° com snap ativo | Trava em 90° |
| Arrastar ~60° (fora de qualquer faixa de snap) | Fica em ~60° sem travar |
| Tocar no badge → digitar 30° → Enter | Parede nasce exatamente em 30° |
| Badge com ângulo travado | Cor âmbar (#f0a500) |
| Botão "Livre" no overlay | Badge volta a cinza, snap volta ao normal |
| Finalizar parede com lock | Próxima parede começa sem lock |

---

### Feature 13: Snap de endpoint ao arrastar

#### Schema

**Nenhuma mudança em data.js.** Snap é estado de UI.

```js
// Estado interno do editor
this._draggingEndpoint = null; // null | { wallId: string, point: 0|1 }
this._snapTarget = null;       // null | { x, y, type: 'endpoint'|'wall' }
```

#### Algoritmos

**Detecção de hit em endpoint:**

```js
_hitEndpoint(canvasX, canvasY) {
  const r = 24 / this.canvas.zoom;
  for (const wall of this.canvas.walls) {
    if (Math.hypot(canvasX - wall.x1, canvasY - wall.y1) < r) return { wallId: wall.id, point: 0 };
    if (Math.hypot(canvasX - wall.x2, canvasY - wall.y2) < r) return { wallId: wall.id, point: 1 };
  }
  return null;
}
```

**Endpoint mais próximo:**

```js
_nearestEndpoint(px, py, excludeWallId) {
  const threshold = 24 / this.canvas.zoom;
  let best = null, bestDist = threshold;
  for (const wall of this.canvas.walls) {
    if (wall.id === excludeWallId) continue;
    for (const ep of [{x: wall.x1, y: wall.y1}, {x: wall.x2, y: wall.y2}]) {
      const d = Math.hypot(px - ep.x, py - ep.y);
      if (d < bestDist) { bestDist = d; best = { x: ep.x, y: ep.y, type: 'endpoint' }; }
    }
  }
  return best;
}
```

**Projeção sobre corpo de parede:**

```js
_nearestWallProjection(px, py, excludeWallId) {
  const threshold = 24 / this.canvas.zoom;
  let best = null, bestDist = threshold;
  for (const wall of this.canvas.walls) {
    if (wall.id === excludeWallId) continue;
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue; // protege divisão por zero
    const t = Math.max(0, Math.min(1,
      ((px - wall.x1) * dx + (py - wall.y1) * dy) / lenSq));
    const proj = { x: wall.x1 + t * dx, y: wall.y1 + t * dy, type: 'wall' };
    const d = Math.hypot(px - proj.x, py - proj.y);
    if (d < bestDist) { bestDist = d; best = proj; }
  }
  return best;
}

// Combinar: endpoint tem prioridade
_snapEndpointDrag(px, py, excludeWallId) {
  return this._nearestEndpoint(px, py, excludeWallId)
      || this._nearestWallProjection(px, py, excludeWallId)
      || { x: px, y: py, type: null };
}
```

#### Integração com canvas-editor.js

**touchstart/mousedown do modo select (antes da lógica de pan):**

```js
const hit = this._hitEndpoint(canvasX, canvasY);
if (hit) {
  this._draggingEndpoint = hit;
  e.preventDefault();
  return; // não inicia pan
}
```

**touchmove/mousemove:**

```js
if (this._draggingEndpoint) {
  const { wallId, point } = this._draggingEndpoint;
  const snap = this._snapEndpointDrag(canvasX, canvasY, wallId);
  this._snapTarget = snap.type ? snap : null;
  const wall = this.canvas.walls.find(w => w.id === wallId);
  if (point === 0) { wall.x1 = snap.x; wall.y1 = snap.y; }
  else             { wall.x2 = snap.x; wall.y2 = snap.y; }
  this._redraw();
  return;
}
```

**touchend/mouseup:**

```js
if (this._draggingEndpoint) {
  Storage.save(this.project);
  this._draggingEndpoint = null;
  this._snapTarget = null;
  return;
}
```

**Indicadores visuais no draw:**

```js
// Handles dourados nos endpoints da parede selecionada
if (this.selected?.type === 'wall' && this.selected?.id === wall.id) {
  for (const [ex, ey] of [[wall.x1, wall.y1], [wall.x2, wall.y2]]) {
    const sx = this._toScreenX(ex), sy = this._toScreenY(ey);
    ctx.fillStyle = '#f0a500';
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Indicador de snap ativo
if (this._snapTarget) {
  const sx = this._toScreenX(this._snapTarget.x);
  const sy = this._toScreenY(this._snapTarget.y);
  ctx.save();
  if (this._snapTarget.type === 'endpoint') {
    ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.strokeStyle = '#f0a500'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 8); ctx.lineTo(sx + 8, sy + 8);
    ctx.moveTo(sx + 8, sy - 8); ctx.lineTo(sx - 8, sy + 8);
    ctx.stroke();
  }
  ctx.restore();
}
```

#### Ordem de implementação

1. Implementar `_hitEndpoint()`
2. Adicionar `_draggingEndpoint` e `_snapTarget` no init
3. Modificar touchstart/mousedown: hit check antes do pan
4. Implementar `_nearestEndpoint()`, `_nearestWallProjection()`, `_snapEndpointDrag()`
5. Wiring no touchmove, touchend
6. Handles dourados + indicador de snap no draw

#### Como testar

| Teste | Esperado |
|---|---|
| Tocar no handle dourado do endpoint | Drag inicia |
| Tocar no meio da parede | Pan inicia normalmente |
| Arrastar até < 24px de outro endpoint | Círculo verde + posição trava |
| Arrastar até < 24px do corpo de parede | Cruz amarela + projeção perpendicular |
| Endpoint tem prioridade sobre corpo | Círculo verde (não cruz) |
| Soltar | `Storage.save` chamado, coords persistem |
| Arrastar endpoint sobre corpo da própria parede | Sem snap (excluída) |
| Dois endpoints convergem no mesmo ponto | Não crasha (`lenSq === 0` protegido) |

---

## Sprint 5 — DXF SketchUp + Modo reforma + Relatório fotos

**Ordem de implementação:** Feature 17 → Feature 16 → Feature 18

### Feature 17: Modo reforma (reclassificado de BAIXA para MEDIA prioridade)

> Reclassificado: 70-80% dos levantamentos BR sao de imoveis existentes para reforma. Nenhum concorrente tem essa feature em portugues. E o moat real do produto no mercado corporativo BR. Nao e para ultimo lugar no roadmap.

#### Schema — campos novos

Adicionar `status` em `normalizeWall`, `normalizeOpening`, `normalizeInstallation`:

```js
// data.js — normalizeWall()
status: w.status ?? 'existente', // 'existente' | 'demolir' | 'proposta'

// normalizeOpening()
status: o.status ?? 'existente',

// normalizeInstallation()
status: n.status ?? 'existente',
```

**Constantes centrais** (adicionar em `data.js` após `SCHEMA_VERSION`):

```js
const REFORMA_STATUS = {
  EXISTENTE: 'existente',
  DEMOLIR:   'demolir',
  PROPOSTA:  'proposta',
};
```

#### Tabela de layers DXF por status

| Status | Sufixo layer | Cor DXF | Tipo de linha |
|---|---|---|---|
| existente | -EXI | 7 (branco/preto) | CONTINUOUS |
| demolir | -DEM | 1 (vermelho) | DASHED |
| proposta | -PRO | 3 (verde) | CONTINUOUS |

#### Integração com dxf-writer.js

**Passo 1 — Adicionar tabela LTYPE** (DASHED para elementos demolir):

```js
_ltype(L) {
  L.push('0','TABLE','2','LTYPE','70','3');
  // CONTINUOUS
  L.push('0','LTYPE','2','CONTINUOUS','70','0','3','Solid line','72','65','73','0','40','0.0');
  // DASHED
  L.push('0','LTYPE','2','DASHED','70','0','3','Dashed','72','65','73','2',
    '40','9.525','49','6.35','74','0','49','-3.175','74','0');
  L.push('0','ENDTAB');
},
```

**Passo 2 — Layers dinâmicos:**

```js
_buildLayers(c) {
  const suffix = { existente: '-EXI', demolir: '-DEM', proposta: '-PRO' };
  const color  = { existente: 7,       demolir: 1,       proposta: 3 };
  const ltype  = { existente: 'CONTINUOUS', demolir: 'DASHED', proposta: 'CONTINUOUS' };
  const bases  = ['PAREDES','ABERTURAS','ELETRICA','HIDRAULICA','ODONTO'];
  const layers = [];
  for (const b of bases) {
    for (const s of ['existente','demolir','proposta']) {
      layers.push([b + suffix[s], color[s], ltype[s]]);
    }
  }
  layers.push(['COTAS',1,'CONTINUOUS'],['AMBIENTES',4,'CONTINUOUS'],
              ['NOTAS',6,'CONTINUOUS'],['FOTOS',6,'CONTINUOUS']);
  return layers;
},

_reformaLayer(base, element) {
  const s = element.status || 'existente';
  return base + ({ existente: '-EXI', demolir: '-DEM', proposta: '-PRO' }[s] || '-EXI');
},
```

**Passo 3 — Usar nos métodos de escrita:**

```js
// _writeWalls()
const layer = this._reformaLayer('PAREDES', w);

// _writeOpenings()
const layer = this._reformaLayer('ABERTURAS', o);

// _writeInstallations()
const base = inst.category === 'eletrica' ? 'ELETRICA'
           : inst.category === 'hidraulica' ? 'HIDRAULICA'
           : 'ODONTO';
const layer = this._reformaLayer(base, inst);
```

#### Integração com canvas-editor.js (UI)

**Select de status na sidebar (`_showProps`):**

```html
<div class="prop-row">
  <label>Status</label>
  <select id="prop-status">
    <option value="existente">Existente</option>
    <option value="demolir">Demolir</option>
    <option value="proposta">Proposta</option>
  </select>
</div>
```

```js
document.getElementById('prop-status').value = el.status || 'existente';
document.getElementById('prop-status').addEventListener('change', e => {
  el.status = e.target.value;
  this._saveAndRedraw();
});
```

**Colorização no canvas (`_drawWalls`):**

```js
const strokeColor = w.status === 'demolir'  ? '#e74c3c'
                  : w.status === 'proposta' ? '#2ecc71'
                  : '#1a1814';
ctx.strokeStyle = strokeColor;
if (w.status === 'demolir') ctx.setLineDash([12 / this.zoom, 6 / this.zoom]);
else ctx.setLineDash([]);
```

#### Ordem de implementação

1. `data.js`: constantes `REFORMA_STATUS` + `status` nos 3 normalizadores
2. `dxf-writer.js`: `_ltype()`, `_buildLayers()`, `_reformaLayer()`
3. `dxf-writer.js`: `_writeWalls()`, `_writeOpenings()`, `_writeInstallations()` usando `_reformaLayer`
4. `canvas-editor.js`: select de status na sidebar + colorização

#### Como testar

- Projeto antigo carregado: todos os elementos com `status = 'existente'` automaticamente
- Parede "demolir": layer `PAREDES-DEM`, cor 1, linetype DASHED no DXF
- Canvas: parede demolir = vermelha tracejada; proposta = verde
- DXF no AutoCAD: layers listados com cores corretas

---

### Feature 16: DXF pronto para SketchUp

#### Decisão de arquitetura

**Método separado `generateSketchup(project)`** na mesma classe `DxfWriter`. O `generate()` existente não muda — zero risco de regressão.

Diferenças do DXF SketchUp vs DXF padrão:

| Aspecto | DXF padrão | DXF SketchUp |
|---|---|---|
| Paredes | 4 LINEs | LWPOLYLINE fechada (4 vértices) |
| Ambientes | hatch/polígono | LWPOLYLINE fechada |
| Cotas | presentes | ausentes |
| Texto de instalações | presente | ausente (mantém modelo limpo) |

#### Implementação

**Calcular vértices da parede (retângulo fechado):**

```js
_wallToPolyVertices(w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len = Math.hypot(dx, dy) || 1;
  const t = (w.thickness || 150) / 2;
  const nx = (-dy / len) * t, ny = (dx / len) * t;
  return [
    { x: w.x1 + nx, y: w.y1 + ny },
    { x: w.x2 + nx, y: w.y2 + ny },
    { x: w.x2 - nx, y: w.y2 - ny },
    { x: w.x1 - nx, y: w.y1 - ny },
  ];
},
```

**LWPOLYLINE:**

```js
_lwpoly(L, layer, vertices) {
  L.push('0','LWPOLYLINE','100','AcDbEntity','8',layer,
    '100','AcDbPolyline','90',String(vertices.length),'70','1');
  for (const v of vertices) {
    L.push('10', v.x.toFixed(1), '20', (-v.y).toFixed(1));
  }
},
```

**generateSketchup:**

```js
generateSketchup(project) {
  const c = project.canvas;
  const bbox = this._calcBbox(c);
  const L = [];
  this._header(L, bbox);
  this._tablesSketchup(L, c); // versão sem COTAS/NOTAS/FOTOS
  this._blocksEmpty(L);
  L.push('0','SECTION','2','ENTITIES');
  for (const w of (c.walls || [])) {
    this._lwpoly(L, this._reformaLayer('PAREDES', w), this._wallToPolyVertices(w));
  }
  this._writeOpenings(L, c);
  for (const env of (c.environments || [])) {
    if (!env.polygon || env.polygon.length < 3) continue;
    this._lwpoly(L, 'AMBIENTES', env.polygon);
  }
  this._writeInstallationsClean(L, c); // só círculo, sem texto
  L.push('0','ENDSEC','0','EOF');
  return L.join('\r\n');
},
```

**Botão no dashboard:**

```js
// _renderCard — após botão DXF
<button class="card-btn" data-action="dxf-sketchup" data-id="${p.id}">SketchUp</button>

// Handler
case 'dxf-sketchup': {
  const proj = Storage.get(id);
  const dxf  = new DxfWriter().generateSketchup(proj);
  const blob = new Blob([dxf], { type: 'application/dxf' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `${proj.name || 'levantamento'}-sketchup.dxf`
  });
  a.click();
  URL.revokeObjectURL(url);
  break;
}
```

#### Como testar

- DXF SketchUp gerado sem erros
- Abrir no FreeCAD: cada parede = 1 polyline fechada (não 4 linhas)
- Abrir no SketchUp: Push/Pull funciona diretamente
- Ambientes = regiões fechadas distintas
- DXF padrão (botão original) continua funcionando sem regressão

---

### Feature 18: Relatório com fotos por ambiente

#### Schema

**Nenhuma mudança.** Associação por proximidade geométrica (automática).

**Adicionar `pointInPolygon` em `data.js`** (função pura global):

```js
function pointInPolygon(pt, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}
```

#### Agrupamento fotos ↔ ambiente

```js
function groupPhotosByEnvironment(canvas) {
  const result = [];
  for (const env of (canvas.environments || [])) {
    if (!env.polygon || env.polygon.length < 3) continue;
    const photos = (canvas.photoPins || []).filter(pin =>
      pin.photoData && pointInPolygon({ x: pin.x, y: pin.y }, env.polygon));
    const installations = (canvas.installations || []).filter(inst =>
      pointInPolygon({ x: inst.x, y: inst.y }, env.polygon));
    result.push({ env, photos, installations });
  }
  // Fotos sem ambiente
  const assignedIds = new Set(result.flatMap(r => r.photos.map(p => p.id)));
  const orphans = (canvas.photoPins || []).filter(p => p.photoData && !assignedIds.has(p.id));
  if (orphans.length > 0) result.push({ env: null, photos: orphans, installations: [] });
  return result.sort((a, b) => b.photos.length - a.photos.length);
}
```

#### Método `generateByEnvironment` em pdf-report.js

**Pré-condição:** o chamador deve chamar `hydrateAsync` antes para que `photoData` esteja disponível.

Estrutura de cada página por ambiente:

```
[Nome do Ambiente]          [Área: X m²]
Pé-direito: X,XX m  |  Observação: ...
─────────────────────────────────────────
FOTOS (grid 2 colunas)
─────────────────────────────────────────
INSTALAÇÕES NESTE AMBIENTE (tabela)
```

CSS essencial:

```js
const css = `
  .env-page { page-break-after: always; padding: 24px; max-width: 900px; margin: 0 auto; }
  .env-page:last-child { page-break-after: auto; }
  .env-header { border-bottom: 2px solid #c8a96e; padding-bottom: 12px; margin-bottom: 20px; }
  .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .photo-card img { width: 100%; height: 220px; object-fit: cover; border-radius: 6px; }
  .inst-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  @media print { .env-page { padding: 16px; } }
`;
```

#### Arquivos e linhas

| Arquivo | O que muda |
|---|---|
| `js/data.js` | adicionar `pointInPolygon()` global |
| `js/pdf-report.js` | adicionar `groupPhotosByEnvironment()` + método `generateByEnvironment()` |
| `js/canvas-editor.js` ou UI | botão "PDF Ambientes" com `hydrateAsync` antes da chamada |

#### Ordem de implementação

1. `data.js`: `pointInPolygon()`
2. `pdf-report.js`: `groupPhotosByEnvironment()` + `generateByEnvironment()`
3. Adicionar botão "PDF Ambientes" na UI
4. Conectar handler com `hydrateAsync` garantido

#### Como testar

- 3 ambientes, 5 fotos: fotos nas páginas corretas
- Foto fora de todos os ambientes → página "Sem ambiente"
- Ambiente sem fotos → mensagem "Nenhuma foto neste ambiente"
- Instalação dentro de ambiente → tabela daquele ambiente
- `Ctrl+P` → quebra de página entre ambientes
- `photoData = null` → pin ignorado sem crash

---

## Sprint 6 — Medição ponto-a-ponto + Multi-pavimento

**Ordem de implementação:** Schema migration → Feature 19 → Feature 20

### Feature 19: Medição ponto-a-ponto

#### Schema

Adicionar em `defaultCanvas()`:

```js
// data.js — defaultCanvas() ~linha 148
measurements: []
```

**Normalizer** (adicionar em `normalizeCanvas()`):

```js
function normalizeMeasurement(m) {
  return {
    id:      m.id      || generateId(),
    x1:      m.x1      ?? 0,
    y1:      m.y1      ?? 0,
    x2:      m.x2      ?? 0,
    y2:      m.y2      ?? 0,
    label:   m.label   ?? null,
    savedAt: m.savedAt ?? null,
  };
}

// Em normalizeCanvas():
c.measurements = Array.isArray(c.measurements)
  ? c.measurements.map(normalizeMeasurement)
  : [];
```

#### Implementação — canvas-editor.js

**Estado:**

```js
this._measureStart = null; // {x, y} em coordenadas canvas
this._measureLive  = null; // {x, y} do toque atual
```

**Fluxo de dois toques:**

```js
_clickMeasure(cx, cy) {
  const pt = this._toCanvas(cx, cy);
  if (!this._measureStart) {
    this._measureStart = pt;
    this._measureLive  = pt;
    this._setHint('Toque no segundo ponto para medir');
    this._redraw();
    return;
  }
  const dx = pt.x - this._measureStart.x;
  const dy = pt.y - this._measureStart.y;
  const distMm = Math.sqrt(dx*dx + dy*dy);
  this._showMeasureResult(this._measureStart, pt, distMm);
}

_showMeasureResult(p1, p2, distMm) {
  const distM  = (distMm / 1000).toFixed(3);
  const distCm = (distMm / 10).toFixed(1);
  Modal.show({
    title: 'Distância medida',
    body: `<div class="measure-result">
      <div style="font-size:2em;text-align:center;">${distM} m</div>
      <div style="text-align:center;color:#888;">${distCm} cm · ${Math.round(distMm)} mm</div>
      <label>Rótulo (opcional)
        <input id="measure-label" type="text" placeholder="ex: largura sala" maxlength="40">
      </label></div>`,
    buttons: [
      { label: 'Descartar', action: 'cancel', style: 'ghost' },
      { label: 'Salvar no levantamento', action: 'save', style: 'primary' },
    ],
    onAction: action => {
      if (action === 'save') {
        const label = document.getElementById('measure-label').value.trim() || null;
        this._canvas.measurements.push({
          id: generateId(), x1: p1.x, y1: p1.y,
          x2: p2.x, y2: p2.y, label, savedAt: new Date().toISOString()
        });
        this._saveDebounced();
      }
      this._measureStart = null;
      this._measureLive  = null;
      this._redraw();
      Modal.close();
    }
  });
}
```

**Renderização** — chamar ao final do `_redraw()`:

```js
_drawMeasurements(ctx) {
  // Preview linha temporária
  if (this._measureStart && this._measureLive) {
    const p1 = this._toScreen(this._measureStart);
    const p2 = this._toScreen(this._measureLive);
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    const dx = this._measureLive.x - this._measureStart.x;
    const dy = this._measureLive.y - this._measureStart.y;
    const dist = (Math.sqrt(dx*dx + dy*dy) / 1000).toFixed(2) + 'm';
    ctx.fillStyle = '#f59e0b';
    ctx.font = '13px sans-serif';
    ctx.fillText(dist, (p1.x+p2.x)/2 + 8, (p1.y+p2.y)/2 - 8);
    ctx.restore();
  }
  // Medições salvas
  for (const m of (this._canvas.measurements || [])) {
    const p1 = this._toScreen({x: m.x1, y: m.y1});
    const p2 = this._toScreen({x: m.x2, y: m.y2});
    ctx.save();
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    for (const p of [p1, p2]) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
      ctx.fillStyle = '#a78bfa'; ctx.fill();
    }
    const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
    const label = m.label || (Math.sqrt(dx*dx+dy*dy)/1000).toFixed(2) + 'm';
    ctx.fillStyle = '#a78bfa'; ctx.font = '12px sans-serif';
    ctx.fillText(label, (p1.x+p2.x)/2 + 6, (p1.y+p2.y)/2 - 6);
    ctx.restore();
  }
}
```

**Exportação DXF** — adicionar layer `MEDICAO` e método `_writeMeasurements()` (ver acima na seção DXF de P0-4 como modelo). Chamar em `_entities()` após `_writeDimensions()`.

#### Como testar

1. Ativar ferramenta measure → clicar P1 → hint muda para "segundo ponto"
2. Clicar P2 → modal com distância correta em m/cm/mm
3. Descartar → `measurements[]` vazio
4. Salvar com label → `measurements` tem 1 item com `savedAt` e `label`
5. DXF exportado contém layer `MEDICAO` com LINE e TEXT
6. Reabrir projeto → medição persiste

---

### Feature 20: Multi-pavimento

#### Schema migration — ponto mais crítico desta sprint

**`SCHEMA_VERSION` sobe de 1 para 2.**

**Estrutura do floor:**

```js
{
  id:     string,  // UUID
  name:   string,  // "Térreo", "1º Pavimento"
  order:  number,  // 0 = térreo, 1 = 1° andar
  canvas: { ...defaultCanvas() }
}
```

**Tabela de migração:**

| Versão | Campo antes | Campo depois |
|---|---|---|
| v1 | `project.canvas` (objeto) | `project.floors[0].canvas` |
| v1 | sem `project.floors` | `project.floors = [{ id, name:'Térreo', order:0, canvas: legacyCanvas }]` |
| v2 | `project.floors[]` | inalterado |

**Migração lazy em `normalizeProject`:**

```js
// data.js — normalizeProject()
if (!Array.isArray(p.floors) || p.floors.length === 0) {
  const legacyCanvas = p.canvas || defaultCanvas();
  p.floors = [{
    id:     generateId(),
    name:   'Térreo',
    order:  0,
    canvas: legacyCanvas,
  }];
  delete p.canvas; // limpar — será recriado como alias em memória
}

p.floors = p.floors.map((f, i) => ({
  id:     f.id    || generateId(),
  name:   f.name  || (i === 0 ? 'Térreo' : `${i}º Pavimento`),
  order:  f.order ?? i,
  canvas: normalizeCanvas(f.canvas || defaultCanvas()),
}));
p.floors.sort((a, b) => a.order - b.order);

// Alias em memória (não persiste no JSON.stringify)
const activeId = p._activeFloorId || p.floors[0].id;
const active = p.floors.find(f => f.id === activeId) || p.floors[0];
p._activeFloorId = active.id;

Object.defineProperty(p, 'canvas', {
  get() { return this.floors.find(f => f.id === this._activeFloorId)?.canvas; },
  set(v) {
    const f = this.floors.find(f => f.id === this._activeFloorId);
    if (f) f.canvas = v;
  },
  configurable: true,
  enumerable: false,  // não inclui no JSON.stringify — elimina risco de gravação acidental
});

p.schemaVersion = 2;
```

#### Utilitários de floor (data.js)

```js
function addFloor(project, name) {
  const order = project.floors.length;
  const floor = { id: generateId(), name: name || `${order}º Pavimento`, order, canvas: defaultCanvas() };
  project.floors.push(floor);
  return floor;
}

function renameFloor(project, floorId, newName) {
  const f = project.floors.find(f => f.id === floorId);
  if (f) f.name = newName.trim() || f.name;
}

function removeFloor(project, floorId) {
  if (project.floors.length <= 1) return false;
  project.floors = project.floors.filter(f => f.id !== floorId);
  project.floors.forEach((f, i) => { f.order = i; });
  if (project._activeFloorId === floorId) project._activeFloorId = project.floors[0].id;
  return true;
}
```

#### UI de navegação entre pavimentos

Barra de tabs acima do canvas (fora do espaço de desenho):

```js
_renderFloorBar() {
  const bar = document.getElementById('floor-bar');
  if (!bar) return;
  bar.innerHTML = this._project.floors
    .sort((a, b) => a.order - b.order)
    .map(f => `<button class="floor-tab ${f.id === this._project._activeFloorId ? 'active' : ''}"
                       data-floor-id="${f.id}">${esc(f.name)}</button>`)
    .join('') +
    `<button class="floor-tab floor-add" id="btn-add-floor">+</button>`;
}

_switchFloor(floorId) {
  // Salvar canvas atual de volta no floor ativo
  const current = this._project.floors.find(f => f.id === this._project._activeFloorId);
  if (current) current.canvas = this._canvas;
  // Ativar novo floor
  this._project._activeFloorId = floorId;
  const next = this._project.floors.find(f => f.id === floorId);
  this._canvas = next.canvas;
  this._resetView();
  this._redraw();
  this._saveDebounced();
  this._renderFloorBar();
}
```

#### IndexedDB — múltiplos pavimentos

`ImageStore.extractAndSave()` e `ImageStore.loadImages()` precisam iterar `project.floors[].canvas` em vez de `project.canvas`:

```js
extractAndSave(project) {
  const tasks = [];
  for (const floor of (project.floors || [])) {
    const c = floor.canvas;
    for (const pin of (c.photoPins || [])) {
      if (pin.photoData) {
        tasks.push(ImageStore.put(`img_${pin.id}`, pin.photoData)
          .then(() => { pin._photoRef = `img_${pin.id}`; delete pin.photoData; }));
      }
    }
    if (c.backgroundImage?.data) {
      const key = `bg_${project.id}_${floor.id}`;
      tasks.push(ImageStore.put(key, c.backgroundImage.data)
        .then(() => { c.backgroundImage._dataRef = key; delete c.backgroundImage.data; }));
    }
  }
  return Promise.all(tasks);
}
```

`ImageStore.gc()` também deve iterar todos os floors para coletar refs usadas antes de deletar.

#### Export DXF — layers por pavimento

Convenção: `PAREDES_TERREO`, `PAREDES_1PAV`, `PAREDES_2PAV`:

```js
_layerName(base, floor) {
  const suffix = floor.order === 0 ? 'TERREO' : `${floor.order}PAV`;
  return `${base}_${suffix}`;
}

// generate() itera floors:
generate(project) {
  const L = [];
  const floors = project.floors || [{ name:'Térreo', order:0, canvas: project.canvas }];
  this._header(L, this._calcBboxMulti(floors));
  this._tables(L, project);
  this._blocks(L, project);
  L.push('0','SECTION','2','ENTITIES');
  for (const floor of floors) {
    const c = floor.canvas;
    this._writeWalls(L, c, floor);
    this._writeOpenings(L, c, floor);
    this._writeDimensions(L, c, floor);
    this._writeEnvironments(L, c, floor);
    this._writeInstallations(L, c, floor);
    this._writeNotes(L, c, floor);
    this._writeMeasurements(L, c, floor);
  }
  L.push('0','ENDSEC','0','EOF');
  return L.join('\r\n');
}
```

Cada método de escrita recebe `floor` e usa `this._layerName(base, floor)`.

#### Ordem de implementação

```
Semana 1 — Schema (sem UI):
  1. data.js: SCHEMA_VERSION=2, normalizeProject com migração v1→v2
  2. data.js: Object.defineProperty para alias p.canvas
  3. data.js: addFloor, renameFloor, removeFloor
  4. data.js: measurements em defaultCanvas + normalizeMeasurement
  5. ImageStore: extractAndSave/loadImages iterando floors
  Validar: projetos antigos migram corretamente, p.canvas não aparece no JSON.stringify

Semana 2 — Feature 19 (medição):
  6. canvas-editor.js: botão, ferramenta measure, _clickMeasure, _showMeasureResult
  7. canvas-editor.js: _drawMeasurements, preview ao vivo no mousemove
  8. canvas-editor.js: seleção e exclusão de medições
  9. dxf-writer.js: layer MEDICAO + _writeMeasurements
  Validar: criar, salvar, excluir medições; DXF com layer MEDICAO

Semana 3 — UI de multi-pavimento:
  10. HTML: adicionar <div id="floor-bar"> acima do canvas
  11. canvas-editor.js: _renderFloorBar, _switchFloor
  12. canvas-editor.js: modal add/rename/delete floor
  Validar: criar pavimentos, trocar, cada um tem canvas independente

Semana 4 — Export multi-pavimento:
  13. dxf-writer.js: _layerName, generate iterando floors, _calcBboxMulti
  14. pdf-report.js: generate recebe {[floorId]: dataUrl}, itera floors
  15. canvas-editor.js/dashboard.js: gerar dataUrl por floor antes do PDF
  Validar: DXF com PAREDES_TERREO e PAREDES_1PAV; PDF com seção por andar
```

#### Como testar

**Migração:**

- Projeto antigo (v1, tem `p.canvas`) → após `normalizeProject`: `p.floors.length === 1`, `p.floors[0].name === 'Térreo'`, dados originais preservados, `p.schemaVersion === 2`
- `JSON.stringify(project)` não inclui `canvas` (enumerable: false)
- Salvar projeto migrado → recarregar → `floors[]` intacto

**Funcional:**

- Projeto novo → `floors = [{Térreo}]` por padrão
- Adicionar "1º Pavimento" → `floors.length === 2`
- Parede no Térreo → trocar para 1º Pav → canvas vazio
- Parede diferente no 1º Pav → voltar ao Térreo → Térreo intacto
- Excluir último floor → bloqueado
- DXF → layers `PAREDES_TERREO` e `PAREDES_1PAV` presentes

---

## Armadilhas globais

### Sprint 1–2

**Área ao vivo depende de `env.polygon` sempre existir.** Se um projeto antigo tem ambiente criado sem polygon (bug anterior), `polygonArea([])` retorna 0 — exibir "—" em vez de "0,00 m²" para não confundir.

**Import .elle vs schema v2.** Quando o P0-2 (Export .elle) existia com schema v1 e o Import.elle é executado após a migração para v2, o `normalizeProject` faz a migração corretamente via lazy migration — testar explicitamente.

### Sprint 3

**Bússola no Android requer HTTPS.** `DeviceOrientationEvent` não dispara em `http://` ou `file://`. A calibração manual é o fallback obrigatório — nunca depender só da bússola.

**Onboarding e backdrop click.** O `Modal.open()` existente pode fechar ao tocar fora do box. Durante o onboarding, adicionar `pointer-events: none` no backdrop para evitar saída acidental antes de completar os passos.

**Duplicar com muitas fotos pode ser lento.** O `hydrateAsync` bloqueia antes do `clone`. O Toast "Duplicando…" deve aparecer *antes* do await. Considerar timeout de 10s com mensagem de erro.

**Layers AsBEA quebram quem já recebeu DXF.** Quem montou filtros de layer em AutoCAD com os nomes legados (`PAREDES`, `ABERTURAS`) precisará reconfigurar. A flag `dxfLayerMode` é essencial — manter `'legacy'` como padrão para projetos existentes.

### Sprint 4

**Drag de endpoint vs pan.** O hit check do endpoint deve vir **antes** de qualquer lógica de pan no handler de touchstart. Usar `return` imediato após detectar o hit.

**Paredes co-localizadas.** Arrastar um endpoint deixa o endpoint co-localizado de outra parede desconectado. A abordagem simples (sem propagação) é aceitável para esta sprint — documentar como limitação conhecida.

**Ângulo travado ao cancelar.** Se a usuária pressionar Escape enquanto desenha uma parede com ângulo travado, `_lockedAngle` deve ser limpo junto com o cancelamento. Verificar todos os caminhos de cancelamento.

### Sprint 5

**`hydrateAsync` antes de `generateByEnvironment`.** A função assume que `pin.photoData` está preenchido. Se chamada sem hidratar, todas as fotos aparecem como `<img src="undefined">`. Documentar como pré-condição explícita na assinatura.

**LTYPE DASHED em LibreCAD.** O escalonamento pode diferir do AutoCAD. A usuária pode precisar ajustar `LTSCALE` no viewer. Adicionar comentário no código.

**Feature 16 + Feature 17 interagem.** `generateSketchup()` deve chamar `_reformaLayer()` para respeitar o status de reforma nos layers do SketchUp DXF.

### Sprint 6

**O alias `p.canvas` com `enumerable: false` é a proteção mais importante do multi-pavimento.** Se por qualquer razão o `Object.defineProperty` falhar (ex: o projeto já tem `canvas` como propriedade congelada), o `JSON.stringify` incluirá `canvas` e o dado será duplicado no storage. Adicionar try/catch e logar o erro.

**`structuredClone` no Storage.save.** Com `floors[]`, o clone precisa ser profundo. `structuredClone` é correto e disponível em todos os browsers alvo. Substituir clones manuais com spread por `structuredClone`.

**`gc()` do ImageStore com floors.** Deve coletar refs de **todos** os floors antes de deletar. Um `gc()` que só varre `project.canvas` (alias de um floor) vai deletar fotos dos outros pavimentos. Atualizar antes de gravar qualquer projeto com múltiplos floors reais.

---

## Checklist de testes por sprint

### P0

- [ ] `Storage.getAsync`: IDB retorna projeto; fallback localStorage funciona; `localStorage.clear()` não perde dados
- [ ] Export .elle: arquivo é JSON válido; base64 de fotos presente; tamanho proporcional às fotos
- [ ] PDF carimbo: aparece entre capa e planta; `scale=null` → "Sem escala"; não quebra no `Ctrl+P`
- [ ] DXF: abre no LibreCAD sem warnings; abre no AutoCAD Web com vírgula decimal nas cotas; zero erros no dxfvalidator.com

### Sprint 1

- [ ] Ambiente 3000×3000mm → área = 9,00 m² no canvas, sidebar e PDF
- [ ] 3 cliques do polígono sem fechar → label de área parcial visível
- [ ] Cota: tocar → numpad com valor correto; digitar novo valor → canvas atualiza; buffer vazio → automático; persistir após reload

### Sprint 2

- [ ] Abertura: selecionar → valores corretos na sidebar; editar largura → arco atualizado em tempo real; DXF reflete
- [ ] PDF: 1 ambiente retangular 3×4m → área 12,00 m², perímetro 14,00 m
- [ ] CSV: abre no Excel BR sem configuração; vírgula decimal; porta associada ao ambiente correto
- [ ] Import .elle: round-trip export→import; JSON corrompido → modal de erro; version futura → modal de erro; fotos acessíveis

### Sprint 3

- [ ] Duplicar: novo ID, "Cópia de X", canvas idêntico; fotos independentes após `gc()`
- [ ] Vírgula BR: campo de pé-direito aceita "2,70" → salva 2.70; calibração aceita "1,20"
- [ ] Layers AsBEA: DXF com `dxfLayerMode: 'asbea'` → layers `ARQ-ALV`, `ARQ-ESQ-POR`; legacy não muda
- [ ] Norte: bússola lê heading ao vivo; digitar 45° → seta no canvas; seta no PDF; bloco NORTE no DXF
- [ ] Onboarding: aparece 1x; não fecha no backdrop; pular salva flag; não aparece na segunda visita
- [ ] PWA: banner aparece após 30s; iOS mostra instruções textuais; "Agora não" salva flag

### Sprint 4

- [ ] Ângulo travado em 30°: parede nasce exatamente em 30°; badge âmbar; "Livre" reseta; finalizar limpa o lock
- [ ] Snap endpoint: handle dourado visível; arrastar < 24px de endpoint → círculo verde + trava; soltar → persiste; corpo de parede → cruz amarela; endpoint tem prioridade
- [ ] Drag não inicia pan; pan ainda funciona fora de handles

### Sprint 5

- [ ] Modo reforma: parede "demolir" → vermelha tracejada no canvas; layer `PAREDES-DEM` cor 1 DASHED no DXF; "proposta" → verde, `PAREDES-PRO` cor 3
- [ ] Projeto antigo → todos com `status = 'existente'` automaticamente
- [ ] DXF SketchUp: cada parede = 1 LWPOLYLINE fechada no FreeCAD; Push/Pull funciona no SketchUp; botão DXF original sem regressão
- [ ] Relatório fotos: 3 ambientes, 5 fotos nas páginas corretas; foto fora de ambiente → "Sem ambiente"; `Ctrl+P` → quebra entre ambientes

### Sprint 6

- [ ] Medição: dois cliques → modal com distância correta em m/cm/mm; salvar → persiste e aparece em violeta no canvas; excluir → some; DXF com layer `MEDICAO`
- [ ] Migração v1→v2: `floors.length === 1`, dados preservados, `p.canvas` não no `JSON.stringify`, `schemaVersion === 2`
- [ ] Multi-pavimento: criar, trocar, cada floor independente; excluir único floor → bloqueado; DXF com `PAREDES_TERREO` e `PAREDES_1PAV`; fotos de outros floors não deletadas pelo `gc()`