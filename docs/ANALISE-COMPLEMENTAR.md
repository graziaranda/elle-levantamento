# Análise Complementar — Elle Levantamento
> Pesquisa multi-agente paralela — 07/06/2026
> 6 análises independentes: personas, mercado BR, distribuição, DXF, workflow pós-levantamento, Elle×MagicPlan

---

## 1. PERSONAS REAIS DE USUÁRIO

> Dados baseados no II Censo CAU/BR (2021, 41.897 respondentes), Vobi 2024, CAU/BR.

### Contexto do setor
- **212.000** arquitetos e urbanistas registrados no CAU/BR (2025)
- **51% são autônomos** — trabalham solo ou como freelancer
- **62% atuam em arquitetura de interiores** — especialidade dominante
- **64% são mulheres** — profissão feminilizada, especialmente abaixo dos 35 anos
- **35% ganham entre 1 e 3 salários mínimos**
- Método dominante atual: **trena + papel quadriculado → croqui à mão → digitação em AutoCAD**

### Persona 1 — Camila (Arquiteta de Interiores Solo)
- 29 anos, Curitiba, MEI, Samsung Galaxy Tab A8, 2–4 levantamentos/mês
- **Dor principal:** segunda visita ao imóvel por esquecer de medir peitoril, sentido de abertura, etc.
- **Critério eliminador:** qualquer ferramenta paga
- **Elle resolve:** 100% — parâmetros completos de esquadrias + DXF eliminam segunda visita e digitação

### Persona 2 — Rafael (Técnico de Campo de Construtora)
- 34 anos, BH, técnico em edificações, Samsung Tab S6 Lite, 3–8 levantamentos/semana
- **Dor principal:** foto de papel enviada por WhatsApp chega comprimida e ilegível para o desenhista
- **Critério eliminador:** mais lento que papel
- **Elle resolve:** parcialmente — elimina a foto do papel, mas falta duplicação de planta para apartamentos padronizados

### Persona 3 — Beatriz (Arquiteta de Escritório Pequeno)
- 38 anos, SP, 3 pessoas no escritório, iPad Pro/Android, 4–6 levantamentos/mês
- **Dor principal:** MagicPlan foi decepção — câmera imprecisa em apartamentos antigos; etapa de digitação consome 5h por projeto
- **Critério eliminador:** imprecisão (experiência Magicplan)
- **Elle resolve:** sim — entrada manual com trena + DXF elimina digitação; falta ângulo livre

### Persona 4 — João Victor (Recém-Formado)
- 25 anos, Fortaleza, sem tablet (celular Samsung A54), 1–3 levantamentos/mês
- **Dor principal:** sem método consolidado, 5h para ganhar R$200, resultado amateur
- **Critério eliminador:** requer conta/instalação
- **Elle resolve:** sim — estrutura força medir tudo + PDF profissional

### Persona 5 — Fernanda (Escritório Médio, 5 pessoas)
- 45 anos, Porto Alegre, delega levantamento, Android variado na equipe
- **Dor principal:** escalar sem contratar mais; padronização de output entre arquitetos
- **Critério eliminador:** não exporta para Revit / sem camadas no DXF
- **Elle resolve:** parcialmente — falta ângulo livre, multi-pavimento, sync entre dispositivos

### Funcionalidades P0 consolidadas (frequência de menção)
1. **Exportação DXF funcional** — todas as 5 personas
2. **100% offline** — todas as 5 personas
3. **Teclado numérico grande e rápido** — 4 de 5
4. **Parâmetros completos de esquadrias** (peitoril, distância, sentido, largura, altura) — 4 de 5
5. **Gratuidade** — 3 de 5
6. **Trava 90° padrão** — 3 de 5
7. **Ângulo livre** — 2 de 5 (alto padrão + comercial)
8. **PDF de qualidade profissional** — 2 de 5

---

## 2. MERCADO BRASILEIRO DE ARQUITETURA

### Tamanho do mercado
- **~244 mil** arquitetos registrados no CAU/BR (2025)
- **~400 mil** engenheiros civis ativos (CONFEA)
- **Total endereçável:** 550–600 mil profissionais habilitados
- **Mercado primário** (fazem levantamento regularmente): **70–100 mil profissionais**
- 80% autônomos ou pequenos escritórios, sem TI corporativa

### Padrões técnicos vigentes
- **NBR 16636:2017** substituiu a NBR 13532:1995 — define o LV-ARQ como primeira etapa do projeto
- Documentos obrigatórios do LV-ARQ: plantas baixas, cortes/elevações (quando necessário), memorial descritivo, registro fotográfico
- **DXF + PDF** atendem completamente — nenhum formato digital específico é obrigado pelo CAU
- RRT deve ser emitido pelo arquiteto pelo sistema do CAU (o app não precisa gerar isso)
- **Decreto 11.888/2024 (BIM BR):** BIM obrigatório em obras públicas até 2028 — pressão crescente de digitalização

### Software CAD usado no Brasil
| Software | Penetração no residencial |
|----------|--------------------------|
| AutoCAD | Dominante — praticamente universal |
| SketchUp | Muito alto — padrão para 3D residencial |
| Revit | Baixo em residencial, alto em grandes escritórios |
| ArchiCAD | Nicho (Sul, médios escritórios) |

**Para o Elle:** AutoCAD é o alvo principal. DXF em mm, layers nomeados em português, geometria limpa.

### Tablets usados no campo no Brasil
- **Samsung Galaxy Tab A8** (R$900–1.200) — mais popular entre profissionais
- **Samsung Galaxy Tab S6 Lite** (R$1.200–1.800) — intermediário mais comum
- iPad Pro exige R$8.000–12.000 — o que MagicPlan/Polycam com LiDAR exigem
- **O Elle funciona em Android de entrada (R$900) — os concorrentes precisam de hardware de R$8.000+**

### Contexto econômico
- Preço do levantamento: R$3–15/m², mínimo R$900 por projeto
- MagicPlan PRO: mínimo US$250/mês (~R$1.450/mês) — inviável para autônomo que fatura R$4.000–7.000
- **Elle: R$0**
- Câmbio instável (R$5,00–6,50 nos últimos 2 anos) torna assinaturas em dólar imprevisíveis

### Oportunidade de idioma
- **Todos os 6 concorrentes relevantes são em inglês-only**
- Gap real no mercado BR, especialmente interior e regiões Norte/Nordeste

---

## 3. CANAIS DE DISTRIBUIÇÃO

### Onde os arquitetos brasileiros estão
- **Instagram: 74% dos arquitetos usam** — maior rede profissional da categoria
- **TikTok:** crescimento acelerado; `#arquitetosdotiktok` ativo, conteúdo de "dica de ferramenta em campo" performa muito bem
- **WhatsApp:** grupos do IAB por estado, grupos de escritório/turma — canal de difusão mais rápido
- **YouTube:** aprendizado técnico (PractCAD, Geração BIM, Arquitêta ~150k inscritos)

### Funil real de adoção
1. **Descoberta:** colega mostra em uso real > vídeo no TikTok/Reels > YouTube (busca ativa)
2. **Consideração:** gratuidade elimina barreira de teste; português é diferencial crítico; sem conta = zero fricção
3. **Adoção:** resolve melhor que papel + trena; output utilizável no AutoCAD
4. **Compartilhamento:** "Olha o que uso na obra" → WhatsApp do escritório/turma

### Benchmark: como o AutoCAD dominou o Brasil
Entrou pelas **faculdades** nos anos 1990 — adoção top-down acadêmica, não bottom-up. Implicação: **professores de levantamento são multiplicadores de alto impacto**.

### PWA: barreira ou vantagem?
- **Barreira:** usuário espera Play Store. Instalação não é óbvia.
- **Vantagem:** zero fricção de conta e login; distribui link diretamente; itera sem aprovação de loja
- **Solução:** vídeo curto de instalação junto com o link

### Estratégia de distribuição sem verba (prioridade)
1. **TikTok + Instagram Reels** — vídeo 30–60s do levantamento real em campo (resultado imediato visível)
2. **WhatsApp** — ativar 10–20 "nós da rede" (donos de escritório, professores) que compartilham com equipe
3. **YouTube parceria** — demonstração real num canal técnico (ex: Arquitêta 150k inscritos)
4. **Professores universitários** — disciplinas de Levantamento Arquitetônico nas maiores faculdades

### O que o app precisa ter para ser compartilhado espontaneamente
1. Resultado visível imediato (planta aparecendo enquanto mede) — filmável
2. Link curto e fácil de copiar para o WhatsApp
3. Instrução de instalação em 1 tela
4. Exportação compatível com AutoCAD — quem usa mostra para o colega

---

## 4. ANÁLISE TÉCNICA DO DXF

> Baseado na leitura completa de `js/dxf-writer.js` (451 linhas)

### Versão e estrutura
- **AC1015 (AutoCAD R2000)** — escolha correta. Abre em AutoCAD 2000–2025, LT, LibreCAD, SketchUp
- Seções HEADER, TABLES, BLOCKS, ENTITIES, EOF presentes e corretas
- Unidades: `$INSUNITS=4` (mm), `$MEASUREMENT=1` (métrico) — correto para ABNT
- Precisão: `.toFixed(1)` = 0,1mm — suficiente para arquitetura

### Layers (o que tem)
| Layer | Cor ACI | Uso |
|-------|---------|-----|
| PAREDES | 7 (branco/preto) | Geometria das paredes |
| ABERTURAS | 3 (verde) | Portas e janelas |
| ELETRICA | 2 (amarelo) | Instalações elétricas |
| HIDRAULICA | 5 (azul) | Instalações hidráulicas |
| COTAS | 1 (vermelho) | Entidades DIMENSION |
| AMBIENTES | 4 (ciano) | Polígonos de ambiente |
| NOTAS | 6 (magenta) | Textos de notas |
| FOTOS | 6 (magenta) | Photo pins |
| ODONTO | 3 (verde) | Instalações odontológicas |

### Cotas — DIFERENCIAL COMPETITIVO PRINCIPAL
- **O Elle exporta entidade `DIMENSION` nativa AC1015** com bloco anônimo `*Dn` de fallback
- **MagicPlan exporta DXF sem cotas** (declarado oficialmente)
- **Polycam bloqueia DXF no plano Business ($400/ano)**
- **Floorplanner exporta TEXT simples** (sem associação geométrica)
- O Elle é superior aos 3 principais concorrentes nesse quesito

### O que falta (crítico)
| Item | Impacto | Esforço |
|------|---------|---------|
| Tabela LTYPE ausente | Warning no AutoCAD LT | Baixo — ~8 linhas |
| Tabela STYLE ausente | Textos com fonte padrão americana | Baixo |
| DIMSTYLE não declarado | Cotas com aparência americana | Médio |
| Vãos não cortam parede | Linha de parede passa pela porta no CAD | Alto |

### O que falta (importante)
- Hachura nas paredes (HATCH) — padrão ABNT em cortes
- Tipos de linha por especialidade (DASHED para hidráulica)
- LWPOLYLINE em vez de 4 LINEs por parede (paredes não são objetos únicos)
- Norte e escala gráfica

### Compatibilidade
| Software | Status |
|----------|--------|
| AutoCAD 2000–2025 | Alta |
| AutoCAD LT | Alta (com ressalva do LTYPE) |
| LibreCAD | Média (DIMENSION parcial, usa fallback *Dn) |
| SketchUp | Média (paredes OK, DIMENSION ignorada) |
| DraftSight / BricsCAD | Alta |

---

## 5. WORKFLOW PÓS-LEVANTAMENTO (O que acontece no escritório)

### Fluxo completo do arquiteto BR
**Campo (levantamento)** → **"Passar a limpo" (2–8h de digitação)** → **Estudo Preliminar** → **Anteprojeto** → **Projeto Legal** → **Projeto Executivo**

O passo "passar a limpo" é o mais caro e o que o Elle elimina se o DXF for utilizável diretamente.

### Software CAD alvo
- **AutoCAD:** destino primário do DXF
- **SketchUp:** destino do modelo 3D (importa DXF plano e extru da paredes)
- **Revit:** irrelevante para a maioria do público-alvo do Elle

### Padrões de DXF que o mercado espera
- **Layers padrão AsBEA:** `ARQ-ALV` (paredes), `ARQ-ESQ-POR` (portas), `ARQ-ESQ-JAN` (janelas), `ARQ-CTA-GER` (cotas)
- **Unidade: mm** (ABNT) — conflito de escala é o erro mais comum na importação
- **Escala 1:50** para residencial médio (1:100 para implantação)

### O que o PDF profissional precisa ter
| Elemento | Obrigatório (NBR 6492) |
|----------|----------------------|
| Cotas completas | Sim |
| Norte | Sim |
| Escala gráfica + numérica | Sim |
| Carimbo (nome, endereço, data, responsável) | Sim (ABNT) |
| Nomes dos ambientes | Sim |
| Área por ambiente | Desejável |

### Gaps do Elle no workflow atual
1. **Layers sem padrão AsBEA** — arquiteto precisa renomear (30–90 min de retrabalho)
2. **DXF sem carimbo/norte/escala gráfica** — arquivo do Elle = rascunho, não documento técnico
3. **Vãos não cortam geometria da parede** — linha de parede passa pela porta no AutoCAD
4. **Sem área por ambiente** — MagicPlan já tem; é item de paridade competitiva

### Oportunidades de diferenciação (nenhum concorrente faz hoje para o BR)
1. **DXF "pronto para AutoCAD"** com layers AsBEA em mm, geometria limpa, zero retrabalho
2. **PDF com carimbo configurável** + norte automático via bússola do tablet
3. **DXF "pronto para SketchUp"** — paredes como regiões fechadas, Push/Pull direto
4. **Modo reforma** — layers EXISTENTE/DEMOLIR/PROPOSTA
5. **Relatório com fotos geoposicionadas** por ambiente — documento de briefing direto do campo

### Priorização para o Elle
| Prioridade | Melhoria | Impacto |
|-----------|----------|---------|
| P0 | DXF geometria limpa + mm confirmado | Elimina motivo de rejeição do DXF |
| P0 | PDF com carimbo configurável + escala + norte | Torna arquivo entregável sem AutoCAD |
| P1 | Layers com nomenclatura de mercado | Reduz retrabalho de 1h para zero |
| P1 | Área por ambiente no PDF | Paridade com MagicPlan |
| P2 | Export "pronto para SketchUp" | Elimina etapa inteira do workflow 3D |
| P3 | Modo reforma (existente/demolir/proposta) | Novo segmento de uso |

---

## 6. COMPARAÇÃO DETALHADA ELLE × MAGICPLAN

### Tabela resumo

| Dimensão | Elle | MagicPlan | Vencedor |
|----------|------|-----------|---------|
| Precisão | = trena (1–2mm) | Scan: 50–170mm; com laser: equivale | Elle (sem hardware extra) |
| Portas e janelas | Formulário completo (dist., larg., alt., peitoril, sentido) | Rotate+Mirror para sentido; auto-detect no scan | Elle |
| Offline | 100% offline, filosofia | Cloud-first, lock-out sem pagamento | Elle |
| Export DXF | Com cotas DIMENSION nativas, 9 layers | Sem cotas (oficial), linhas não perpendiculares (reviews) | **Elle** |
| Plataforma | Qualquer Android/iOS via navegador | iOS melhor, Android sem LiDAR limitado | Elle (alcance) |
| Velocidade de captura | Mais lento (trena física) | Muito rápido com LiDAR iOS | MagicPlan |
| Colaboração e sync | Nenhuma — single device | Multi-dispositivo, cloud sync | MagicPlan |
| 3D e relatórios | Nenhum | 3D automático, PDF com fotos, IFC | MagicPlan |
| Custo | R$ 0 | Mínimo US$250/mês (~R$1.450) | Elle |

### Cenários onde o Elle claramente vence
1. **Levantamento para projeto executivo de reforma** — arquiteta com trena, Android, sem internet, precisa de DXF com cotas para o AutoCAD ainda hoje
2. **Escritório pequeno com volume médio** — 5 arquitetos, 20 projetos/mês; MagicPlan custaria US$600–800/mês com overages
3. **Ambientes complexos** — planta irregular, jogs, reentrâncias; LiDAR confunde canto de armário com canto de parede (erro de 170mm); Elle entrega geometria exata

### Cenários onde o MagicPlan claramente vence
1. **Documentação de sinistro/vistoria de seguro** — 10 apartamentos/dia, precisão de 5cm é suficiente, integração Xactimate
2. **Apresentação comercial 3D** — 3D fotorrealista gerado na hora para cliente
3. **Equipe distribuída** — 5 pessoas no campo, coordenador no escritório, sync automático

### As 3 features do MagicPlan que o Elle deve implementar primeiro
1. **Integração com trena laser Bluetooth** (Web Bluetooth API no Chrome Android) — medida entra automaticamente ao apertar o gatilho; elimina o único atrito do fluxo do Elle
2. **"Set distance" visual** — ao selecionar abertura existente, mostrar cota de distância do canto na planta em tempo real
3. **Export CSV/tabela de ambientes** — área m², perímetro, lista de vãos — memorial de áreas pronto sem cálculo manual

---

## SÍNTESE EXECUTIVA

### O Elle já tem o que ninguém tem (confirmado)
- Cotas DIMENSION nativas no DXF — MagicPlan não tem, Polycam trava atrás de $400/ano
- 9 layers especializados — nenhum concorrente gratuito tem
- Parâmetros completos de esquadrias (peitoril + sentido de abertura)
- PWA offline em qualquer tablet Android de R$900

### Gaps priorizados para implementação (ordem real)
| # | Gap | Quem afeta | Esforço |
|---|-----|-----------|---------|
| 1 | IndexedDB (localStorage 5MB é risco de perda de dados) | Todos | Médio |
| 2 | PDF com carimbo + norte + escala gráfica | Todos | Médio |
| 3 | Tabelas LTYPE/STYLE no DXF (warnings AutoCAD LT) | Todos | Baixo |
| 4 | DIMSTYLE BR no DXF (cotas com aparência correta) | Todos | Médio |
| 5 | Área por ambiente no PDF | Todos | Baixo |
| 6 | Layers com nomes de mercado (PAREDE, PORTA...) | Escritórios | Baixo |
| 7 | Ângulo livre (não só 90°/45°) | Alto padrão, comercial | Médio |
| 8 | Web Bluetooth para trena laser | Todos | Alto |
| 9 | Multi-pavimento | Comercial, grandes | Alto |
| 10 | Sync entre dispositivos | Equipes | Alto |

### Posicionamento de mercado definitivo
> "Preciso como trena, offline de verdade, sem mensalidade, em qualquer tablet Android — com DXF que tem cotas e vai direto para o AutoCAD."
>
> Contra: "rápido, impreciso, caro, na nuvem e em inglês" dos concorrentes.

---
*Análise gerada por 6 agentes paralelos — junho 2026*
*Fontes: CAU/BR Censo II, Vobi 2024, App Store/Google Play reviews, ANALISE-CONCORRENTES.md, REVIEWS-CONCORRENTES.md, dxf-writer.js, canvas-editor.js*
