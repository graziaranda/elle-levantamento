# Diagnóstico de UX — Perspectiva do Usuário Real

> Auditoria feita em maio/2026 lendo o código atual (`canvas-editor.js`,
> `dxf-writer.js`, `pdf-report.js`, `app.js`, `app.css`) e simulando o
> fluxo completo: criar projeto → desenhar ambiente → ajustar medida →
> inserir porta/janela → marcar instalações → definir pé-direito →
> tentar 2º pavimento → exportar DXF e PDF.
>
> **Persona:** arquiteta em campo, tablet, sol na tela, uma mão, sem manual.
> Reclamações ordenadas do mais grave para o menos grave.
> Para cada item: momento exato, o que irrita, gravidade, causa, sugestão.

---

## CRÍTICOS — Me fazem parar ou refazer

---

### C-01 · Modal de porta/janela cobre 100% da planta — a prévia ao vivo não serve para nada

**Momento:** Formulário de porta ou janela abre após soltar o dedo na parede.

**O que acontece:** O código tem `_openingPreview` que redesenha em tempo real conforme os campos mudam (`sync()`, canvas-editor.js ~linha 1513). Mas o `modal-backdrop` usa `position: fixed; inset: 0; background: rgba(0,0,0,0.72)` — cobre 100% da tela com fundo escuro. A prévia existe, roda, mas é completamente invisível. A arquiteta preenche os campos no escuro, sem ver onde a porta vai ficar.

**Gravidade:** CRÍTICO

**Causa:** Interface — backdrop centralizado bloqueia a área do canvas.

**Sugestão:** Converter o formulário em painel lateral deslizante (`position: fixed; right: 0; width: 320px; height: 100%`) sem backdrop. Canvas visível à esquerda, formulário à direita.

---

### C-02 · Multi-pavimento não existe — 1 projeto = 1 planta, sem alternativa

**Momento:** Ao tentar iniciar o 2º pavimento de um sobrado ou clínica de 2 andares.

**O que acontece:** Não existe nenhuma referência a "pavimento", "floor", "andar" ou "level" em todo o código. `project.canvas` é único e plano. Para levantar um sobrado a arquiteta cria dois projetos separados, sem vínculo, sem alinhamento, sem saber onde ficam as prumadas.

**Gravidade:** CRÍTICO

**Causa:** Estrutura de dados — `project.canvas` flat; sem `project.floors[]`.

**Sugestão:** `project.floors = [{ id, name, canvas }]` com seletor de aba simples no header. Qualquer projeto existente vira `floors[0]` pelo `normalizeProject`.

---

### C-03 · Não existe redo — desfazer demais obriga a recomeçar do zero

**Momento:** Qualquer momento após usar undo.

**O que acontece:** `_initKeyboard()` mapeia `Ctrl+Z` para undo. A `history` é um array com `historyIdx` (estrutura de undo/redo clássica), o que indica que redo foi planejado mas nunca implementado. Não há botão, não há `Ctrl+Y`, não há `_redo()`. Se a arquiteta desfizer 3 ações por engano, ela refaz as 3 na mão.

**Gravidade:** CRÍTICO

**Causa:** Fluxo — redo está na estrutura de dados (history/historyIdx) mas nunca exposto.

**Sugestão:** Adicionar `_redo()` que incrementa `historyIdx` e restaura `history[historyIdx]`. Botão ao lado do undo no header. Mapeamento `Ctrl+Y`.

---

### C-04 · Porta/janela inserida: impossível reposicionar sem excluir e reinserir

**Momento:** Porta inserida com distância errada — tenta ajustar a posição.

**O que acontece:** `_showProps(o, 'opening')` (sidebar de propriedades) mostra: Largura, Altura, Dobradiça, Sentido de abertura — mas **não tem campo de distância do canto**. Não há drag de abertura no modo Selecionar. Para corrigir o posicionamento, é preciso excluir a porta e fazer o fluxo inteiro de novo.

**Gravidade:** CRÍTICO

**Causa:** `_showProps` para `type === 'opening'` não inclui campo de reposição.

**Sugestão:** Adicionar campo "Distância do canto (cm)" nas propriedades da abertura existente.

---

### C-05 · Altura da instalação não é pedida na hora da inserção — esquecida em campo

**Momento:** Modal de instalação aberto, toca num tipo (ex: Tomada 110V).

**O que acontece:** Ao tocar num botão de tipo, o código grava a instalação imediatamente com `height: null` e fecha o modal. Para definir a altura, a arquiteta precisa: trocar para ferramenta Selecionar → tocar no ponto → achar o painel lateral → digitar a altura. São 5 passos para algo que deveria ser pedido na hora. No campo com pressa, altura de 80% dos pontos fica null.

**Gravidade:** CRÍTICO

**Causa:** `_showInstallModal` não inclui campo de altura; só em `_showProps`.

**Sugestão:** Após a escolha do tipo no modal, mostrar campo "Altura do piso (cm)" com valor sugerido padrão antes de gravar.

---

### C-06 · Threshold de fechamento de ambiente muito pequeno — falha na maioria das tentativas

**Momento:** Arraste da última parede tentando fechar o ambiente.

**O que acontece:** O threshold é `dist * this.zoom < 30` pixels de tela. Com zoom padrão 0,15, equivale a menos de 4–5mm de precisão na tela. Com dedo, a imprecisão de toque é de ~8–10mm. Resultado: a maioria das tentativas de fechar passa por cima sem acionar. A arquiteta tenta 3–4 vezes, acha que o app está quebrado.

**Gravidade:** CRÍTICO

**Causa:** Threshold em pixels de tela muito pequeno (30px a zoom baixo).

**Sugestão:** Aumentar para 50px de tela (independente do zoom). Quando `_aimClosing = true`, mostrar halo verde no primeiro ponto + hint "Solte para fechar".

---

### C-07 · Sem feedback visual de snap travado — a arquiteta nunca sabe se está em 90° exatos

**Momento:** Arraste para definir a direção de uma parede.

**O que acontece:** O snap de ângulo funciona (`_snapWallAngle()` com tolerância de 14° para 0/90 e 7° para 45°) mas não há NENHUM feedback visual de que travou. A linha preview simplesmente fica alinhada — mas visualmente não dá para distinguir 90° travado de 87° livre. Em campo, a arquiteta confia nos ângulos e só descobre o erro quando exporta o DXF.

**Gravidade:** CRÍTICO

**Causa:** `_wallAim()` aplica o snap mas não comunica o estado "travado" visualmente.

**Sugestão:** Quando snap ativo (`_aimAngle !== rawAng`), mudar a cor da linha preview para dourado sólido + exibir badge "90°" ou "45°" ao lado do ponto de destino.

---

### C-08 · Numpad sem tecla decimal — medidas fracionárias em cm são impossíveis

**Momento:** Numpad aberto para digitar o comprimento da parede.

**O que acontece:** O grid do numpad é `[7,8,9,4,5,6,1,2,3,'clear',0,'back']` — não há tecla `.` ou `,`. Medidas como 87,5cm (875mm) ou 62,5cm não podem ser digitadas. A arquiteta tem a trena na mão mostrando 62,5cm e não consegue entrar o valor correto. Ou arredonda (perdendo precisão) ou desiste.

**Gravidade:** CRÍTICO

**Causa:** Grid do numpad definido sem separador decimal.

**Sugestão:** Adicionar tecla `.,` no lugar de `clear` (que já existe como `⌫` longo). Ou mudar a unidade base para mm, onde todo valor é inteiro.

---

### C-09 · DXF exportado: cotas são linhas soltas, não entidade DIMENSION real

**Momento:** DXF aberto no AutoCAD ou SketchUp.

**O que acontece:** `_dimension()` em `dxf-writer.js` gera 1 `LINE` (linha de cota) + 2 `LINE` (extensoras) + 2 `LINE` (ticks) + 1 `TEXT` (valor). São 6 entidades soltas. Não há nenhuma entidade `DIMENSION`. No AutoCAD as cotas não são editáveis, não têm estilo, não se atualizam ao mover geometria. Para uso profissional, o DXF chega "morto".

**Gravidade:** CRÍTICO (uso profissional)

**Causa:** `_dimension` em dxf-writer.js usa `_line` + `_text` em vez de grupo DIMENSION do DXF spec.

**Sugestão:** Implementar entidade `DIMENSION` (tipo 1 = alinhado) com grupos de código 10/11/13/14/15/16 conforme DXF R2010 spec.

---

### C-10 · Dois undos com comportamentos opostos — o da toolbar encerra a cadeia inteira

**Momento:** Durante a cadeia de paredes, precisa desfazer o último ponto.

**O que acontece:** Existem dois botões de desfazer:
- `btn-undo` no header → chama `_undo()` → restaura snapshot completo do canvas e **cancela toda a cadeia de paredes**
- Botão flutuante "↶ Desfazer ponto" → chama `_undoLastWallPoint()` → remove só o último segmento e **continua a cadeia**

O botão do header tem ícone de 13×13px. O flutuante tem texto. Em campo sob estresse, a arquiteta aperta o mais visível (pode ser o header) e perde toda a cadeia sem saber por quê.

**Gravidade:** CRÍTICO

**Causa:** Interface — dois mecanismos de undo com semântica radicalmente diferente, sem distinção clara.

**Sugestão:** Esconder o `btn-undo` do header enquanto `_chainPts.length > 0`. Só o flutuante específico fica ativo durante a cadeia.

---

### C-11 · Planta no PDF rasterizada no zoom atual — sai borrada se o zoom estiver baixo

**Momento:** Botão PDF pressionado.

**O que acontece:** `canvas.toDataURL('image/png')` captura o canvas no estado atual de visualização. Se o zoom for 0,15 (padrão, visão geral), uma parede de 5m ocupa ~75px na tela. A imagem do PDF fica pixelada e ilegível em impressão A4. A arquiteta envia o PDF para o cliente e não dá para ler as cotas.

**Gravidade:** CRÍTICO (para apresentação ao cliente)

**Causa:** `toDataURL` sem `_fitScreen()` prévio e sem canvas offscreen de alta resolução.

**Sugestão:** Antes de capturar, chamar `_fitScreen()` para centralizar a planta, depois capturar canvas offscreen com DPI 2× ou 3×, depois restaurar zoom/pan.

---

### C-12 · Undo off-by-one: a primeira parede desenhada não pode ser desfeita

**Momento:** Usuário desenha a primeira parede e imediatamente tenta desfazer.

**O que acontece:** `historyIdx` começa em -1. `_pushHistory()` ocorre depois de criar a parede e coloca `historyIdx = 0`. `_undo()` tenta `historyIdx - 1 = -1` → `Math.max(0, -1) = 0` → restaura o estado COM a parede. Undo não faz nada. A arquiteta clica em undo, nada muda, ela acha que o app travou.

**Gravidade:** CRÍTICO

**Causa:** Estado inicial não salvo como snapshot; `_pushHistory` registra depois da ação.

**Sugestão:** No `_initCanvas()`, salvar um snapshot inicial vazio: `this.history = [JSON.stringify(this.project.canvas)]; this.historyIdx = 0`.

---

### C-13 · Mover parede não existe — erro de posicionamento obriga a excluir e redesenhar

**Momento:** Parede desenhada com ponto inicial errado (deslocado 30cm).

**O que acontece:** `_clickSelect()` apenas seleciona e abre propriedades (comprimento readonly, espessura editável). Não há drag de parede no modo Select. Os campos `x1, y1, x2, y2` existem no schema mas não são editáveis na UI. Para corrigir, a única opção é undo (se ainda estiver disponível) ou delete + redesenho completo.

**Gravidade:** CRÍTICO

**Causa:** Fluxo — ausência de edição posicional de elementos.

**Sugestão:** No modo Select, permitir arrastar parede selecionada movendo os dois endpoints em conjunto. Alternativa mínima: campos X1, Y1, X2, Y2 editáveis no sidebar.

---

### C-14 · Pé-direito: parseFloat quebra com vírgula decimal (teclado PT-BR)

**Momento:** Modal de fechamento de ambiente — campo pé-direito.

**O que acontece:** `parseFloat(document.getElementById('env-pedireito')?.value)` em `_promptEnvironment()`. Em iPad/Android com locale PT-BR, `type="number"` pode aceitar `2,80` com vírgula. `parseFloat('2,80')` retorna `2` (ignora o resto). O pé-direito é salvo como `2m` em vez de `2,80m`, sem qualquer aviso ao usuário.

**Gravidade:** CRÍTICO

**Causa:** `parseFloat` sem `.replace(',', '.')`, ao contrário do `_numpad()` que já trata isso.

**Sugestão:** Adicionar `.replace(',', '.')` antes do `parseFloat`, igual ao padrão já adotado em outros campos.

---

## IRRITANTES — Me atrasam e me fazem hesitar

---

### I-01 · Modal de instalação: botões elétrica e hidráulica idênticos visualmente

**Momento:** Modal de instalação aberto, 13 botões em grid.

**O que acontece:** As seções "Elétrica" e "Hidráulica / Gás" têm labels corretos. Mas os botões dentro de cada seção têm a mesma aparência em repouso — diferença só no hover (`.electric:hover` dourado, `.hydro:hover` azul). No sol e com pressa, a arquiteta não sabe em que seção está sem ler o texto pequeno (11px). Toca no tipo errado com frequência.

**Causa:** CSS `.install-btn.electric` e `.install-btn.hydro` sem cor de repouso diferenciada.

**Sugestão:** Background sutil em repouso: dourado-dim para elétrica, azul-dim para hidráulica.

---

### I-02 · Botões críticos abaixo de 44px de altura mínima para toque

**Momento:** Qualquer interação com modais e formulários.

**O que acontece:** Medido pelo CSS atual:

| Elemento | Altura estimada | Mínimo seguro |
|---|---|---|
| `.modal-close` (fechar modal) | 30×30px | 44px |
| `.op-flip` (inverter canto) | ~32px | 44px |
| `.install-btn` (escolher tipo) | ~36px | 44px |
| `.op-seg button` (dobradiça/sentido) | ~36px | 44px |

O `.modal-close` de 30×30px é o mais crítico: fechar o modal de porta/janela por engano (ou não conseguir fechar) é uma catástrofe em campo.

**Causa:** CSS sem `min-height: 44px` nesses elementos.

**Sugestão:** `min-height: 44px; min-width: 44px` em todos os elementos interativos de modal.

---

### I-03 · Feedback de âncora da parede é fraco sob sol

**Momento:** Primeiro toque para marcar o ponto de início da parede.

**O que acontece:** `_drawPreview()` exibe um círculo dourado de ~13px em `rgba(201,168,76,1)` sobre fundo `#1A1814`. Sem Toast, sem animação. Com sol batendo na tela (tela média de tablet em ambiente externo tem brilho insuficiente para escuro sobre escuro), o ponto é quase invisível.

**Causa:** Feedback visual insuficiente para condições externas.

**Sugestão:** Toast brevíssimo (800ms) "Início marcado" + fazer o ponto piscar 2× ao aparecer.

---

### I-04 · Hint de instrução longa (65+ chars) não absorvida em campo

**Momento:** Qualquer mudança de ferramenta.

**O que acontece:** O hint para parede diz: `"Toque para marcar o início · arraste na direção e solte para digitar a medida (cm)"` — 82 caracteres. Com sol, lendo em pé, a arquiteta tem ~1 segundo para absorver. O texto muda sem animação de chamada de atenção.

**Causa:** Hints muito longos; `_showHint()` só troca `textContent` sem animação.

**Sugestão:** Máximo 40 caracteres. Versão curta: `"Toque → arraste → solte (cm)"`. Piscar brevemente ao mudar.

---

### I-05 · Sidebar de Propriedades sempre visível (240px) — come 20% do canvas sem precisar

**Momento:** Editor aberto, sem nenhum elemento selecionado.

**O que acontece:** A sidebar de 240px de largura ocupa espaço permanente mostrando apenas "Toque num elemento para ver propriedades." Em tablet de 10", isso é ~20% da largura útil. Em planta pequena não incomoda; em levantamento de apartamento grande, a área útil de desenho fica menor que o necessário.

**Causa:** Interface — sidebar sempre visível em `_renderShell()`.

**Sugestão:** Sidebar colapsada por padrão. Expande automaticamente ao selecionar elemento, colapsa ao tocar fora.

---

### I-06 · Campo de espessura da parede: listener `change` não atualiza em tempo real

**Momento:** Parede selecionada, editando espessura no sidebar.

**O que acontece:** O campo de espessura usa `addEventListener('change', ...)` — só dispara ao tirar foco. O canvas não atualiza enquanto digita. Compare com o formulário de abertura que usa `'input'` para preview em tempo real. Inconsistência que confunde: a arquiteta digita "200", olha para a planta, não vê mudança, digita de novo.

**Causa:** Listener `change` em vez de `input` na propriedade de espessura.

**Sugestão:** Trocar para `'input'` para feedback em tempo real, igual ao padrão dos outros campos.

---

### I-07 · Campo "distância do canto": sem referência visual de qual canto dentro do formulário

**Momento:** Formulário de porta/janela, campo "Distância do canto até o vão".

**O que acontece:** O ponto de referência verde (refX/refY) está na planta — que está oculta pelo modal (ver C-01). Dentro do formulário não há nenhuma representação visual de qual canto é o de referência. A arquiteta digita um número sem saber se está medindo da esquerda ou da direita.

**Causa:** Informação visual (ponto verde) está na planta ocultada pelo modal.

**Sugestão:** Miniatura da parede dentro do formulário mostrando o canto ativo e o vão em escala, junto ao botão ⇄.

---

### I-08 · Unidade de altura de instalação inconsistente nos 3 pontos de exibição

**Momento:** Ao inserir instalação com altura, depois ao ver na planta, depois no DXF.

**O que acontece:**
- Label do campo no sidebar: `"Altura do piso (cm)"` → usuário digita em cm
- Na planta 2D: renderizado como `h${inst.height}` (ex: `h40`) — sem unidade
- No DXF: exportado como `h=${inst.height}cm` (ex: `h=40cm`)

Três formatos diferentes. A arquiteta não sabe se está lendo cm ou mm ao ver `h40` na planta.

**Causa:** 3 pontos de formatação independentes sem padrão compartilhado.

**Sugestão:** Padronizar `h=Xcm` em todos os pontos: planta, sidebar e DXF.

---

### I-09 · Botão "Pular" no modal de ambiente: paredes foram criadas mas o ambiente não

**Momento:** Modal de fechamento de ambiente, usuário toca "Pular".

**O que acontece:** `_promptEnvironment()` ao cancelar faz `Modal.close()` + `_draw()`. As paredes da cadeia já foram adicionadas a `canvas.walls` (em `_addWallSegment()`). O ambiente não é criado. A arquiteta pensa que pulou "só o nome" mas o cômodo sumiu do painel de ambientes — as paredes estão lá como geometria solta, sem vínculo de ambiente.

**Causa:** Fluxo — separação entre "paredes desenhadas" e "ambiente nomeado" não comunicada na UI.

**Sugestão:** Renomear "Pular" para "Salvar sem nome". Criar o ambiente com nome automático "Ambiente 1, 2, 3..." para que o cômodo apareça no painel.

---

### I-10 · Tolerância de snap para abertura calculada em mm (não pixels) — estranha com zoom baixo

**Momento:** Arrastando porta em direção a uma parede.

**O que acontece:** `_openingAim()` usa tolerância `700 / this.zoom`. Com zoom 0,15: tolerância = 4.667mm ≈ 70% da tela inteira. Qualquer ponto da tela vai capturar alguma parede. Com zoom alto (ex: 2,0): tolerância = 350mm = ~0,7mm de tela — impossível de acertar.

**Causa:** Tolerância em coordenadas mundo em vez de pixels de tela.

**Sugestão:** Tolerância fixa de 60px de tela: `bestDist * this.zoom <= 60`.

---

### I-11 · PDF: window.open bloqueado no iOS Safari/Chrome

**Momento:** Botão PDF pressionado no iPad.

**O que acontece:** `PdfReport.generate()` usa `window.open('', '_blank')`. No iOS, `window.open` fora de clique direto e síncrono é bloqueado. Como `_saveNow()` é chamado antes (pode ter operação assíncrona), o contexto de clique é perdido. Resultado: mensagem "Permita pop-ups" aparece. Muitos usuários não sabem como liberar.

**Causa:** `window.open` numa sequência que pode perder o contexto de clique.

**Sugestão:** Gerar HTML como `Blob`, criar URL com `URL.createObjectURL`, disparar via `<a href=... download>` click sintético — sem `window.open`.

---

### I-12 · Arco de porta no DXF não respeita lado da dobradiça nem sentido de abertura

**Momento:** DXF aberto com porta que tem dobradiça esquerda ou abertura para fora.

**O que acontece:** `_arc()` em `dxf-writer.js` calcula a posição da dobradiça como sempre `cx + nx * half` (lado direito geométrico), ignorando `o.side` e `o.openDir`. O arco de varredura no DXF não corresponde ao que foi desenhado na tela.

**Causa:** Geometria de porta duplicada entre canvas-editor.js e dxf-writer.js sem compartilhamento.

**Sugestão:** Extrair lógica de geometria de porta para helper compartilhado entre os dois módulos.

---

### I-13 · Fotos e notas exportadas na mesma layer TEXTO no DXF

**Momento:** DXF aberto — tentativa de ligar/desligar só as notas.

**O que acontece:** Photo pins e notes vão para a mesma layer `TEXTO`. No AutoCAD não é possível controlar visibilidade de notas sem também esconder os textos de ambientes.

**Causa:** Layer genérica para múltiplos tipos de anotação em `dxf-writer.js`.

**Sugestão:** Criar layers `NOTAS` e `FOTOS` separadas. Custo mínimo: 2 linhas no `_tables()` e trocar o parâmetro de layer em 2 lugares.

---

## PEQUENOS — Incomodam mas não param

---

### P-01 · Sem contador de estado da cadeia de paredes

**Momento:** Desenhando a 4ª parede de um cômodo de 6 paredes.

**O que acontece:** O hint é estático: sempre o mesmo texto independente de quantas paredes já foram desenhadas. Se a arquiteta for interrompida por uma ligação, ao voltar não sabe em que ponto estava.

**Sugestão:** Hint dinâmico: `"Parede 3 · arraste a direção"` ou mostrar perímetro acumulado.

---

### P-02 · Valor sugerido no numpad não indica que será substituído pelo primeiro dígito

**Momento:** Numpad abre com valor sugerido em cinza.

**O que acontece:** A primeira tecla apaga o sugerido e começa do zero (comportamento correto no código). Mas não há indicação visual disso — o sugerido parece ser um número para editar, não substituir. A arquiteta toca "2" esperando "2xx" e vê só "2".

**Sugestão:** Exibir o sugerido com seleção total (highlight azul) como indicação visual de "será substituído".

---

## RESUMO EXECUTIVO

| Gravidade | Qtd | Principais |
|---|---|---|
| CRÍTICO | 14 | Modal cobre planta, sem multi-pavimento, sem redo, sem mover porta, altura de instalação não pedida, threshold de fechamento, sem feedback de snap, numpad sem decimal, DXF sem DIMENSION, 2 undos conflitantes, PDF borrado, undo off-by-one, mover parede ausente, parseFloat com vírgula |
| IRRITANTE | 13 | Botões < 44px, feedback de âncora fraco, hints longas, sidebar permanente, change vs input, dist. canto sem referência visual, unidade de altura inconsistente, "Pular" cria paredes órfãs, tolerância de abertura errada, PDF bloqueado no iOS, arco de porta no DXF incorreto, layer TEXTO genérica |
| PEQUENO | 2 | Sem contador de cadeia, valor sugerido no numpad não destacado |

---

### A pergunta real de campo

> "Desenhei a planta inteira. Posso ir embora do local confiante que o que
> tenho aqui está certo?"

**Com o app atual: não.**

- Não sei se as paredes estão em 90° (sem feedback de snap)
- Não sei se o ambiente fechou direito (threshold pequeno + sem confirmação visual)
- Não sei se as alturas das tomadas foram gravadas (precisam de 5 passos extras)
- Se precisar corrigir qualquer posição (parede, porta, instalação), preciso excluir e refazer
- Se desfizer demais, não tem redo — recomeço do zero
- O DXF que exporto tem cotas de mentira (LINE+TEXT, não DIMENSION)
- O PDF pode sair borrado se o zoom estiver baixo

Esses não são bugs de borda — são o fluxo principal de todo levantamento.

---

*Diagnóstico baseado em leitura direta de `canvas-editor.js`, `dxf-writer.js`,
`pdf-report.js`, `app.js` e `app.css` do repositório `elle-levantamento-github`
(commit 3c4f95c, maio/2026).*
