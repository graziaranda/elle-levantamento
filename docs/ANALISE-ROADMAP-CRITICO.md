# Análise Crítica do Roadmap — Elle Levantamento
*Análise multi-agente (4 perspectivas + síntese) — 08/06/2026*

---

## Reclassificações aprovadas

| Item | Original | Proposto | Motivo |
|------|----------|----------|--------|
| #11 ParseLocaleFloat | 🟡 | 🔴 **imediato** | Bug ativo em produção. Cota errada no PDF = abandono silencioso |
| #9 Onboarding 60s | 🟡 | 🔴 pré-distribuição | Sem onboarding os outros itens são invisíveis |
| #10 Instrução PWA | 🟡 | 🔴 pré-distribuição | Diferencial offline não existe para o usuário sem "Adicionar à tela inicial" |
| #8 Layers ABNT/ABEA | 🟡 | 🔴 para escritórios | Moat BR — nenhum concorrente americano vai implementar |
| #17 Modo reforma | 🟢 | 🟡 | 70-80% dos levantamentos BR são de reforma; MagicPlan não tem |

---

## Dependências ocultas não documentadas

**#13 (snap endpoint) é pré-requisito de #1 (área ao vivo)**
Sem snap de endpoint preciso no tablet, o polígono de ambiente "quase fecha" com folga de pixels. O algoritmo de detecção de ambiente falha, a área não calcula. Item 13 deve ser entregue no sprint imediatamente anterior ao item 1.

**#1 e #4 devem ser um sprint único, não itens separados**
"Área ao vivo no canvas" e "Área por ambiente no PDF" dependem do mesmo modelo: `canvas.environments` com cálculo de área. Separar em sprints distintos força refatoração dupla do mesmo modelo de dados. Entrega correta: um sprint que entrega as duas saídas.

**#11 deve ser corrigido ANTES de #2 (cota editável)**
Input de cota sem `parseLocaleFloat` aceita "3,45" e interpreta como NaN ou 3. O app salva geometria corrompida silenciosamente. DXF sai com medidas erradas.

**#6 (import .elle) precisa de schema versioning embutido**
Campo `"version"` no JSON + lógica de migração (`normalizeProject` já faz isso para canvas, mas o container precisa de versão). Sem isso, a primeira mudança de schema (.elle v2 com multi-pavimento, modo reforma) quebra todos os arquivos exportados anteriormente.

---

## Ausências críticas — não estavam na lista original

**Threshold de toque 48×48dp**
Constraint transversal de design, não item de backlog. Afeta todo item com interação (editar abertura, cota editável, snap de endpoint). A ausência vai gerar retrabalho em campo.

**Estratégia de compressão de fotos para IDB**
10 ambientes × 3 fotos sem compressão > 100MB. O IndexedDB pode falhar silenciosamente em alguns dispositivos Android. Pré-requisito arquitetural do item #18 (relatório com fotos).

**Tela de erro amigável para IDB cheio ou modo privado**
Em modo privado o IDB não persiste. O app precisa avisar *antes* que o usuário perca o trabalho, não depois via overlay genérico.

---

## Roadmap proposto — primeiros 3 sprints

### Sprint 0 — Confiança mínima (pré-condição para distribuição externa)

| # | Item | Status |
|---|------|--------|
| 11 | ParseLocaleFloat em todos os inputs numéricos | ✅ 08/06/2026 |
| 6 | Import `.elle` + campo `"version"` no JSON + migração | pendente |
| 10 | Instrução de instalação PWA (detecta plataforma) | pendente |
| 9 | Onboarding 60 segundos (validar com Camila real antes de codar) | pendente |

*Critério de saída: app pode ser dado para arquiteto externo sem supervisão.*

### Sprint 1 — Precisão de campo

| # | Item |
|---|------|
| 2 | Cota editável in-line (tap → numpad → propaga geometria) |
| 3 | Editar abertura após inserção (sidebar edição, target 48dp) |
| 13 | Snap de endpoint ao arrastar (~44px touch, feedback visual) |

*Critério de saída: arquiteto completa levantamento real sem redesenhar nenhum elemento.*

### Sprint 2 — Modelo de ambientes (sprint único, três entregáveis)

| # | Item |
|---|------|
| 1+4 | Área ao vivo no canvas + Área no PDF (mesmo modelo `canvas.environments`) |
| 14 | CSV de áreas por ambiente (custo marginal do mesmo sprint) |

*Critério de saída: arquiteto sai do campo com planta + áreas + PDF pronto para o cliente.*

### P1 — depois dos 3 sprints
- PDF com carimbo configurável + norte via bússola (#7) com fallback manual
- Layers ABNT/ABEA no DXF (#8)
- Duplicar projeto (#12), medição ponto-a-ponto (#19)
- Modo reforma (#17) — agora em 🟡

### Backlog longo prazo
- Multi-pavimento (#20) — só após import .elle com versionamento estável
- Relatório com fotos (#18) — requer estratégia de compressão primeiro
- DXF pronto para SketchUp (#16)
- Ângulo livre (#15)

---

## Veredito final (síntese dos 4 agentes)

**O que está certo:** o núcleo do roadmap identifica corretamente os itens de maior impacto. A decisão de ficar offline-first e não implementar sync, LiDAR ou Bluetooth é estrategicamente correta para o mercado BR.

**O que estava errado:** o roadmap tratava bugs de produção como features de backlog (ParseLocaleFloat), separava itens com o mesmo modelo de dados em sprints distintos criando retrabalho certo (#1 e #4), e classificava pré-condições de adoção (onboarding, instrução PWA, import .elle) como conforto quando são bloqueadores de retenção.

**O que fazer primeiro:** corrigir ParseLocaleFloat em todos os formulários (✅ feito), implementar import .elle com schema versioning, não dar o app para nenhum usuário externo sem o onboarding de 60 segundos validado com uma persona real — nessa ordem, sem exceção.
