# Análise Estratégica dos Concorrentes — Elle Levantamento

> Análise realizada em maio/2026. Baseada em `docs/pesquisa-concorrentes.md` e na
> leitura direta do código: `js/data.js` e `js/canvas-editor.js`.
>
> **Contexto do Elle confirmado pelo código:**
> - 100% offline, dados em `localStorage` (`STORAGE_KEY = 'elle_levantamento_v1'`)
> - Coordenadas internas em milímetros
> - Editor canvas 2D com ferramentas: parede guiada, cota, porta/janela, instalação, foto, nota, ambiente
> - Imagem de fundo para rastrear (`backgroundImage`) com calibração de escala
> - Sem LiDAR, sem login, sem nuvem
>
> **Estrutura de dados atual (`defaultCanvas()`):**
> ```
> walls:        { id, x1, y1, x2, y2, thickness }
> openings:     { id, type, wallId, position, width, height, sill, hingeSide, openDir }
> installations:{ id, type, x, y, height, observation, sequenceNumber }
> photoPins:    { id, x, y, photoData, sequenceNumber }
> notes:        { id, x, y, text }
> dimensions:   { id, x1, y1, x2, y2, value, offset }
> environments: { id, name, polygon, centroid, area, peDireito, observation }
> backgroundImage: { data, x, y, scale, opacity }
> ```

---

## OrthoGraph

### O QUE É BOM / VÁLIDO

A integração com laser Bluetooth (Leica Disto) jogando a medida **direto no elemento do plano** é o acerto central: elimina a digitação manual, que é onde o erro humano e a lentidão entram no campo. Funciona porque separa dois problemas de naturezas distintas — "desenhar a topologia" (rápido, à mão) e "atribuir a medida exata" (preciso, via instrumento) — com dois gestos separados. O corolário disso: quando a medida chega via laser, a cota correspondente aparece automaticamente, sem passo extra. É feedback imediato no ciclo mais crítico do levantamento.

### O QUE É RUIM

2,1/5 na App Store, trava no loading após login, "parece software de PC mal adaptado para mobile", Help que abre e-mail no campo. A **causa raiz é de interface/produto, não de estrutura de dados**: login obrigatório antes de testar qualquer coisa é um portão que expulsa o usuário antes da primeira linha desenhada. A confusão sobre escopo de undo/redo e a dificuldade em desselecionar itens são sintomas de estado interno mal comunicado visualmente — erros de UI que independem do modelo de dados. O pé-direito definido por parede individual (não por cômodo) fragmenta o que deveria ser uma decisão de espaço em decisões de elemento — complexidade desnecessária.

### O QUE DÁ PRA APROVEITAR NO ELLE

A **ideia "instrumento alimenta o valor, não o dedo"** é aproveitável mesmo sem laser físico. O Elle já tem `dimensions.value` e `walls` com geometria — falta um fluxo de entrada de medida rápida: selecionar uma parede e digitar o comprimento real, fazendo o app reposicionar/escalar o segmento para bater com esse valor. Isso entraria no `canvas-editor.js` (fluxo de edição de parede) sem mudança no `data.js`. Se futuramente houver suporte a laser Bluetooth, o mesmo canal de entrada recebe o valor via Web Bluetooth — a arquitetura já estaria pronta.

Outra ideia válida é a **medição de diagonal de verificação** ("Free Measure"): medir entre dois cantos não adjacentes para confirmar que a planta está quadrada. Isso também não exige mudança de schema — é uma ferramenta de cota temporária que o usuário usa para checar, não persiste.

### O QUE NÃO APROVEITAR

Login obrigatório (viola o "sem assinatura, sem nuvem" do Elle). A biblioteca de 1.300+ objetos genéricos internacionais (caldeiras, tanques industriais, mobiliário europeu) — irrelevante para consultório odontológico brasileiro e geraria bloat desnecessário. A dependência de exportar IFC para Revit/ArchiCAD apenas para gerar uma elevação — o Elle é o app de campo terminal, não um front-end de BIM pesado.

---

## MagicPlan

### O QUE É BOM / VÁLIDO

Duas decisões funcionam de verdade no campo:

**1. Aberturas que cortam a parede automaticamente ao serem inseridas.** O usuário não precisa "abrir o vão" manualmente — colocar a porta/janela já interrompe o traço da parede. Isso funciona porque respeita o modelo mental do arquiteto: a abertura *é* uma interrupção da parede, não um objeto sobreposto.

**2. Pé-direito em dois níveis — default por andar + override por ambiente.** Com regra clara: se o ambiente foi configurado individualmente antes, o global não sobrescreve. Isso funciona porque reflete a realidade de qualquer edifício: a maioria dos cômodos compartilha um pé-direito, mas sempre há exceções (recepção com sanca, sala de raio-X rebaixada, banheiro com forro de gesso).

### O QUE É RUIM

A falha crítica é documentada pela própria empresa: **"DXF — dimensions will not be included"**. Exportar planta sem cotas é entregar metade do trabalho ao cliente. A causa raiz é **de pipeline de exportação**: as cotas existem no modelo interno do app, mas não são serializadas como entidades DXF (LINE + DIMENSION). Decisão de produto que cria a lacuna mais gritante do mercado.

Soma-se o erro sistemático de 10–15 cm do LiDAR em ambientes mobiliados (causa raiz: limitação física do sensor, não do app), a perda de projetos por mudança de assinatura (problema de modelo de negócio/nuvem), e a impossibilidade de editar no navegador Mac/PC (decisão de produto que força o arquiteto a carregar o tablet para qualquer ajuste pós-visita).

### O QUE DÁ PRA APROVEITAR NO ELLE

**1. Corte automático de parede no vão da abertura.** O Elle já armazena `openings` com `wallId`, `position` e `width` — a relação abertura↔parede existe nos dados. Falta a renderização que interrompe o traço da parede no vão ao desenhar (lógica em `canvas-editor.js`, na função `_drawWalls`/`_drawOpenings`). Sem nenhuma mudança de `data.js`.

**2. Pé-direito default de projeto + override por ambiente.** O Elle tem `peDireito` por ambiente em `environments`, mas não tem um default global. Adicionar esse default muda o `data.js` (um campo novo) e o `normalizeProject` (retrocompatibilidade), mas o `canvas-editor.js` e os formulários de ambiente ganham a lógica de fallback.

**3. DXF COM cotas — aprender pelo erro deles.** Como o Elle já guarda `dimensions` com `value`, `x1..y2` e `offset`, o exportador DXF (`dxf-writer.js`) deve emitir essas cotas como entidades reais. Isso é diferencial direto e imediato contra o concorrente líder do nicho.

### O QUE NÃO APROVEITAR

Todo o stack de captura por câmera/LiDAR (Corner Mode, Auto-Scan, RoomPlan): depende de iOS recente e hardware caro, contradiz "tablet comum", e carrega justamente os erros de 10–15 cm e a confusão "canto de armário vs. canto de parede". O Elle aposta em traçar sobre imagem de fundo calibrada (`backgroundImage` + Calibrar) — mais barato, mais controlável, funciona em qualquer tablet Android comum.

---

## RoomScan Pro LiDAR

### O QUE É BOM / VÁLIDO

A captura "parede por parede em tempo real com cota a cada captura" revela o valor do **feedback incremental imediato**: o usuário vê a planta se formando e confia no progresso a cada gesto. Funciona porque elimina a ansiedade do scan "caixa-preta" — onde nada aparece até o resultado final. O claim de 7 cômodos em 8 minutos é consequência direta dessa arquitetura de feedback.

### O QUE É RUIM

Tudo trava na dependência de hardware específico (iPhone 12 Pro+ / iPad Pro 2020+). Paredes de vidro não são lidas, movimento de pessoas invalida o scan, geometrias não-convencionais (curvas, inclinadas, pedra bruta) não são suportadas. A causa raiz é **estrutural/física**: o LiDAR é um sensor com limites ópticos, e o app herda todos eles sem mitigação suficiente. A ausência total de biblioteca de instalações técnicas é uma lacuna de escopo — o app foi desenhado para o mercado de seguros americano, não para levantamento técnico de obras.

### O QUE DÁ PRA APROVEITAR NO ELLE

A ideia do feedback incremental. O Elle já tem o mecanismo de parede guiada em cadeia em `canvas-editor.js` — a planta cresce segmento a segmento. O que falta é exibir o **comprimento ao vivo do segmento atual durante a mira** (antes do usuário confirmar o ponto final) e cotar automaticamente cada parede ao ser fechada. Isso reforça confiança exatamente no momento em que o usuário está com a trena na mão. Nenhuma mudança no `data.js` — é lógica de renderização do preview.

### O QUE NÃO APROVEITAR

O LiDAR e todo o ecossistema de point cloud (PLY/OBJ/XYZ, USDZ, RoomPlan): incompatível com tablet Android comum e offline barato. Os formatos de seguro americano (Xactimate/Symbility) estão fora do contexto de consultório odontológico brasileiro. O "fechamento automático por perímetro" só faz sentido com sensor contínuo; no Elle o fechamento é guiado por snap e confirmação do usuário, o que é adequado ao fluxo de quem tem trena na outra mão.

---

## Floor Plan Creator

### O QUE É BOM / VÁLIDO

É o concorrente mais alinhado à filosofia do Elle: **desenho manual com snap, sem dependência de sensor**, suporte a laser Bluetooth de diversas marcas, e **rótulos com variáveis calculadas** (`<area>`, `<perimeter>`, `<width>`, `<height>`) que se preenchem sozinhos. Os rótulos calculados funcionam porque ligam o texto à geometria — se a forma muda, o número acompanha automaticamente. É o único concorrente que deixa o dado do ambiente "falar por si" na planta sem retrabalho.

### O QUE É RUIM

Cotas **100% manuais** — confirmado pela FAQ oficial. A causa raiz é **decisão de produto**: o app trata cota como anotação opcional, não como subproduto automático da medição. Isso força o usuário a fazer o trabalho duas vezes: medir + colar a linha de cota. Outro problema: "objetos distantes causam área de export enorme" — sintoma de não haver bounding/limpeza automática da geometria antes de exportar, erro simples de pipeline que cria frustração desnecessária.

### O QUE DÁ PRA APROVEITAR NO ELLE

**1. Rótulos com variáveis calculadas.** O Elle tem `notes: { id, x, y, text }` e já calcula `area`/`centroid` via `polygonArea`/`polygonCentroid` em `data.js`. Suportar tokens como `<area>` e `<perimetro>` numa nota ligada a um ambiente — resolvidos na renderização — exige apenas amarrar a nota a um `environmentId` (pequena mudança no `data.js`, ver seção 3) e adicionar o parser de tokens na renderização de notas.

**2. Limpeza de geometria antes do export.** Antes de gerar o DXF, calcular bounding box de todos os elementos e verificar se há outliers distantes. Isso é lógica de exportação no `dxf-writer.js`, sem mudança de dados, mas evita o problema que irrita usuários do Floor Plan Creator.

**3. Snap validado.** O Elle já tem `snapEnabled` — o mais próximo concorrente de filosofia usa o mesmo mecanismo. Isso confirma que o caminho é certo.

### O QUE NÃO APROVEITAR

O modelo de monetização fragmentado (DXF avulso, marca d'água, 1 projeto grátis): o Elle é offline sem assinatura e isso é diferencial central. A ausência de hidráulica e de campo de altura de instalação é a lacuna que o Elle deve dominar, não replicar.

---

## 1. SHORTLIST PRIORIZADA (impacto × esforço)

| # | Ideia | Origem | Por que vale | Impacto | Esforço |
|---|-------|--------|--------------|---------|---------|
| 1 | **DXF com cotas reais** | MagicPlan (pelo erro deles) | Falha #1 do líder; Elle já tem `dimensions.value` nos dados | **Altíssimo** — planta entregável de verdade | Médio — só no `dxf-writer.js` |
| 2 | **Corte automático da parede no vão da abertura** | MagicPlan | `openings.wallId/position/width` já existe; só falta a renderização | **Alto** — planta legível, profissional | **Baixo** — só `_drawWalls`/`_drawOpenings` |
| 3 | **Comprimento ao vivo + cota automática por parede** | RoomScan / OrthoGraph | `_chainPts`/`_aiming` já existem; feedback imediato durante a medição | **Alto** — velocidade e confiança no campo | **Baixo–Médio** — renderização do preview |
| 4 | **Pé-direito default de projeto + override por ambiente** | MagicPlan | Evita redigitar 2,40 m em toda sala da clínica | **Médio–Alto** — conveniência real | **Baixo** — 1 campo novo + fallback |
| 5 | **Entrada rápida de medida (toca parede → digita → parede ajusta)** | OrthoGraph | Separa topologia de medida exata; precisão sem risco de erro de digitação | **Médio** | **Médio** |
| 6 | **Rótulos com variáveis calculadas (`<area>`, `<perimetro>`)** | Floor Plan Creator | `polygonArea`/`centroid` já calculados; notas que não dão retrabalho | **Médio** | **Médio** — exige `notes.environmentId` |
| 7 | **Limpeza de bounding antes do export DXF** | Floor Plan Creator (preventivo) | Evita DXF gigante por elementos órfãos distantes | **Baixo–Médio** — robustez silenciosa | **Baixo** |

**Ordem de ataque recomendada:** 1 → 2 → 3 → 4 (alto impacto, dados já existem, menor risco), depois 5, 6, 7.

---

## 2. TERRENO EXCLUSIVO DO ELLE

O que **nenhum dos 4 faz bem** e o Elle pode dominar:

### A. Biblioteca elétrica e hidráulica brasileira com altura por ponto

RoomScan não tem nada. Floor Plan Creator tem elétrica vaga e hidráulica ausente. OrthoGraph e MagicPlan têm bibliotecas genéricas internacionais — caldeiras europeias, canos americanos, símbolos ANSI. O Elle já tem `installations` com `height`, `type` e `sequenceNumber` — base perfeita para um catálogo PT-BR específico de consultório odontológico:

- **Elétrica:** tomada 2P+T padrão brasileiro (NBR 14136), interruptor simples/paralelo, ponto de dados, ponto de rede, quadro de distribuição, split (indoor)
- **Hidráulica:** ponto de água fria, ponto de água quente, ralo seco, caixa de inspeção, saída de esgoto, pia de consultório
- **Odontológico específico:** ponto de ar comprimido (cadeira), ponto de sugador, ponto de amalgamador, tomada para equipo

Cada tipo com **altura sugerida padrão** (ex.: tomada a 30 cm, interruptor a 1,05 m, ponto de ar a 0,90 m). Esse catálogo não existe em nenhum app do mercado. É território livre.

### B. Vista de elevação cotada de verdade

Os quatro falham:
- OrthoGraph e RoomScan: só 3D, elevação técnica requer exportar IFC para ArchiCAD/Revit
- Floor Plan Creator: sem elevação alguma
- MagicPlan: tem "Elevation View" mas **admite na própria documentação que não é técnica** — é ferramenta de posicionamento

O Elle armazena `installations.height`, `openings.height`/`sill`, `environments.peDireito`. Tem todos os dados para gerar uma **vista de elevação 2D ortogonal por parede**, com:
- Cotas reais de altura de cada ponto elétrico/hidráulico
- Posição das janelas (peitoril e altura)
- Posição das portas (altura do vão)
- Pé-direito do ambiente

Essa é exatamente a informação que o instalador e o projetista de interiores precisam e não conseguem extrair de nenhum app de campo hoje.

### C. Alinhamento entre pavimentos assistido

Todos os quatro dizem explicitamente "sem alinhamento automático entre andares". Numa clínica de dois pavimentos, alinhar prumadas hidráulicas, shafts e pilares entre andares é decisão crítica de projeto. O Elle pode oferecer pavimentos que compartilham uma origem de referência e permitem visualizar o andar inferior como camada fantasma (similar ao `backgroundImage` já existente, mas usando o próprio canvas do pavimento de baixo como guia). Nenhum concorrente entrega isso no campo.

### D. Numeração sequencial de pontos para legenda automática

O Elle já tem `sequenceNumber` em `installations` e `photoPins`. Com pouco esforço adicional, isso vira uma **legenda numerada automática** no DXF e no PDF — "T1, T2, T3 = Tomada 2P+T; AF1, AF2 = Água Fria; etc." — que nenhum app de campo gera hoje. Para o relatório de levantamento entregue ao cliente, isso poupa horas de trabalho no escritório.

---

## 3. IMPACTO NO CÓDIGO ATUAL — mudanças necessárias no `data.js`

Apenas descrição. Nenhum código escrito aqui.

### 3.1 Pé-direito default de projeto (suporta item 4 da shortlist)

**Situação atual:** `peDireito` só existe em `environments[].peDireito`. Sem default global.

**Mudança necessária:** Adicionar um campo de pé-direito padrão no nível do `canvas` (ex.: `defaultPeDireito`). O `normalizeProject` deve preencher esse campo em projetos antigos com um valor razoável (ex.: 2400 mm = 2,40 m). A lógica de leitura: ambiente usa `environments[].peDireito` se definido e > 0; senão herda `canvas.defaultPeDireito`. Isso replica o comportamento do MagicPlan sem quebrar retrocompatibilidade.

### 3.2 Nota vinculada a ambiente, para variáveis calculadas (suporta item 6)

**Situação atual:** `notes: { id, x, y, text }` — sem vínculo a nenhum outro elemento.

**Mudança necessária:** Adicionar campo opcional `environmentId` na nota. Quando presente, o renderer substitui tokens `<area>`, `<perimetro>` pelos valores do ambiente referenciado. O `normalizeProject` deve tolerar notas antigas sem o campo (campo ausente = nota avulsa, comportamento atual). Nenhuma migração destrutiva.

### 3.3 Perímetro do ambiente (suporta item 6 e terreno exclusivo B)

**Situação atual:** `environments` persiste `polygon`, `centroid`, `area`, mas **não** `perimeter`.

**Mudança necessária:** Calcular e persistir `perimeter` no fechamento do ambiente. A função `dist` já existe em `data.js`; o cálculo é trivial (soma dos `dist` entre pontos consecutivos do polígono). Persistir o valor evita recalcular em cada render e permite usá-lo em rótulos e no DXF/PDF de forma consistente com `area`.

### 3.4 Tabela de tipos de instalação PT-BR com altura sugerida (suporta terreno exclusivo A)

**Situação atual:** `installations[].type` é uma string livre, sem tabela centralizada. Os tipos atuais (ex.: `tomada110`, `tomada220`, `interruptor`) são constantes dispersas no `canvas-editor.js`.

**Mudança necessária:** Centralizar os tipos em uma **tabela de configuração** (constante em `data.js`) com campos: `id` (chave), `label` (PT-BR), `category` (elétrica/hidráulica/odontológico), `defaultHeight` (mm), `dxfSymbol` (nome do bloco ou símbolo para DXF). Ao criar uma instalação, o `defaultHeight` pré-preenche `installations[].height`. O shape do registro `installations` não muda — só o processo de criação fica mais inteligente.

### 3.5 Multi-pavimento / floors (suporta terreno exclusivo C)

**Situação atual:** Projeto tem **um único `canvas`** — toda a geometria vive nele.

**Mudança necessária:** Esta é a única mudança estrutural profunda. Exige passar de `project.canvas` para `project.floors[]`, onde cada floor tem `{ id, name, level, defaultPeDireito, canvas }`. O `normalizeProject` migra o `canvas` único existente para `floors[0]` (nomeado "Térreo", `level = 0`), define `activeFloorId = floors[0].id`, e remove `project.canvas`. O `canvas-editor.js` troca `this.project.canvas` por uma referência ao canvas do floor ativo — troca de referência, não de lógica.

**Esta é a única mudança que deve ser planejada e implementada isoladamente, por último, após todos os outros itens.** Altera a raiz do modelo e requer testes completos de retrocompatibilidade de projetos salvos em localStorage.

### Resumo do esforço de schema

| Mudança | Tipo | Quando fazer |
|---------|------|--------------|
| `canvas.defaultPeDireito` | Aditiva, barata | Junto com item 4 da shortlist |
| `notes[].environmentId` | Aditiva, barata | Junto com item 6 |
| `environments[].perimeter` | Aditiva, barata | Junto com item 6 |
| Tabela de tipos PT-BR | Configuração (sem schema) | Junto com terreno exclusivo A |
| `project.floors[]` | Refatoração estrutural | Por último, isolada |

Itens 1–3 da shortlist (DXF com cotas, corte de parede, comprimento ao vivo) **não exigem nenhuma mudança em `data.js`** — são trabalho de `dxf-writer.js` e `canvas-editor.js` sobre dados que já existem.
