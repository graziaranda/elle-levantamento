# Blueprint — O Melhor Sistema de Levantamento Arquitetônico do Mundo

> Gerado em maio/2026. Baseado em toda a pesquisa acumulada em `docs/` e
> na leitura direta do código atual. Este é o plano de implementação —
> não há código ainda, mas cada decisão aqui descrita vai direto para código.
>
> **Contexto:** App offline, HTML/CSS/JS puro, tablet Android comum,
> arquiteta em campo (1 mão, sol na tela, pressa). Qualquer tipologia.
> Odonto como especialidade opcional, nunca como núcleo.

---

## PARTE A — O SCHEMA PERFEITO

> Cada campo existe por uma razão: ou é capturado em campo (onde não volta
> depois), ou é derivado deterministicamente no render/export. Nenhum campo
> duplica dado que já existe. Nenhum campo é cosmético.

---

### `project` (raiz do projeto)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id` | `string` | required | UUID | Chave primária. Fica. |
| `name` | `string` | required | string | Nome visível na lista. Fica. |
| `client` | `string` | optional | string | Para capa do PDF. Fica. |
| `address` | `string` | optional | string | Para capa e header do DXF. Fica. |
| `createdAt` | `string` | required | ISO 8601 | Ordenação. Fica. |
| `updatedAt` | `string` | required | ISO 8601 | Gerado no save. Fica. |
| `thumbnail` | `string\|null` | optional | base64 PNG | Preview na lista. Fica (migrar para IndexedDB na Fase 3). |
| `photos` | `array` | required | array | Fotos anotadas separadas de photoPins. Fica. |
| **`schemaVersion`** | `number` | required | inteiro | **NOVO.** Permite `normalizeProject()` saber qual migração aplicar. Projetos sem este campo são v0. |
| **`packs`** | `string[]` | required | array | **NOVO.** `[]` = genérico. `['odonto']` = especialidade odonto ativa. Controla quais tipos da INSTALLATION_LIBRARY aparecem. |
| **`floors`** | `array` | required | ver §floor | **NOVO (Fase 3).** Multi-pavimento. Na migração, `project.canvas` vira `floors[0].canvas`. |
| **`activeFloorId`** | `string` | required | UUID | **NOVO (Fase 3).** Qual pavimento está sendo editado. |

---

### `floor` (pavimento — não existe hoje, Fase 3)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id` | `string` | required | UUID | Referenciado por `project.activeFloorId`. |
| `name` | `string` | required | string | "Térreo", "1º Pavimento", "Subsolo". |
| `level` | `number` | required | inteiro | 0 = térreo, 1 = 1º pav, -1 = subsolo. Para ordenação e corte. |
| `canvas` | `object` | required | ver §canvas | Todo o conteúdo desenhado. Mesma estrutura do `defaultCanvas()` atual. |

---

### `canvas` (conteúdo do pavimento / projeto atual)

O `defaultCanvas()` atual ganha dois campos novos nas Fases 1 e 2:

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `zoom`, `panX`, `panY` | `number` | required | — | Estado da câmera. Ficam. |
| `gridVisible`, `snapEnabled` | `boolean` | required | — | Ficam. |
| `walls`, `openings`, `installations`, `photoPins`, `notes`, `dimensions`, `environments`, `backgroundImage` | `array/obj` | required | — | Ficam. Ver detalhes abaixo. |
| **`defaultPeDireito`** | `number\|null` | required | metros | **NOVO (Fase 1).** Pé-direito padrão do projeto. Null = não definido. Override por `environments[].peDireito`. |
| **`elevations`** | `array` | required | ver §elevation | **NOVO (Fase 2).** Vistas de elevação definidas pelo usuário. `[]` por padrão. |

---

### `wall` (parede)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id`, `x1`, `y1`, `x2`, `y2`, `thickness` | — | required | mm | Ficam exatamente como estão. |
| **`label`** | `string\|null` | optional | string | **NOVO.** Nome opcional para referência em elevações. Ex: "Parede Norte". |

> **NÃO salvar:** `length` — é `dist(x1,y1,x2,y2)`, sempre calculado no render.

---

### `opening` (porta/janela)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id`, `type`, `wallId`, `position`, `width`, `side` | — | required | — | Ficam. |
| **`height`** | `number\|null` | optional | mm | **Já existe no código mas não no `defaultCanvas()` doc.** Essencial para elevação. `normalizeProject()` preenche `null`. |
| **`sill`** | `number\|null` | optional | mm | **Já existe.** Peitoril da janela a partir do piso. `normalizeProject()` preenche `null`. |
| **`hingeSide`** | `string` | required | `'right'\|'left'` | **Já existe.** `normalizeProject()` preenche `'right'`. |
| **`openDir`** | `string` | required | `'in'\|'out'` | **Já existe.** `normalizeProject()` preenche `'in'`. |

> **UI:** `position` é fração interna (0..1). A UI sempre mostra e aceita distância do canto em **cm** e converte. O usuário nunca vê frações.

---

### `installation` (ponto de instalação)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id`, `type`, `x`, `y`, `observation`, `sequenceNumber` | — | required | — | Ficam. |
| **`height`** | `number\|null` | required | **cm** | **Já existe.** Unidade é CM (não mm) — linguagem de obra. Pedido na inserção (C-05). `normalizeProject()` preenche `null`. |
| **`wallId`** | `string\|null` | optional | UUID | **NOVO (Fase 3).** Se ancorado à parede. Null = ponto solto no plano. |
| **`wallT`** | `number\|null` | optional | fração 0..1 | **NOVO (Fase 3).** Posição ao longo da parede. Null quando `wallId` é null. |

> **Regra de unidade consistente:**  `height` em cm em todo lugar — campo no formulário, exibição na planta (`h=40cm`), DXF, PDF. Nunca exibir o número sem a unidade.

---

### `INSTALLATION_LIBRARY` (constante global — fora do projeto, nunca serializada)

Catálogo de tipos com alturas default baseadas na prática brasileira. Nunca salva no projeto — só o `type` (ID) e o `height` confirmado pelo usuário são persistidos.

**Estrutura de cada entrada:**
```
{ id, label, category, defaultHeight (cm|null), symbol, layerDXF, color (hex), pack (null|string) }
```

**Categorias genéricas (pack: null — aparecem em qualquer projeto):**

| Elétrica | height | Hidráulica | height |
|---|---|---|---|
| Tomada 2P+T (NBR 14136) | 30cm | Água fria | 60cm |
| Tomada alta / bancada | 105cm | Água quente | 60cm |
| Interruptor simples | 120cm | Saída de esgoto | 10cm |
| Interruptor duplo | 120cm | Ralo / caixa sifônica | 0cm |
| Interruptor 3 vias | 120cm | Ponto de gás | 45cm |
| Luminária de teto | null | Caixa de gordura | 0cm |
| Arandela / parede | 200cm | Caixa de inspeção | 0cm |
| Ponto de dados (RJ45) | 30cm | Ponto de chuveiro | 220cm |
| Ponto de TV | 30cm | Torneira / jardim | 40cm |
| Câmera CFTV | null | Registro de gaveta | 100cm |
| Split interno | 200cm | Ponto máquina de lavar | 80cm |
| Quadro de distribuição | 160cm | — | — |

**Pacote odonto (pack: `'odonto'` — só aparece se ativo):**

| Tipo | height | Símbolo DXF |
|---|---|---|
| Ar comprimido (cadeira) | 90cm | AR |
| Ponto de sugador | 90cm | SG |
| Dreno do cuspe | 10cm | DC |
| Rede de gases (O2/N2O) | 90cm | GO |
| Ponto de RX periapical | null | RX |
| Água para autoclave | 80cm | AA |
| Aspirador cirúrgico | 90cm | AS |

**Pacote restaurante (pack: `'restaurante'`):**

| Tipo | height | Símbolo DXF |
|---|---|---|
| Exaustão / coifa | null | EX |
| Gás industrial | 45cm | GI |
| Tomada trifásica (380V) | 30cm | T3F |
| Caixa de gordura (grande) | 0cm | CGR |

**Regra de packs:**
```javascript
getAvailableTypes(project) {
  return INSTALL_LIBRARY.filter(e =>
    e.pack === null || project.packs.includes(e.pack)
  );
}
```
Zero código novo para adicionar um pack — só dados.

---

### `dimension` (cota)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id`, `x1`, `y1`, `x2`, `y2`, `value`, `offset` | — | required | mm | Ficam. `value: null` = calculado da geometria. `offset: 400mm` default. |
| **`wallId`** | `string\|null` | optional | UUID | **NOVO.** Cota derivada da parede — se a parede mover, a cota acompanha. Null = cota livre. |
| **`label`** | `string\|null` | optional | string | **NOVO.** Texto sobreposto. Ex: "VÃO", "AFASTAMENTO". Null = só o valor numérico. |

---

### `environment` (ambiente/cômodo)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id`, `name`, `polygon`, `peDireito`, `observation` | — | required/optional | — | Ficam. |
| **`color`** | `string\|null` | optional | hex CSS | **NOVO.** Cor de preenchimento. Null = padrão do sistema. |
| **`centroid`, `area`** | — | — | — | **NÃO salvar.** São derivados de `polygon` no render. Se salvos, ficam desatualizados ao editar o polígono. `normalizeProject()` deve removê-los do JSON persistido. |
| **`perimeter`** | — | — | — | **NÃO salvar.** Calculado no render para tokens `<perimetro>`. |

> **Herança de pé-direito:** `peDireito = ambiente.peDireito ?? canvas.defaultPeDireito ?? null`

---

### `note` (nota)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id`, `x`, `y`, `text` | — | required | — | Ficam. `text` suporta tokens: `<area>`, `<perimetro>`, `<pe_direito>`. |
| **`environmentId`** | `string\|null` | optional | UUID | **NOVO.** Para resolução de tokens dinâmicos. Null = nota global. `normalizeProject()` preenche `null`. |

---

### `photoPins` (foto georreferenciada)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id`, `x`, `y`, `photoData`, `sequenceNumber` | — | required | — | Ficam. `photoData` em base64 (problema de quota — migrar para IndexedDB na Fase 3). |
| `annotations` | `array` | required | — | Já existe no código, falta no `defaultCanvas()` doc. `normalizeProject()` preenche `[]`. |
| **`caption`** | `string` | required | string | **NOVO.** Legenda para relatório PDF. Default `''`. |

---

### `backgroundImage` (imagem de fundo)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `data`, `x`, `y`, `scale`, `opacity` | — | — | — | Ficam. `data` em base64 (migrar para IndexedDB na Fase 3). |
| **`rotation`** | `number` | required | graus | **NOVO.** Rotação da imagem. Default `0`. Para foto de campo não alinhada com as paredes. |
| **`calibrationPoints`** | `array\|null` | optional | — | **NOVO.** Os 2 pontos de calibração (pixel + mm real). Permite recalibrar sem refazer. |

---

### `elevation` (vista de elevação — não existe hoje, Fase 2)

| Campo | Tipo | Obrig. | Unidade | Decisão |
|---|---|---|---|---|
| `id` | `string` | required | UUID | Chave. |
| `wallId` | `string` | required | UUID | Parede que é a face desta vista. |
| `name` | `string` | required | string | Ex: "Elevação Norte", "Parede Consultório 01". |
| `environmentId` | `string\|null` | optional | UUID | Fornece `peDireito`. Null = usa `canvas.defaultPeDireito`. |
| `showDimensions` | `boolean` | required | — | Gera cotas automáticas de aberturas. Default `true`. |
| `showInstallations` | `boolean` | required | — | Exibe instalações com altura. Default `true`. |

> **Tudo é derivado no render — não duplicar dados:**
> - Aberturas: `openings.filter(o => o.wallId === ev.wallId)` → posição, largura, altura, peitoril
> - Instalações: pontos próximos da parede projetados na elevação → altura
> - Pé-direito: `environment.peDireito ?? canvas.defaultPeDireito`

---

## PARTE B — MIGRAÇÃO SEM QUEBRAR DADOS

### `normalizeProject()` evoluído

```
normalizeProject(p):
  1. Detectar schemaVersion (ausente = v0)
  2. Se v0 e tem p.canvas sem p.floors → migrar para floors[0] (Fase 3)
  3. Garantir: project.packs = [], project.schemaVersion = 1
  4. Para cada floor: normalizeFloor(floor)
     → normalizeCanvas(canvas)
        → normalizeWall(w) para cada wall
        → normalizeOpening(o) para cada opening
        → normalizeInstallation(i) para cada installation
        → normalizePhotoPin(p) para cada photoPins
        → normalizeNote(n) para cada notes
        → normalizeDimension(d) para cada dimensions
        → normalizeEnvironment(e) para cada environments
        → normalizeElevation(ev) para cada elevations
        → canvas.defaultPeDireito = canvas.defaultPeDireito ?? null
        → canvas.elevations = canvas.elevations ?? []
```

**Normalizadores por entidade (o que cada um garante):**

```
normalizeWall(w):       { ...w, label: w.label ?? null }

normalizeOpening(o):    { ...o, height: o.height ?? null,
                               sill: o.sill ?? null,
                               hingeSide: o.hingeSide ?? 'right',
                               openDir: o.openDir ?? 'in',
                               side: o.side ?? 'right' }

normalizeInstallation(i): { ...i, height: i.height ?? null,
                                  observation: i.observation ?? '',
                                  sequenceNumber: i.sequenceNumber ?? 1,
                                  wallId: i.wallId ?? null,
                                  wallT: i.wallT ?? null }

normalizePhotoPin(p):   { ...p, annotations: p.annotations ?? [],
                               caption: p.caption ?? '' }

normalizeNote(n):        { ...n, environmentId: n.environmentId ?? null }

normalizeDimension(d):  { ...d, value: d.value ?? null,
                               offset: d.offset ?? 400,
                               wallId: d.wallId ?? null,
                               label: d.label ?? null }

normalizeEnvironment(e): { id: e.id, name: e.name,
                           polygon: e.polygon ?? [],
                           peDireito: e.peDireito ?? null,
                           observation: e.observation ?? '',
                           color: e.color ?? null }
                         // ← REMOVE centroid e area (derivados)

normalizeElevation(ev): { ...ev, showDimensions: ev.showDimensions ?? true,
                                 showInstallations: ev.showInstallations ?? true,
                                 environmentId: ev.environmentId ?? null }
```

**Migração v0 → v1 (single-floor → multi-floor, Fase 3):**
```
se !p.floors e p.canvas:
  floorId = generateId()
  p.floors = [{ id: floorId, name: 'Térreo', level: 0, canvas: p.canvas }]
  p.activeFloorId = floorId
  delete p.canvas
  p.schemaVersion = 1
```

**Invariantes:**
- `normalizeProject` nunca remove campos desconhecidos (futuro retrocompatível)
- A migração v0→v1 é idempotente — se rodar duas vezes, não cria dois floors
- `Storage.get()`, `Storage.getList()` e `Storage.save()` — todos passam por `normalizeProject()`

---

## PARTE C — OS 14 CRÍTICOS: COMO RESOLVER

> Ordered da mais rápida/independente para a mais estrutural.

### Bloco 1 — Correções rápidas, independentes (fazer primeiro)

| # | Crítico | Arquivo/função | Solução em 1 linha |
|---|---|---|---|
| C-14 | `parseFloat` quebra com vírgula | `canvas-editor.js` → toda chamada de `parseFloat(input.value)` | Extrair `parseLocaleFloat(s) = parseFloat(String(s).replace(',','.'))` e usar em todo lugar |
| C-08 | Numpad sem tecla decimal | `_numpad()` grid array | Substituir `'clear'` por `','`. Lógica: se já tem separador, ignorar; senão appendar. `parseLocaleFloat` já converte. |
| C-06 | Threshold de fechamento muito pequeno | `_wallAim()` linha com `< 30` | Mudar para `dist(...) * zoom < 50`. Quando `_aimClosing = true`, mostrar halo verde + badge "Solte para fechar" em `_drawPreview()`. |
| C-07 | Sem feedback de snap travado | `_wallAim()` + `_drawPreview()` | Se `aimAngle !== rawAngle` (snap ativo): linha preview fica dourado sólido + badge "90°"/"45°"/"0°" ao lado do ponto de destino. |
| C-10 | Dois undos com comportamentos opostos | `_updateWallActions()` + `_resetWallChain()` | Enquanto `_chainPts.length > 0`: `btn-undo.style.display = 'none'`. Ao resetar: restaurar. |

### Bloco 2 — Mecanismo de history (resolver junto)

| # | Crítico | Solução |
|---|---|---|
| C-12 | Undo off-by-one | Em `_initCanvas()`: `this.history = [JSON.stringify(project.canvas)]; this.historyIdx = 0`. Estado inicial salvo antes de qualquer ação. |
| C-03 | Não existe redo | `_redo()`: se `historyIdx < history.length - 1`, incrementa e restaura. Botão ao lado do undo, sempre visível. `Ctrl+Y` no keyboard handler. |

### Bloco 3 — Fluxo principal de campo

| # | Crítico | Arquivo/função | Solução |
|---|---|---|---|
| C-05 | Altura de instalação não pedida | `_showInstallModal()` | Fluxo 2 estágios: toca tipo → mini-form aparece com "Altura (cm): [30]" pré-preenchido da `INSTALL_TYPES` + botão "Inserir". 1 toque a mais, dado nunca null. |
| C-01 | Modal cobre a planta | `_openOpeningForm()` → substituir `Modal.open()` por `_openSidePanel()` | Painel lateral `position: fixed; right: 0; width: 320px; height: 100%` sem backdrop. Canvas visível. Prévia ao vivo aparece. |
| C-04 | Impossível reposicionar abertura | `_showProps(o, 'opening')` | Adicionar campo "Distância do canto (cm)" calculado de `position * wallLen`. Listener `input` recalcula `position` e redesenha em tempo real. |
| C-11 | PDF borrado com zoom baixo | `btn-pdf` handler em `canvas-editor.js` | `_renderToOffscreen(2480, 3508)` — canvas offscreen com zoom calculado para encaixar toda a planta em A4 a 300dpi. Canvas visível não é tocado. |
| C-13 | Mover parede não existe | `_showProps(w, 'wall')` | **Mínimo viável:** campos X1, Y1, X2, Y2 editáveis em cm no sidebar. **Completo:** drag da parede selecionada no `_onTouchMove` com `selected.type === 'wall'`. |
| C-09 | DXF sem DIMENSION real | `dxf-writer.js` | Implementar entidade DIMENSION (tipo 1 = alinhada) com seção BLOCKS. Ver Parte D. |

### Bloco 4 — Estrutural (por último, isolado)

| # | Crítico | Solução |
|---|---|---|
| C-02 | Multi-pavimento não existe | `normalizeProject()` migra `p.canvas` → `floors[0]`. `canvas-editor.js` usa getter `activeFloor.canvas`. UI: aba de seleção de pavimento no header. DXF/PDF exportam pavimento ativo ou todos. |

---

## PARTE D — O DXF IDEAL

### Layers do arquivo gerado

| Layer | Cor DXF | Conteúdo |
|---|---|---|
| `PAREDES` | 7 (branco) | 4 LINEs por parede (2 faces + 2 tampos) |
| `ABERTURAS` | 3 (verde) | Linha do vão + arco porta (geometria correta) + símbolo janela |
| `COTAS` | 1 (vermelho) | **Entidades DIMENSION reais** (não LINE+TEXT) |
| `AMBIENTES` | 4 (ciano) | Polígonos + textos nome/área/pé-direito |
| `ELETRICA` | 2 (amarelo) | CIRCLE + código + altura anotada como mini-cota |
| `HIDRAULICA` | 5 (azul) | CIRCLE + código + altura anotada |
| `NOTAS` | 6 (magenta) | Textos de notas (separado de FOTOS) |
| `FOTOS` | 6 | Marcadores de photo pins F1, F2... (separado de NOTAS) |
| `ELEVACAO_*` | 3 (verde) | Vista de elevação por parede (ex: `ELEVACAO_NORTE`) — gerada quando há elevações definidas |

> **Correção do bug de arco de porta:**
> O `_arc()` atual usa ângulo calculado no espaço canvas sem compensar a inversão Y do DXF.
> Solução: extrair `computeDoorGeometry(wall, opening)` como helper compartilhado entre
> `canvas-editor.js` e `dxf-writer.js`. O DXF usa exatamente a mesma geometria do canvas.
> Elimina a divergência: o que o usuário vê = o que vai no arquivo.

> **Entidade DIMENSION real:**
> DXF tipo `1` (aligned linear). Grupos: `0 DIMENSION`, `8 COTAS`, `2 *D1` (bloco de fallback),
> `70 1`, `10/20` (ponto de texto), `13/23` (ponto 1), `14/24` (ponto 2), `42` (valor medido),
> `1` (texto string). A seção `BLOCKS` contém `*D1` com LINE+TEXT como fallback visual para
> visualizadores simples. AutoCAD LT usa a entidade nativa; outros usam o bloco.

> **Bounding box dinâmica:**
> `$EXTMIN` / `$EXTMAX` calculados a partir de todos os elementos (hoje hardcoded em 50000,50000).
> Sem isso, o AutoCAD abre com zoom errado.

---

## PARTE E — VISTA DE ELEVAÇÃO 2D: COMO FUNCIONA

### Fluxo de uso (toques)

1. Ferramenta **Select** → toca em uma parede → sidebar abre com props da parede
2. No sidebar: botão "📐 Ver elevação" (visível quando a parede pertence a ambiente com `peDireito`)
3. Canvas muda de modo: planta some, elevação frontal da parede aparece
4. Header mostra: "Elevação — [nome ambiente] — Parede N" + botão "← Voltar"
5. Na elevação: cotas automáticas aparecem; ferramenta de cota funciona normalmente
6. "← Voltar" restaura a planta — alterações já salvas

### O que aparece na elevação

- **Linha de piso** (espessa, y=0)
- **Retângulo da parede** (espessura × pé-direito)
- **Aberturas:** retângulo proporcional na posição correta. Porta: vão do piso + arco de varredura. Janela: de `sill` até `sill + height`, com símbolo de caixilho.
- **Instalações:** símbolo circular na posição projetada, na altura exata (`installation.height`)
- **Cotas automáticas geradas ao entrar na vista:**
  - Vertical: pé-direito (esquerda), peitoril de cada janela (direita), altura de cada instalação
  - Horizontal: largura de cada vão, distância do canto, espaços entre vãos
- **Cotas manuais:** ferramenta de cota ativa normalmente dentro do modo elevação

### Exportação

**DXF:** Layer `ELEVACAO_[nome_parede]`. Elevação posicionada ao lado da planta baixa (offset X = maxX + 5000mm). Cotas automáticas em layer `COTAS` como entidades DIMENSION.

**PDF:** Seção "Elevações" no relatório, após a planta baixa. Capturada via `_renderToOffscreen()` em modo elevação para cada parede com vista definida.

---

## PARTE F — OS 5 DIFERENCIAIS ABSOLUTOS

> O que torna o Elle genuinamente único — coisas que nenhum concorrente faz bem.

---

### Diferencial 1 · DXF com DIMENSION reais + elevações + legenda automática

**O gap:** MagicPlan documenta oficialmente que não gera cotas no DXF. OrthoGraph requer exportar IFC para ArchiCAD só para ter uma elevação. RoomScan não tem instalações. Floor Plan Creator não tem elevação.

**O que o Elle entrega:** Um arquivo DXF que o projetista abre e usa — cotas como entidades nativas editáveis, elevações por parede com aberturas e instalações cotadas, legenda automática (T1=Tomada, AF1=Água fria) gerada dos `sequenceNumber` já existentes. O retrabalho de escritório que hoje existe após cada levantamento some.

**Impacto:** Para 3 levantamentos por semana → ~6–12 horas/semana recuperadas no escritório.

---

### Diferencial 2 · Biblioteca PT-BR com altura sugerida — odonto incluído

**O gap:** OrthoGraph tem biblioteca internacional. MagicPlan exige 6+ toques por altura. Floor Plan Creator não tem hidráulica. RoomScan não tem instalações.

**O que o Elle entrega:** Tabela de tipos em português com alturas padrão baseadas na prática brasileira (tomada a 30cm, interruptor a 120cm, ar comprimido de cadeira a 90cm). Fluxo de 2 estágios: toca tipo → altura já preenchida → 1 toque para confirmar. O pack odonto ativa tipos específicos de consultório sem contaminar o núcleo genérico.

**Impacto:** 40 pontos de instalação: de ~200 toques para ~80. Redução de 60% nas interações mais repetitivas do levantamento técnico.

---

### Diferencial 3 · Undo + Redo funcionando corretamente desde o primeiro uso

**O gap:** MagicPlan tem undo mas sem redo. OrthoGraph tem undo opaco. RoomScan não tem undo documentado — usuários resscanam em vez de editar. Floor Plan Creator tem undo sem indicação de escopo.

**O que o Elle entrega:** Estado inicial salvo (C-12), undo funcional desde a primeira parede, redo ao lado do undo (C-03), botão de undo global hidden durante cadeia de paredes para não destruir trabalho acidentalmente (C-10). Toast indicando o que foi desfeito. O sistema mais confiável dos 5 apps no mercado.

**Impacto:** Elimina o cenário de "perdi a cadeia inteira de paredes". O pior ponto de abandono do app.

---

### Diferencial 4 · Fechamento de ambiente que funciona na primeira tentativa

**O gap:** Threshold de 30px a zoom 0,15 falha para a maioria dos dedos. Nenhum concorrente resolve a seleção precisa com o dedo — é o ponto de dor mais universal de todos os 4.

**O que o Elle entrega:** Threshold de 50px de tela (independente do zoom) + halo verde pulsante + badge "Solte para fechar" quando o dedo está na zona. Feedback antes de soltar. Fechamento garantido na primeira tentativa para qualquer tamanho de dedo.

**Impacto:** Elimina a frustração de "tentei fechar 4 vezes, o app está quebrado".

---

### Diferencial 5 · 100% offline, sem login, sem assinatura — dados no dispositivo

**O gap:** OrthoGraph exige login antes de qualquer coisa (nota 2,1/5). MagicPlan perde projetos ao mudar assinatura (documentado no Capterra). Floor Plan Creator cobra DXF avulso. RoomScan requer iPad Pro.

**O que o Elle entrega:** Abre, desenha, exporta sem internet. Sem conta. Sem assinatura. Os dados ficam no localStorage do tablet da arquiteta. O export de DXF e PDF acontece via `Blob` + `<a download>` sem servidor. Funciona em área rural sem sinal com qualquer tablet Android de entrada.

**Impacto:** O app funciona no primeiro segundo do primeiro uso, em qualquer lugar. Zero fricção de onboarding.

---

## PARTE G — ORDEM DE EXECUÇÃO

### Como atacar — da mais rápida para a mais estrutural

```
SPRINT 1 — Correções rápidas (1–2 dias)
  C-14  parseLocaleFloat em todo parseFloat de formulário
  C-08  Tecla decimal no numpad
  C-06  Threshold 30px → 50px + halo verde de fechamento
  C-07  Badge de ângulo travado na linha de prévia
  C-10  Esconder btn-undo durante cadeia de paredes
  C-12  Estado inicial no history (junto com C-03)
  C-03  _redo() + botão redo no header

SPRINT 2 — Fluxo principal de campo (3–5 dias)
  C-05  Fluxo 2 estágios no modal de instalação + INSTALL_TYPES
  C-01  Painel lateral para abertura (sem backdrop)
  C-04  Campo "Distância do canto" no sidebar de abertura
  C-11  _renderToOffscreen() para PDF nítido
  C-13  Campos editáveis X1Y1X2Y2 no sidebar de parede (mínimo viável)
  1.5   canvas.defaultPeDireito no schema + normalizeProject()
  2.1   INSTALLATION_LIBRARY PT-BR completa

SPRINT 3 — DXF profissional (3–5 dias)
  C-09  Entidade DIMENSION real no dxf-writer.js
        computeDoorGeometry() compartilhado
        Layers NOTAS e FOTOS separadas
        $EXTMIN/$EXTMAX dinâmico
        MTEXT para textos com caracteres especiais PT-BR

SPRINT 4 — Elevação 2D (5–7 dias)
  2.5   canvas.elevations[] no schema
        Modo de elevação no canvas-editor
        Renderização: pé-direito, aberturas, instalações, cotas automáticas
        Export DXF layer ELEVACAO_*
        Export PDF seção Elevações

SPRINT 5 — Multi-pavimento (5–7 dias, isolado)
  C-02  normalizeProject() migra project.canvas → floors[0]
        Getter activeFloor.canvas no canvas-editor
        Seletor de abas no header
        Referência cruzada (camada fantasma)
        DXF/PDF iterando floors[]

SPRINT 6 — Especialidade e polish
        Packs: UI de toggle em Configurações do Projeto
        Pack odonto: tipos completos na INSTALL_LIBRARY
        Pack restaurante: tipos completos
        Drag de parede (upgrade de C-13)
        Instalação ancorada à parede (wallId + wallT)
        IndexedDB para imagens (resolve bug de quota)
```

---

## REGRA DE OURO PARA CADA DECISÃO

> Se você só pudesse fazer uma coisa por sprint, qual travaria o maior trabalho
> de campo depois da visita?

**Sprint 1:** C-06 (fechamento de ambiente) — elimina a principal causa de abandono do fluxo guiado.
**Sprint 2:** C-05 (altura na inserção) — único crítico onde o dado nunca entra e não pode ser recuperado.
**Sprint 3:** C-09 (DXF com DIMENSION) — transforma o export de "planta morta" em entregável profissional.
**Sprint 4:** Elevação 2D — o vácuo que nenhum concorrente preenche, com dados que já existem.
**Sprint 5:** Multi-pavimento — o último, porque é o mais estrutural e quebra retrocompatibilidade se errado.

---

*Schema, migração e ordem de execução baseados em leitura direta do código
(`data.js` commit 041386e) e em toda a documentação acumulada em `docs/`.*
