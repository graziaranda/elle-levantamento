# Roadmap — Elle Levantamento

App offline de levantamento arquitetônico em campo. HTML/CSS/JS puro, dados em
localStorage, coordenadas internas em mm, tablet sem nuvem/login. O núcleo é
**genérico** (qualquer tipologia). Odonto é **pacote opcional**, nunca o eixo.

> Documento gerado em maio/2026. Baseado em análise completa de concorrentes
> (OrthoGraph, MagicPlan, RoomScan Pro, Floor Plan Creator) e na leitura direta
> do código-fonte atual (`data.js`, `canvas-editor.js`, `dxf-writer.js`, `pdf-report.js`).

---

## Lente de priorização (aplicada a tudo abaixo)

1. **GENÉRICO > ESPECIALIDADE** — um recurso só entra se serve qualquer
   levantamento. Odonto só especializa o que já é genérico.
2. **BACKEND ANTES DO FRONT** — schema decidido primeiro, UI depois.
3. **DADOS EXISTENTES PRIMEIRO** — se o dado já está no `data.js`
   (`dimensions.value`, `openings.height`, `environments.peDireito`), o custo é
   só renderizar/exportar, não modelar.
4. **RETROCOMPATIBILIDADE** — todo projeto antigo abre sem quebrar.
   `normalizeProject()` migra automaticamente.

---

## 0. Estado atual confirmado pelo código

O `data.js` JÁ TEM `normalizeProject()` funcional que garante retrocompatibilidade
básica (preenche arrays ausentes, photoPins, photos). No entanto, a função atual
**não normaliza campos individuais dentro de entidades** (ex: `openings.height`,
`openings.hingeSide`, `photoPins.annotations`, `installations.sequenceNumber`).
Os comentários do `defaultCanvas()` também estão desatualizados (não listam
os campos adicionados ao schema nos últimos ciclos).

**Ação imediata necessária:**
- Reforçar `normalizeProject()` com normalizadores por entidade
- Atualizar comentários do `defaultCanvas()` para refletir o schema real

Isso é o pré-requisito zero de qualquer mudança de schema das fases abaixo.

---

## 1. Classificação de cada recurso

### JÁ TEMOS

| Recurso | Estado | Reforço necessário |
|---|---|---|
| Parede guiada (âncora + snap 0/45/90 + numpad cm) | ✅ OK | Comprimento ao vivo durante o arraste (ver COPIAR/RoomScan) |
| Auto-close de ambiente | ✅ OK | — |
| Undo (20 snapshots JSON do canvas) | ⚠️ Incompleto | Falta **redo**. Snapshots do canvas inteiro escalam mal em projetos grandes — aceitável por ora |
| Porta/Janela: formulário completo (largura, dist. canto, dobradiça, peitoril, preview ao vivo) | ✅ OK | Corte visual da parede no vão (ver COPIAR/MagicPlan) |
| 13 tipos de instalação com altura e observação | ✅ OK | Biblioteca PT-BR com alturas padrão é o diferencial A |
| Dimensões/cotas (2 toques, linha, label) | ⚠️ Incompleto | Exportar como entidade DIMENSION real no DXF (ver DIFERENCIAL D) |
| Fotos georreferenciadas + PhotoAnnotator | ✅ OK | — |
| Notas posicionadas com texto | ⚠️ Incompleto | Rótulos dinâmicos `<area>`, `<perimetro>` (ver COPIAR/Floor Plan Creator) |
| Ambiente: polígono, área Shoelace, centroide, pé-direito | ✅ OK | — |
| Background image + calibração de 2 pontos | ✅ OK | — |
| Select multi-elemento + props no sidebar | ✅ OK | — |
| Touch: 1 dedo = ação de ferramenta / 2 dedos = zoom+pan | ✅ OK — já resolve erro nº1 dos concorrentes | **Sagrado. Nunca regredir.** |
| DXF: 7 layers (PAREDES, ABERTURAS, ELETRICA, HIDRAULICA, COTAS, TEXTO, AMBIENTES) | ⚠️ Incompleto | Cotas como DIMENSION real (D); elevação como nova layer (B) |
| PDF: capa + planta + tabelas (ambientes, instalações, notas, fotos) | ✅ OK | Incluir vistas de elevação quando implementadas |
| `normalizeProject()` básico | ⚠️ Incompleto | Reforçar com normalizadores por entidade |

---

### COPIAR

Interações boas de concorrentes que valem trazer para o Elle.

| De qual app | O quê | Por que funciona no campo | Impacto | Esforço | Mudança data.js |
|---|---|---|---|---|---|
| **RoomScan Pro** | Comprimento ao vivo no segmento durante o arraste da parede | Feedback imediato a cada gesto; reduz refação e erro de digitação | **Alto** | Baixo | Nenhuma — render sobre `_chainPts` existente |
| **MagicPlan** | Corte automático da parede no vão da abertura | Planta lê como planta real; elimina ambiguidade visual | Médio | Médio | Nenhuma — `openings.wallId/position/width` já existem; só geometria de renderização e DXF |
| **MagicPlan** | Pé-direito default de projeto + override por ambiente | Evita digitar 2,40m em cada sala; regra simples: individual prevalece sobre global | Médio | Baixo | `canvas.defaultPeDireito` (novo campo); `environments.peDireito` vira override opcional |
| **Floor Plan Creator** | Undo + Redo juntos, 1 toque cada | Confiança em campo; corrige o undo opaco do OrthoGraph; sem redo é risco real no canteiro | **Alto** | Baixo | Nenhuma — segunda pilha de snapshots em memória |
| **Floor Plan Creator** | Rótulos dinâmicos em notas: `<area>`, `<perimetro>`, `<pe_direito>` | Tabela viva sem retrabalho de digitação | Médio | Médio | `notes.text` aceita tokens — resolução em render/export; sem novo campo |
| **Floor Plan Creator** | Hit-test de parede ≥ ±12px além da linha visível | Selecionar parede fina com o dedo é o pior atrito relatado em todos os 4 concorrentes | **Alto** | Baixo | Nenhuma |
| **OrthoGraph** | Cota automática ao receber medida (numpad → cria `dimensions` da parede) | Medida vira cota sem passo extra; fluxo de campo mais rápido | Médio | Médio | Nenhuma — cria dimensão de `walls` já medida |

---

### DIFERENCIAL

Vácuos que **nenhum** dos 4 concorrentes preenche. Território livre do Elle.

| ID | O quê | Por que é exclusivo | Impacto | Esforço | Mudança data.js |
|---|---|---|---|---|---|
| **A** | Biblioteca elétrica/hidráulica PT-BR com altura padrão por tipo | Todos têm algo genérico ou nada. Nenhum tem catálogo PT-BR (NBR, padrão 2P+T, terminologia de obra brasileira) com alturas sugeridas | **Alto** | Médio | `INSTALLATION_LIBRARY` constante (fora do projeto); `installations.height` vira override do padrão da biblioteca |
| **B** | Vista de elevação 2D ortogonal cotada (parede vista de frente, com aberturas e instalações na altura real) | MagicPlan admite que a sua "Elevation View" não é técnica. Os outros 3 nem têm. Os dados já existem (`openings.height/sill`, `installations.height`, `environments.peDireito`) | **Alto** | Alto | `canvas.elevations: [{ id, wallId, name }]` — derivado de dados existentes, sem duplicação |
| **C** | Alinhamento entre pavimentos (visualizar pavimento inferior como camada fantasma para prumadas) | Todos os 4 declaram explicitamente: sem alinhamento automático. Prumadas hidráulicas e shafts são dor real em clínica 2 pavimentos | Médio | Alto | `project.floors: [{ id, name, level, canvas }]` — refatoração estrutural; fica na Fase 3 |
| **D** | DXF com cotas como entidades DIMENSION reais (não texto solto) | MagicPlan documenta oficialmente que não gera cotas no DXF. É a falha nº1 do líder de mercado | **Alto** | Médio | Nenhuma — `dimensions.value` já existe; trabalho em `dxf-writer.js` |
| **E** | Usável com 1 mão, em pé, no campo | Diagnóstico universal: nenhum dos 4 é usável assim. É disciplina de UI contínua | **Alto** | Médio (incremental) | Nenhuma — é critério de design, não schema |

---

### NÃO FAZER

| Recurso | Por que não cabe |
|---|---|
| Captura LiDAR / scan 3D automático | Exige iPad Pro 2020+; erro 10-15cm em ambientes mobiliados; contraria "tablet comum". Mata o posicionamento offline/barato |
| Visualização 3D interativa | Custo altíssimo em JS puro sem WebGL; campo precisa de planta 2D e elevação cotada, não de 3D bonito (lição do bug 3D do OrthoGraph) |
| Login / conta / nuvem obrigatória | Contradiz o princípio central. É a falha nº1 de OrthoGraph (2,1/5 App Store) e MagicPlan (projetos perdidos ao mudar assinatura) |
| Paredes curvas | Nenhum concorrente resolve bem; raríssimo em levantamento de interiores; custo alto de geometria, snap e DXF. Prioridade zero |
| Integração com laser Bluetooth (Fase 1–2) | Hardware-dependente. O numpad atual cobre 90% do valor. Reavaliar como plugin na Fase 3 se houver demanda real |
| 3D / BIM / IFC / point cloud | Fora do escopo de levantamento 2D de campo |
| Varredura de quartos com câmera | Impreciso (erro 10-15cm), quebra em ambientes com móveis, inútil sem LiDAR |

---

## 2. Roadmap em fases

### FASE 1 — MVP indispensável
*Objetivo: qualquer tipologia sai com levantamento completo e exportável.
Sem risco de perder dado em campo. Base sólida para tudo que vem depois.*

| # | Item | Categoria | Dados |
|---|---|---|---|
| 1.0 | Reforçar `normalizeProject()` com normalizadores por entidade + atualizar comentários de `defaultCanvas()` | Infra | Migração de campos ausentes: `openings.height`, `openings.hingeSide`, `openings.openDir`, `photoPins.annotations`, `installations.sequenceNumber`, `dimensions.offset` |
| 1.1 | Redo ao lado do undo, 1 toque cada | COPIAR / Floor Plan Creator | Nenhuma |
| 1.2 | Hit-test de parede ≥ ±12px + snap amplo | COPIAR / Floor Plan Creator | Nenhuma |
| 1.3 | Comprimento ao vivo durante o arraste da parede | COPIAR / RoomScan | Nenhuma |
| 1.4 | DXF com cotas DIMENSION reais | DIFERENCIAL D | Nenhuma (`dimensions.value` existe) |
| 1.5 | Pé-direito default de projeto + override por ambiente | COPIAR / MagicPlan | `canvas.defaultPeDireito` (novo campo) |

**Critério de saída da Fase 1:** abrir projeto antigo sem erro, desenhar planta de qualquer tipologia, cotar, exportar DXF com cotas reais e PDF.

---

### FASE 2 — Diferenciais competitivos
*Objetivo: colocar o Elle à frente dos concorrentes. Recursos que nenhum deles
entrega de forma satisfatória.*

| # | Item | Categoria | Dados |
|---|---|---|---|
| 2.1 | Biblioteca elétrica/hidráulica PT-BR com altura padrão por tipo | DIFERENCIAL A | `INSTALLATION_LIBRARY` constante; `installations.height` como override |
| 2.2 | Corte automático da parede no vão da abertura | COPIAR / MagicPlan | Nenhuma (render + DXF) |
| 2.3 | Cota automática ao receber medida (parede medida → gera dimensão) | COPIAR / OrthoGraph | Nenhuma |
| 2.4 | Rótulos dinâmicos em notas: `<area>`, `<perimetro>`, `<pe_direito>` | COPIAR / Floor Plan Creator | `notes.text` com tokens; sem novo campo |
| 2.5 | Vista de elevação 2D ortogonal cotada (por parede, com aberturas e instalações) | DIFERENCIAL B | `canvas.elevations: [{ id, wallId, name }]` |

---

### FASE 3 — Refinamentos avançados + pacotes de especialidade

| # | Item | Categoria | Dados |
|---|---|---|---|
| 3.1 | Multi-pavimento com alinhamento entre andares (camada fantasma) | DIFERENCIAL C | `project.floors: [{ id, name, level, canvas }]` — refatoração estrutural |
| 3.2 | Pacote ODONTO (pack opcional, não no núcleo) | DIFERENCIAL | `project.packs: string[]`; entradas de `INSTALLATION_LIBRARY` com `pack: 'odonto'` |
| 3.3 | Outros packs (restaurante, clínica geral) no mesmo molde | DIFERENCIAL | Só dados de biblioteca, zero código novo de motor |
| 3.4 | Plugin de laser Bluetooth (reavaliar) | — | Alimenta cota automática existente |
| 3.5 | Undo/redo baseado em diffs (se snapshots do canvas inteiro pesarem) | — | Otimização interna |

---

## 3. Impacto no backend (`data.js`) — ordem de execução

Todas as mudanças são aditivas até a Fase 3. Nenhuma quebra schema existente.

### Fase 1

**1.0 — Reforçar `normalizeProject()` (pré-requisito de tudo)**

A função atual preenche arrays ausentes mas não normaliza campos individuais das entidades. Adicionar:

```
normalizeWall(w):         garante { id, x1, y1, x2, y2, thickness: 150 }
normalizeOpening(o):      garante { ..., height: null, sill: null, hingeSide: 'right', openDir: 'in', side: 'right' }
normalizeInstallation(i): garante { ..., sequenceNumber: 1, height: null, observation: '' }
normalizePhotoPin(p):     garante { ..., annotations: [] }
normalizeNote(n):         garante { ..., environmentId: null }  // para rótulos dinâmicos fase 2
normalizeDimension(d):    garante { ..., offset: 400, value: null }
normalizeEnvironment(e):  garante { ..., peDireito: null, perimeter: null, observation: '' }
```

`Storage.get()` e `Storage.getList()` já chamam `normalizeProject()`. Migração é lazy: normaliza ao abrir, persiste ao salvar.

**1.5 — `canvas.defaultPeDireito`**

Novo campo em `defaultCanvas()`:
```
defaultPeDireito: null   // number (metros) | null = não definido
```

`normalizeProject()` preenche com `null` se ausente.

Regra de leitura em qualquer lugar que renderize pé-direito:
```
const pd = env.peDireito ?? canvas.defaultPeDireito ?? null;
```

### Fase 2

**2.1 — `INSTALLATION_LIBRARY` (constante, fora do projeto)**

Não muda o JSON salvo. É uma tabela em `data.js`:

```
const INSTALLATION_LIBRARY = [
  // Elétrica genérica
  { id: 'tomada_2pt',    label: 'Tomada 2P+T',       category: 'eletrica',   defaultHeight: 30,  pack: null },
  { id: 'interruptor',   label: 'Interruptor',        category: 'eletrica',   defaultHeight: 120, pack: null },
  { id: 'luzTeto',       label: 'Luz de teto',        category: 'eletrica',   defaultHeight: null, pack: null },
  { id: 'luzParede',     label: 'Arandela/parede',    category: 'eletrica',   defaultHeight: 200, pack: null },
  { id: 'dados',         label: 'Ponto de dados',     category: 'eletrica',   defaultHeight: 30,  pack: null },
  { id: 'splitInterno',  label: 'Split interno',      category: 'eletrica',   defaultHeight: 200, pack: null },
  // Hidráulica genérica
  { id: 'aguaFria',      label: 'Água fria',          category: 'hidraulica', defaultHeight: 60,  pack: null },
  { id: 'aguaQuente',    label: 'Água quente',        category: 'hidraulica', defaultHeight: 60,  pack: null },
  { id: 'ralo',          label: 'Ralo',               category: 'hidraulica', defaultHeight: 0,   pack: null },
  { id: 'esgoto',        label: 'Saída esgoto',       category: 'hidraulica', defaultHeight: 10,  pack: null },
  { id: 'gas',           label: 'Ponto de gás',       category: 'hidraulica', defaultHeight: 45,  pack: null },
  // Pacote odonto (Fase 3)
  { id: 'arComprimido',  label: 'Ar comprimido',      category: 'odonto',     defaultHeight: 90,  pack: 'odonto' },
  { id: 'sugador',       label: 'Ponto de sugador',   category: 'odonto',     defaultHeight: 90,  pack: 'odonto' },
  { id: 'dreno',         label: 'Dreno do cuspe',     category: 'odonto',     defaultHeight: 10,  pack: 'odonto' },
  { id: 'gasOdonto',     label: 'Rede de gases',      category: 'odonto',     defaultHeight: 90,  pack: 'odonto' },
  { id: 'rxOdonto',      label: 'Ponto de RX',        category: 'odonto',     defaultHeight: null, pack: 'odonto' },
];
```

`installations[].height` continua no JSON. Ao criar, pré-preenche com `defaultHeight`. Usuário pode alterar.
Ao renderizar, se `height == null`, não exibe altura.

**2.4 — Rótulos dinâmicos em notas**

`notes.text` passa a suportar tokens resolvidos em runtime:
- `<area>`: área do ambiente vinculado (se `environmentId` estiver presente)
- `<perimetro>`: perímetro do ambiente
- `<pe_direito>`: pé-direito do ambiente ou default do canvas

Campo `notes.environmentId: string | null` — adicionado pelo `normalizeNote()` com valor `null`.

**2.5 — `canvas.elevations`**

Novo array em `defaultCanvas()`:
```
elevations: []   // [{ id, wallId, name }]
```

Elevação é **derivada** de dados existentes — não duplica geometria:
- Paredes: `walls.find(w => w.id === ev.wallId)`
- Aberturas: `openings.filter(o => o.wallId === ev.wallId)` — usa `.position`, `.width`, `.height`, `.sill`
- Instalações: `installations` dentro do bounding box da parede — usa `.height`
- Pé-direito: `environments.peDireito` do ambiente que contém a parede, ou `canvas.defaultPeDireito`

`normalizeProject()` preenche `elevations: []` quando ausente.

### Fase 3

**3.1 — `project.floors[]` (refatoração estrutural — fazer por último)**

Detectar na `normalizeProject()`:
- Projeto `v1` (tem `project.canvas`, não tem `project.floors`): migrar para
  `floors: [{ id: generateId(), name: 'Térreo', level: 0, canvas: project.canvas }]`,
  `activeFloorId = floors[0].id`.
- Projeto já com `floors`: normalizar cada `floors[i].canvas`.

```
project.floors: [
  { id, name, level, canvas }
]
project.activeFloorId: string
```

O `canvas-editor.js` troca `this.project.canvas` por `this.activeFloor.canvas`.
É uma troca de referência, não de lógica.

**3.2 — `project.packs: string[]`**

`normalizeProject()` preenche `project.packs = []` quando ausente.
Sem packs: UI mostra só categorias `null` da `INSTALLATION_LIBRARY` (genérico).
Com `['odonto']`: exibe também os tipos `pack: 'odonto'`.

---

## 4. Princípios de design (firmes)

Cada regra vem de uma falha real documentada de concorrente.

1. **Nunca exigir login, conta ou nuvem.**
   *(Falha nº1 de OrthoGraph: 2,1/5 App Store. MagicPlan: usuários perdem projetos ao mudar assinatura.)*

2. **Pan nunca pode ser o mesmo gesto que seleção.**
   2 dedos = zoom+pan SEMPRE. 1 dedo = ferramenta ativa.
   O Elle já acerta isso — nunca regredir.
   *(Falha de MagicPlan: paredes movidas por engano é reclamação nº1 em campo.)*

3. **Nenhuma ação crítica em mais de 1–2 toques.**
   Altura de instalação direta no formulário de inserção, não em tela separada.
   *(Falha de MagicPlan: Elevation View exige 6+ toques por ponto elétrico.)*

4. **Undo e Redo sempre visíveis, 1 toque cada, escopo claro.**
   *(Falha de OrthoGraph: undo opaco. Falha de RoomScan: sem undo documentado.)*

5. **Hit-test de parede ≥ ±12px da linha visível.**
   Selecionar parede fina não pode ser exercício de precisão cirúrgica.
   *(Falha universal dos 4 concorrentes — ponto de dor nº1 de usabilidade.)*

6. **Todo gesto gera feedback visual imediato.**
   Toast, highlight, comprimento aparecendo, cota surgindo. Nada acontece em silêncio.
   *(Lição de RoomScan: usuários não sabem se o scan registrou.)*

7. **Botões ≥ 44pt, alvo ideal 56pt. Operável com uma mão, em pé.**
   Ações críticas (iniciar parede, confirmar medida, inserir abertura) em polegar único.
   *(Diagnóstico universal: nenhum dos 4 é usável com 1 mão em campo.)*

8. **Editor pós-criação é cidadão de primeira classe.**
   Mover, editar, deletar qualquer elemento deve ser tão fácil quanto criá-lo.
   *(Falha de RoomScan: editor pós-scan "terrible", sem undo.)*

9. **DXF é entregável de verdade.**
   Cotas saem como entidades DIMENSION, não texto solto.
   *(Falha documentada e admitida pela própria MagicPlan.)*

10. **Especialidade nunca polui o núcleo.**
    Sem o pack `['odonto']`, a UI é 100% genérica. Nichos são dados de biblioteca,
    não bifurcações de código ou condicionais espalhados.

---

## 5. Ordem de execução recomendada

```
FASE 1 (base sólida)
  └── 1.0  normalizeProject() reforçado + comentários de schema atualizados
  └── 1.1  Redo ao lado do undo
  └── 1.2  Hit-test ±12px
  └── 1.3  Comprimento ao vivo no arraste
  └── 1.4  DXF com cotas DIMENSION reais
  └── 1.5  canvas.defaultPeDireito

FASE 2 (diferenciais)
  └── 2.1  INSTALLATION_LIBRARY PT-BR
  └── 2.2  Corte automático da parede no vão
  └── 2.3  Cota automática ao medir parede
  └── 2.4  Rótulos dinâmicos + notes.environmentId
  └── 2.5  canvas.elevations + vista de elevação 2D

FASE 3 (avançado — último)
  └── 3.1  project.floors[] (estrutural — isolar, testar, fazer por último)
  └── 3.2  project.packs + biblioteca odonto
  └── 3.3  Outros packs
  └── 3.4  Plugin laser BT (se demanda real)
  └── 3.5  Otimização undo/redo por diffs
```

**Regra de ouro para qualquer item:** quando houver dúvida entre duas tarefas,
fazer primeiro a que não muda schema ou que usa dados já existentes. Custo menor,
resultado imediato, sem risco de retrocompatibilidade.
