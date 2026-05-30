# Diagnóstico Estratégico — Elle Levantamento

> Diagnóstico realizado em maio/2026. Baseado em leitura direta do código
> (`data.js`, `canvas-editor.js`, `dxf-writer.js`, `pdf-report.js`, `app.js`,
> `app.css`) e em toda a pesquisa acumulada em `docs/`.
> Honestidade brutal — sem elogios gratuitos.

---

## 1. O QUE JÁ É BOM E NÃO PODE QUEBRAR

Seis mecanismos — não features — que funcionam e devem ser preservados em qualquer refatoração.

---

### 1.1 · Sistema de toque: 1 dedo = ação / 2 dedos = zoom+pan

**O que funciona:** `_onTouchStart/Move/End` (canvas-editor.js). Em qualquer ferramenta, 1 dedo executa a ação ativa. 2 dedos interceptam antes e fazem zoom+pan simultâneos via tracking de ponto médio e distância. No modo Selecionar, arraste de 1 dedo >35px vira pan — mas só nele.

**Por que funciona:** `e.touches.length === 2` é verificado antes de qualquer lógica de ferramenta. `e.preventDefault()` em `touchstart` e `touchmove` impede o navegador de roubar o gesto. O threshold de 35px no select evita que micro-tremores de dedo disparem pan acidentalmente.

**O que quebra se sumir:** Todo toque de 2 dedos passaria para as ferramentas de desenho e criaria paredes e instalações acidentais. É o mecanismo mais crítico do app no tablet.

---

### 1.2 · Fluxo de parede guiada: âncora → arraste → snap → numpad

**O que funciona:** `_wallSetAnchor` → `_wallAim` → `_wallCommit` → `_addWallSegment`. O 1º toque marca a origem. O arraste trava em múltiplos de 45° (tolerância ±14° para ortogonais, ±7° para diagonais). Ao soltar, o numpad aparece com o comprimento do arraste como sugestão — mas o 1º dígito digitado substitui a sugestão inteira (`fresh = true`). A âncora avança automaticamente para o fim da parede criada.

**Por que funciona:** O snap cobre o caso dominante (paredes ortogonais) sem bloquear diagonais. O `fresh` evita o erro de "digitei 3 e ficou 2873". O avanço automático de âncora reduz toques por parede de 3 para 1 no fluxo de cadeia.

**O que quebra se sumir:** Sem snap, paredes de 89,7° aparecem como diagonais no DXF. Sem `fresh`, qualquer digitação fica concatenada ao sugerido. Sem avanço de âncora, o número de toques por parede dobra.

---

### 1.3 · Sistema de camadas `_layer()` com isolamento de erros

**O que funciona:** `_draw()` envolve cada grupo de elementos em `_layer(name, fn)` com `try/catch`. Se um dado corrompido quebrar o render de instalações, as paredes, cotas e o restante continuam desenhando. O erro vai para o overlay vermelho (app.js), visível sem DevTools.

**Por que funciona:** Canvas é stateful — uma exceção no meio de `ctx.save()` corromperia o contexto e tornaria a tela completamente preta. O isolamento por camada garante que falha pontual não trava o app inteiro.

**O que quebra se sumir:** Um único `photoPins` com dado malformado travaria toda a tela, impedindo salvar ou sair.

---

### 1.4 · `normalizeProject()` — migração de schema em leitura

**O que funciona:** Toda leitura de localStorage passa por `normalizeProject` (`Storage.get` e `Storage.getList`). A função percorre o `defaultCanvas()` e preenche qualquer campo ausente com o valor padrão. Projetos salvos antes de campos novos existirem abrem sem erro.

**Por que funciona:** Campos adicionados em versões novas do app não existem em projetos antigos. Sem normalização, o primeiro `for..of` em `_drawEnvironments` quebraria qualquer projeto criado antes de `environments` existir.

**O que quebra se sumir:** Toda mudança de schema quebraria projetos existentes em campo. Com dados reais de clientes já salvos no localStorage do tablet, isso seria perda de dados irreversível.

---

### 1.5 · Preview ao vivo de abertura enquanto o formulário está aberto

**O que funciona:** `_openOpeningForm` → `sync()` → `_openingPreview` → `_draw()`. Cada `input` nos campos de largura, distância e altura recalcula `computePosition()`, atualiza `_openingPreview` e redesenha a planta com o vão em translúcido 55%. O botão ⇄ muda o canto de referência e o preview atualiza em tempo real.

**Por que funciona:** A usuária vê a porta se mover enquanto ajusta os campos. Sem isso, ela só saberia se a distância ficou certa depois de confirmar — e corrigir exigiria excluir e reinserir.

**O que quebra se sumir:** Cada inserção de porta viraria trial-and-error: inserir, verificar, excluir, reinserir.

---

### 1.6 · `destroy()` com limpeza completa de listeners e timers

**O que funciona:** `destroy()` remove todos os `addEventListener` globais, desconecta o `ResizeObserver`, cancela o `setInterval` do auto-save e o `setTimeout` pendente, e executa `_saveNow()` final antes de sair.

**Por que funciona:** `CanvasEditor` é um singleton global. Sem cleanup, cada navegação dashboard→projeto criaria um novo `setInterval` sem cancelar o anterior. Após 5 idas e vindas, haveria 5 timers de auto-save em paralelo, cada um gravando no mesmo key do localStorage.

**O que quebra se sumir:** Memory leak progressivo de handlers e timers. Em tablets com 4–6 GB de RAM divididos com o OS, isso leva a crash.

---

## 2. ROUND-TRIP DE EXPORTAÇÃO DXF

### O que sai limpo

**As 7 layers chegam separadas e bem nomeadas.** `_tables()` define PAREDES, ABERTURAS, ELETRICA, HIDRAULICA, COTAS, TEXTO, AMBIENTES. Nomes limpos, sem caracteres problemáticos. AutoCAD e SketchUp abrem sem reclamação. Ligar/desligar paredes sem afetar cotas funciona.

**As paredes chegam como geometria utilizável.** Cada parede gera 4 entidades LINE (duas faces paralelas + dois tampos). A normal é calculada corretamente com vetor perpendicular. No AutoCAD aparece como contorno utilizável para referência ou redesenho.

**As instalações chegam identificáveis.** CIRCLE + TEXT por ponto, com código correto (`T1`, `AF2`, etc.) na layer separada por disciplina. Não são blocos parametrizados, mas são legíveis — um profissional identifica `T1` como Tomada 1.

### O que sai torto

**As cotas chegam como 6 linhas soltas, não como entidade DIMENSION.**

`_dimension()` gera: 1 LINE (linha de cota) + 2 LINEs (extensoras) + 2 LINEs (ticks) + 1 TEXT (valor) = 6 entidades primitivas por cota. No AutoCAD isso não é associativo: se a parede for movida, a cota não atualiza. No SketchUp as 6 linhas chegam como geometria comum, sem semântica de cota. Qualquer ajuste de layout invalida todas as cotas visualmente — elas ficam flutuando.

**O arco de porta no DXF está geometricamente errado.**

O `_arc()` chamado para porta (dxf-writer.js linha ~99) usa `Math.atan2(ny, nx)` sem compensar a inversão Y que todos os outros primitivos aplicam (`(-y).toFixed(1)`). O ângulo de início está calculado no espaço canvas (Y para baixo) mas o ARC do DXF usa espaço Y para cima. O arco aparece no quadrante errado em metade dos casos. Além disso, o `canvas-editor.js` calcula o arco via `_drawSingleOpening()` com lógica própria (variáveis `a0`, `a1`, `diff`) — o DXF usa uma versão antiga separada. O que o usuário vê na tela não é o que vai no arquivo.

**Notas e fotos na mesma layer TEXTO.**

Ambas exportam para `'TEXTO'` (dxf-writer.js linhas ~155–163). No AutoCAD é impossível esconder fotos sem esconder notas, e vice-versa. Em um levantamento com 15 fotos e 8 notas, isso força seleção manual por tipo de entidade.

### Veredicto

| Caso de uso | DXF economiza tempo? |
|---|---|
| Planta simples como referência de locação | **Sim** — 7 layers limpas, paredes corretas, instalações identificáveis |
| Cota de obra no AutoCAD | **Não** — recriar todas as cotas do zero é mais rápido que limpar 6 linhas por cota |
| Porta com dobradiça específica | **Não** — arco no quadrante errado, exige correção individual |
| Entregar DXF direto para outro profissional | **Parcialmente** — sem trabalho extra se ele só precisa da geometria; com trabalho se precisar das cotas |

**O maior problema do DXF atual para uso profissional:** cotas como linhas soltas. Em levantamento, a cota é o dado mais consultado. Receber 6 linhas por cota, sem associatividade, significa que qualquer ajuste de planta no escritório invalida o levantamento inteiro. Para uma arquiteta que usa AutoCAD, isso é o item que mais gera retrabalho e é a diferença entre "o Elle me poupou 2 horas" e "precisei redesenhar tudo de qualquer forma".

---

## 3. ONDE O ELLE NÃO DEVE COMPETIR

### A) Você estaria construindo uma versão pior

**Captura LiDAR e varredura automática de geometria**

RoomScan captura 7 cômodos em 8 minutos com portas detectadas automaticamente. O Elle jamais vai chegar perto disso, e não por falta de esforço — o sensor LiDAR é hardware físico que custa R$ 8.000–15.000 no iPad Pro, tem limites ópticos irremovíveis (paredes de vidro não são lidas, erro de 10–15 cm em ambientes mobiliados), e é inacessível pela Web API em qualquer tablet Android comum. Implementar varredura por câmera comum sem sensor de profundidade produziria resultados tão imprecisos que o MagicPlan removeu o recurso do Android em 2024. O Elle já tem a resposta certa: imagem de fundo calibrada com dois pontos. É mais barato, funciona em qualquer tablet, não tem o problema de "canto de armário interpretado como canto de parede", e dá controle total ao arquiteto.

**Integração com laser Bluetooth (nas fases 1 e 2)**

OrthoGraph e Floor Plan Creator integram com Leica, Bosch, Hilti via Bluetooth. O fluxo é genuinamente superior para quem tem o hardware. O problema: cada marca usa um protocolo proprietário diferente, e manter uma biblioteca de compatibilidade é trabalho sem fim para beneficiar uma minoria de usuários. O numpad atual em cm cobre 90% do valor sem dependência de hardware. Se houver demanda documentada com usuários reais, a integração entra como plugin isolado na Fase 3 sem tocar no núcleo.

**Visualização 3D interativa**

MagicPlan tem 3D fluido. O OrthoGraph prova o risco: o bug de zoom 3D ("vai para o outro lado do planeta") está documentado na App Store porque 3D em app de campo cria problemas que não existiam antes. Em JS puro sem WebGL é computacionalmente inviável para plantas de múltiplos cômodos. Com WebGL (Three.js), a biblioteca pesa ~600 KB gzipped — o triplo do budget de um app. A arquiteta em campo precisa de planta 2D precisa e elevação cotada, não de um modelo 3D bonito sem cotas. A vista de elevação 2D ortogonal (Diferencial B do roadmap) entrega mais informação técnica útil, com dados que já existem, a fração do custo.

**Nuvem, sincronização e colaboração**

MagicPlan levou anos para construir isso e ainda perde projetos quando o usuário muda de plano de assinatura. Para o Elle competir aqui, precisaria de servidor, autenticação, banco de dados, billing e suporte contínuo — uma stack completa independente que contradiz o princípio central: 100% offline, sem assinatura. O que deve ser perfeito é o DXF com cotas reais e o PDF legível em A4. Esses são o produto do Elle. Não uma tela de login.

**Exportação IFC/BIM**

OrthoGraph e MagicPlan exportam IFC para Revit/ArchiCAD. Implementar exportação IFC válida em JS puro é um projeto de semanas — as especificações IFC têm centenas de tipos de entidade e um IFC malformado é pior do que não ter IFC. O público do Elle termina no DXF ou no PDF, não em Revit.

### B) Features de checklist que não valem o esforço

**Paredes curvas.** Aparecem em todo app como símbolo de completude. Na realidade, nenhum dos 4 concorrentes implementa bem. Em levantamento de interiores brasileiros, aparecem em menos de 5% dos projetos. O custo é alto: mudança no schema de `walls`, recálculo de snap, recálculo de interseção de paredes, tratamento especial em todo o DXF. Uma sprint inteira para 5% dos casos.

**Biblioteca de mobiliário genérico.** Floor Plan Creator tem drag-and-drop de mobiliário e é o recurso mais robusto do app (10 milhões de downloads). Mas o Elle é um app de levantamento, não de projeto. A arquiteta em campo registra o que existe — paredes, cotas, instalações técnicas — não simula o que vai existir. Mobiliário no levantamento de campo é ruído, não dado.

**Redo complexo por diffs antes de resolver os 14 críticos.** O redo é necessário e a estrutura já existe (`historyIdx`). O que não deve acontecer é gastar dias reimplementando o histórico como diffs estruturais antes de resolver que a primeira parede não pode ser desfeita (C-12), que existem dois undos com comportamentos opostos (C-10), e que o numpad não tem tecla decimal (C-08).

### C) O que deixar deliberadamente de fora

Pacotes de especialidade (odonto, restaurante) antes do núcleo genérico estar robusto. O núcleo genérico com alturas padrão corretas para tomada, interruptor, água fria e esgoto já resolve 80% do valor para qualquer tipologia. O ODONTO entra como dados de biblioteca — zero código novo de motor — e só faz sentido quando o motor está funcionando sem os 14 críticos.

---

## 4. A FUNDAÇÃO AGUENTA?

### Avaliação item a item do roadmap

| Item do roadmap | Situação atual | O que precisa mudar | Tipo |
|---|---|---|---|
| Multi-pavimento `project.floors[]` | `project.canvas` é único e plano | `normalizeProject` precisa migrar `p.canvas` → `floors[0].canvas`; detectar versão e migrar lazily | **Estrutural** — fazer por último |
| Instalação ancorada à parede | `{ x, y }` absolutos | Adicionar `wallId?` e `wallT?` (0..1); sem wallId = ponto solto (retrocompatível) | **Aditivo** |
| Cota derivada da geometria | `{ x1,y1,x2,y2 }` absolutos | Adicionar `wallId?` opcional; sem wallId = cota manual (atual); com wallId = derivada | **Aditivo** |
| Elevação 2D ortogonal | Não existe | `canvas.elevations: [{ id, wallId, name }]`; dados existem em `openings.height/sill`, `installations.height`, `environments.peDireito` | **Aditivo** — dados já existem |
| Biblioteca de tipos com altura padrão | 13 tipos como constante inline | `INSTALLATION_LIBRARY` com `defaultHeight` por tipo; `installations.height` vira override | **Só UI** — nenhuma mudança de schema |
| Pé-direito default de projeto | Só em `environments.peDireito` (nullable) | Adicionar `canvas.defaultPeDireito` como fallback | **Aditivo** |

### Dois problemas técnicos reais que precisam de atenção antes de empilhar features

**Problema 1: imagens em base64 no localStorage.**

`backgroundImage.data` e `photoPins[].photoData` são imagens inteiras em base64 dentro do JSON do projeto. Uma foto de tablet vira ~4 MB de string. O localStorage tem limite de 5–10 MB por origem. Um projeto com imagem de fundo + 20 fotos de campo ultrapassa o limite facilmente. Para multi-pavimento com imagem de fundo por pavimento, isso explode. O `Storage.save` captura a exceção mas apenas faz `console.warn` — mostra "Salvo" quando o save falhou (ver Pergunta 5). Este é o único ponto onde uma feature futura (multi-pavimento com fundo por andar) vai criar problema concreto antes mesmo de estar implementada.

**Problema 2: `opening.wallId` órfão ao deletar parede.**

Se a parede referenciada por uma abertura for deletada, a abertura some silenciosamente. O DXF já trata com `if (!w) continue` (linha ~81), o canvas idem (linha ~587). A arquiteta deleta uma parede, não percebe que a porta sumiu, exporta e o DXF chega sem a porta. Falta validação de integridade referencial: ao deletar uma parede, perguntar "existem 2 aberturas vinculadas — deseja excluir também?"

### Conclusão

**Dá para evoluir em cima do que existe — refatoração incremental.**

Todos os itens do roadmap de Fase 1 e Fase 2 são aditivos. `normalizeProject()` já é o mecanismo correto para garantir compatibilidade com dados antigos. O padrão de ID por entidade + `wallId` como referência já está estabelecido e funciona.

A única exceção que precisa ser resolvida antes de empilhar features: o armazenamento de imagens em base64 no localStorage. Não quebra hoje, mas vai quebrar no multi-pavimento. A solução é migrar para IndexedDB (que suporta binários sem limite de 5 MB) ou transformar o campo em referência (URL ou ID) antes de avançar para Fase 3.

---

## 5. SOBREVIVÊNCIA DOS DADOS

### Frequência de salvamento

Dois mecanismos independentes:

1. **Debounce por ação:** `_scheduleSave()` — toda ação confirmada (OK no numpad, salvar porta, inserir instalação) agenda `setTimeout` de **2 segundos**. A cada nova ação antes dos 2s, o timer recomeça. Resultado: o save acontece ≤2s após qualquer ação confirmada.

2. **Intervalo fixo:** `_startAutoSave()` — `setInterval` a cada **30 segundos** independentemente de ações.

Na prática: todo trabalho confirmado está salvo em ≤2 segundos.

### Cenário a cenário

| Cenário | Classificação |
|---|---|
| Tablet descarrega com segmento de parede em construção (numpad aberto) | **RISCO** — perde só o segmento atual; tudo antes está salvo |
| App fecha após 30 min de trabalho ativo | **SEGURO** — cada ação foi salva pelo debounce |
| localStorage cheio: save falha silenciosamente | **PERDA GARANTIDA** — bug crítico |
| Histórico de undo (history[]) após fechar e reabrir | **COMPORTAMENTO ESPERADO** — undo não sobrevive ao fechamento (normal em apps de desenho) |
| Primeiro undo não faz nada (historyIdx off-by-one) | **RISCO BAIXO** — confunde, não perde dados |

### O bug que pode custar trabalho de campo: `QuotaExceededError` silenciado

```javascript
// data.js
try {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
} catch (e) {
  console.warn('Storage quota exceeded:', e);  // ← só isso
}
return project;
```

Quando o localStorage enche, a exceção é capturada e descartada. `_saveNow()` chama `Storage.save()` e depois chama `_setSaveState('saved')`. O indicador na tela muda para **"Salvo"** — quando o dado não foi salvo. A arquiteta trabalha 40 minutos, vê "Salvo" na tela o tempo todo, fecha o app, e o levantamento voltou ao estado da última vez que o localStorage tinha espaço.

Com `photoPins[].photoData` em base64 (fotos de tablet = 2–4 MB cada), o limite de 5 MB é atingível em 2–3 fotos. É risco real, não teórico.

**Correção mínima:** verificar o retorno de `Storage.save` e exibir Toast de erro vermelho quando a quota for excedida: *"Espaço insuficiente — exclua fotos antigas antes de continuar"*.

---

## 6. A ÚNICA COISA

**Pedir a altura da instalação no momento da inserção (`_showInstallModal`).**

---

Esta é a mudança de maior alavancagem porque é o único problema crítico onde o dado nunca entra — não é impreciso, não está perdido, não é difícil de corrigir. Ele simplesmente nunca foi capturado.

O que acontece hoje: a usuária toca num tipo de instalação no modal, o código grava `height: null` imediatamente e fecha. Para definir a altura, são 5 passos obrigatórios depois: trocar para ferramenta Selecionar → tocar no ponto → esperar o sidebar → encontrar o campo → digitar. Em campo com pressa e sol na tela, isso raramente acontece. O resultado documentado: **80% dos pontos ficam com altura null**.

Por que isso invalida o produto: o levantamento técnico de instalações sem alturas não tem valor técnico real. Qualquer instalador ou projetista precisa saber se a tomada está a 30 cm ou a 1,05 m do piso. Sem esse dado, o que o Elle entrega é uma planta de símbolos — não um levantamento técnico. E a altura não pode ser recuperada depois da visita: a arquiteta não volta ao local.

Por que essa mudança e não as outras:

- **C-07 (sem feedback de snap):** crítico, mas o dado está correto — a parede foi a 90°, a usuária só não sabia.
- **C-08 (numpad sem decimal):** afeta medidas fracionárias como 62,5 cm — a maioria das medidas de obra é inteira.
- **C-03 (sem redo):** sério, mas o undo existe e cobre a maioria dos casos.
- **C-09 (DXF sem DIMENSION):** afeta quem abre no AutoCAD — uma minoria dos destinatários.

**C-05 é o único crítico onde o problema é irrecuperável depois da visita.**

A correção é cirúrgica: após o toque num tipo de instalação em `_showInstallModal`, em vez de gravar e fechar, mostrar um segundo passo mínimo — um campo único "Altura do piso (cm)" com o valor padrão da `INSTALLATION_LIBRARY` já preenchido (30 para tomada, 120 para interruptor, 60 para água fria) e um botão "Inserir". O usuário confirma ou ajusta em 1 toque. A mudança toca apenas `_showInstallModal` — não muda `data.js`, não muda `dxf-writer.js`, não muda `pdf-report.js`.

E ela destrava outros problemas em cascata: com altura registrada de forma confiável, o Diferencial B (vista de elevação 2D cotada) passa a ter os dados que precisa. A inconsistência de unidade (I-08 do diagnóstico UX) pode ser padronizada neste mesmo momento. A biblioteca PT-BR com alturas padrão (Fase 2.1 do roadmap) faz sentido de existir porque o campo de altura vai ser preenchido.

Sem isso, o DXF pode ter cotas reais, o PDF pode sair nítido, o redo pode funcionar perfeitamente — e o produto principal ainda estará entregando levantamentos técnicos sem a informação mais valiosa que ele poderia capturar.

---

*Diagnóstico baseado em leitura direta do código (commit 7c5ce63, maio/2026)
e nos documentos `analise-concorrentes-elle.md`, `usabilidade-concorrentes.md`,
`roadmap-levantamento-elle.md` e `diagnostico-ux-usuario-real.md`.*
