# Auditoria de Usabilidade — Apps de Levantamento Arquitetônico

> Pesquisa hands-on realizada em maio/2026.
> Fontes: documentação oficial, reviews App Store/Google Play/Capterra,
> tutoriais reais e análises técnicas independentes.
> Onde não há evidência confiável, indicado como "não documentado".

---

## TABELA COMPARATIVA — Dificuldade por Tarefa

Legenda: **F** = Fácil · **M** = Médio · **D** = Difícil · **—** = Não existe / não documentado

| Tarefa | OrthoGraph | MagicPlan | RoomScan Pro | Floor Plan Creator |
|---|:---:|:---:|:---:|:---:|
| **NAVEGAÇÃO** | | | | |
| Zoom in/out (pinça) | M | F | F | F |
| Pan sem mover elemento por engano | M | M | M | M |
| Selecionar parede fina com o dedo | D | D | D | D |
| Orientação / não se perder | M | M | M | M |
| **DESENHAR A PLANTA** | | | | |
| Criar 1ª parede e ajustar medida exata | M | M | F* | M |
| Fechar um ambiente | M | F | M | M |
| Corrigir erro / Undo | D | F | D† | F |
| Mover parede já desenhada | D | D | D | D |
| Paredes diagonais | M | M | D | D |
| Paredes curvas | M‡ | — | — | — |
| **ABERTURAS** | | | | |
| Porta — inserir e distância do canto | M | M | F* / M | M |
| Janela — inserir e altura do peitoril | M | D | M | M |
| **INSTALAÇÕES** | | | | |
| Ponto elétrico — inserir e altura | M/D | M | — | M |
| Ponto hidráulico — inserir e altura | M/D | M | — | — |
| Ancorado na parede? | — | Depende do tipo | — | Parcial |
| **ESTRUTURAL E ESPECIAL** | | | | |
| Escada | D | M | M | M |
| Viga / elemento estrutural | — | — | — | M |
| Pé-direito (por andar e por ambiente) | M | F | M | M |
| Desnível / rampa | — | — | — | — |
| **LOUÇAS E EQUIPAMENTOS** | | | | |
| Vaso sanitário / pia / cuba | F/M | F | F (LiDAR auto) | F |
| Cadeira odontológica | — | — | — | — |
| Mobiliário geral (inserir e girar) | F | F | F | F |
| **VERIFICAÇÃO** | | | | |
| Conferir cotas | M | M | F | F |
| Visualização 3D | D§ | F | M | M |
| **UMA MÃO, EM PÉ, NO CAMPO** | ❌ | ❌ | ❌ | ❌ |

*RoomScan: Brick Mode v10.0+ detecta portas automaticamente. Medida via LiDAR, sem digitar.
†RoomScan: undo não documentado oficialmente; editor pós-scan descrito como "terrible" por usuários.
‡OrthoGraph: paredes curvas suportadas mas com histórico de bugs com aberturas.
§OrthoGraph: bug crítico de zoom 3D documentado — "se você tenta dar zoom, vai para o outro lado do planeta".

---

## VEREDITOS DE USABILIDADE POR APP

---

### OrthoGraph — Poderoso para quem tem Leica; sofrido para todos os outros

**O que é gostoso de usar:**
- Com laser Leica Disto via Bluetooth, a medida vai direto para o elemento sem digitar — é fluido e confiável. É o único app onde o instrumento de campo se integra de verdade ao desenho.
- A conversão de esboço livre a parede reta funciona bem para formas simples.
- Biblioteca de 1.300+ objetos BIM é a mais completa dos 4.

**O que é sofrido:**
- **Login obrigatório antes de qualquer coisa** — usuários travam antes de abrir a primeira planta. Nota App Store: 2,1–2,7/5.
- Seleção de elemento exige acertar pontos de controle pequenos; reviewer da Architosh levou semanas para ficar "bom em desenhar cômodos com complexidade".
- Undo/redo com escopo opaco — não está claro o que será desfeito.
- Escada: **"a falta de capacidade de desenhar escadas é uma limitação significativa"** (App Store GB).
- Bug grave no zoom 3D: rotação orbita ao infinito.
- Botão Help abre e-mail, não ajuda contextual. No campo isso é o mesmo que não ter ajuda.
- Interface portada de desktop para mobile sem redesign — exige as duas mãos em todas as tarefas.

**Fontes:** [Architosh Review 2017](https://architosh.com/2017/02/product-review-orthograph-i-building-survey-system-for-aec-pros/) · [App Store US](https://apps.apple.com/us/app/orthograph-floor-plan/id1230478788) · [App Store GB](https://apps.apple.com/gb/app/orthograph-floor-plan/id1230478788)

---

### MagicPlan — O mais completo em recursos, o mais frustrante em campo

**O que é gostoso de usar:**
- Aberturas **cortam a parede automaticamente** ao serem inseridas — comportamento correto e fluido.
- Pé-direito em dois níveis (andar + ambiente) com fallback inteligente — o melhor dos 4.
- Vista 3D é fluida e acessível em 1–2 toques.
- Undo funciona com 1 toque. (O único toque negativo: sem redo.)
- Scan LiDAR é impressionante em ambientes vazios.

**O que é sofrido:**
- **Pan e seleção usam o mesmo gesto de 1 dedo.** Em campo, mover a planta ou mover uma parede por engano é quase inevitável em plants densas.
- Altura de peitoril de janela e altura de pontos elétricos exigem Elevation View — **6+ toques em tela separada** para cada elemento.
- **Paredes curvas não existem.** Paredes diagonais: possíveis mas sem entrada de ângulo numérico.
- **DXF exportado sem cotas** — documentado oficialmente. Inviabiliza entrega profissional direta.
- Sem redo — desfazer demais obriga a refazer manualmente do zero.
- Android perdeu scan com câmera em 2024 — funcionalidade muito reduzida em Android.
- Cadeira odontológica: não existe nativamente. Requer criação via Custom Object Manager no browser, fora do campo.

**Fontes:** [help.magicplan.app](https://help.magicplan.app) · [machow2.com/magicplan-review](https://machow2.com/magicplan-review/) · [TechRadar](https://www.techradar.com/reviews/magicplan) · [Capterra](https://www.capterra.com/p/210335/magicplan/reviews/)

---

### RoomScan Pro — Imbatível em velocidade de captura; inútil para o resto

**O que é gostoso de usar:**
- Brick Mode v10.0+ é genuinamente mágico para captura de geometria básica: 7 cômodos em ~8 minutos, detectando portas, janelas e móveis automaticamente.
- Pé-direito capturado automaticamente pelo LiDAR sem digitar.
- Nota App Store de 4,3/5 — o mais bem avaliado dos 4.

**O que é sofrido:**
- **Editor pós-scan é "terrible"** (palavras de múltiplos usuários). Sem undo documentado. Para corrigir um erro de scan, é mais rápido resscanear do que editar.
- *"I can't figure out how to modify the base plan after finishing a scan"* — incapacidade de editar pós-scan é reclamação recorrente.
- Paredes diagonais: motor de RoomPlan retifica automaticamente ângulos — distorce geometria real de construções irregulares.
- **Pontos elétricos e hidráulicos: não existem.** Absolutamente. Nenhuma fonte menciona instalações técnicas.
- Viga, pilar, rampa, desnível: não documentados.
- Paredes de vidro do chão ao teto = sem leitura pelo LiDAR.
- Requer hardware caro (iPad Pro 2020+ ou iPhone 12 Pro+). Sem LiDAR: Touch Mode (encostar na parede), que é o fluxo mais lento possível.
- Joining rooms em posições erradas após montagem é "highly unintuitive".

**Fontes:** [locometric.com/lidar-faq](https://www.locometric.com/lidar-faq) · [locometric.com/instructions](https://www.locometric.com/instructions) · [App Store RoomScan](https://apps.apple.com/us/app/roomscan-pro-lidar-floor-plans/id1504050801) · [MAVRiC Research](https://mavricresearch.com/2021/02/02/more-lidar-contenders-how-do-they-measure-up/)

---

### Floor Plan Creator — O mais próximo do Elle, mas ainda capenga no campo

**O que é gostoso de usar:**
- Undo funciona com 1 toque — consistente.
- Inserção de mobiliário por drag-and-drop é o ponto mais robusto do app (10M de downloads confirmam).
- Cotas automáticas ao selecionar elementos e labels com variáveis calculadas (`<area>`, `<perimeter>`) são únicos entre os 4.
- Suporte a laser Bluetooth de várias marcas (Bosch, Leica, Hilti, Stabila) — o mais amplo dos 4.
- Escada com configuração de degrau, altura e guarda-corpo — o mais configurável dos 4.
- Compra única (sem assinatura) — modelo honesto.

**O que é sofrido:**
- Selecionar a borda interior de uma parede exige precisão milimétrica — ponto de dor confirmado pelo changelog (melhorias de seleção em múltiplas versões).
- Mover uma parede pode arrastar as adjacentes sem aviso — usuários confundem com bug.
- Objetos bloqueados não têm indicação visual de que estão travados — "parede que não se move" é causa de abandono.
- **Paredes curvas: impossível.** Confirmado na documentação oficial.
- Hidráulica: não documentada como categoria nativa.
- Cadeira odontológica: não existe nativamente.
- Tamanho padrão de louças sanitárias "*much larger than the screen allows*" — exige ajuste manual.
- DXF pago separado (€4,49) — camadas não documentadas.

**Fontes:** [floorplancreator.net/help/faq](https://floorplancreator.net/help/faq) · [floorplancreator.net/changelog](https://floorplancreator.net/changelog) · [carolineondesign.com](https://carolineondesign.com/review-of-5-free-floor-plan-apps/) · [Google Play](https://play.google.com/store/apps/details?id=pl.planmieszkania.android)

---

## LIÇÕES DE USABILIDADE PARA O ELLE

### O QUE COPIAR — interações que funcionam

**1. Undo com 1 toque e feedback claro de escopo**
MagicPlan e Floor Plan Creator acertam: botão visível, 1 toque, funcionamento previsível.
O Elle deve: manter o botão de undo sempre visível na toolbar, com indicação do que será desfeito (ex: "Desfazer: parede 3,20m").

**2. Aberturas que cortam a parede automaticamente**
MagicPlan acerta: colocar a porta/janela já abre o vão. O Elle já tem a relação `openings.wallId/position/width` nos dados. Falta só a renderização. Impacto imediato na legibilidade da planta.

**3. Inserção por drag-and-drop com snap à parede**
Floor Plan Creator acerta para mobiliário; MagicPlan para objetos de parede. O snap deve ser visual e imediato — o usuário vê o objeto "grudar" na parede antes de soltar.

**4. Pé-direito em dois níveis com fallback inteligente**
MagicPlan acerta: padrão por andar, override por ambiente. A regra "configurado individualmente antes não é sobrescrito pelo global" é o comportamento certo.

**5. Comprimento ao vivo durante o desenho**
RoomScan/OrthoGraph mostram a cota enquanto a parede cresce. O Elle já tem a parede guiada em cadeia — exibir o comprimento em tempo real durante a mira é baixo esforço e alto valor.

**6. Snap visual com trava de ângulo**
Todos os apps têm snap, mas nenhum tem a mudança de cor ao travar em 0°/45°/90° como o MagicPlan faz para paredes anguladas. No tablet sem régua, indicar visualmente "travei em 90°" reduz erros.

**7. Área tocável de parede ampliada**
Todos os 4 falham em seleção de paredes finas. A solução: ampliar a área de hit test de cada parede para ±12px além da linha visível. É a diferença entre usar com o dedo e precisar de caneta.

**8. Botão "fit to screen" óbvio**
Nenhum dos 4 tem isso bem posicionado. É o único botão que resolve "me perdi na planta" sem tutorial.

---

### O QUE EVITAR — fricções que afastam o usuário

**1. Pan e seleção no mesmo gesto de 1 dedo**
MagicPlan: mover a planta e mover uma parede usam o mesmo gesto. Resultado: paredes movidas por engano são a reclamação mais constante em campo.
→ O Elle deve: 2 dedos sempre = pan; 1 dedo = só interage com elementos. Ou ter modo de navegação explícito.

**2. Configuração de altura de ponto em tela separada**
MagicPlan exige Elevation View para definir a altura de qualquer ponto (6+ toques, 2 telas). Para tomada a 30cm e ponto de água a 60cm, isso é impraticável em campo.
→ O Elle deve: campo de altura direto no formulário de inserção do ponto. 1 formulário, 1 toque de confirmação.

**3. Undo sem redo**
MagicPlan: desfazer muito obriga a refazer do zero.
→ O Elle deve: undo + redo sempre juntos.

**4. Login obrigatório**
OrthoGraph: a primeira barreira é criar conta. Em campo sem Wi-Fi, isso trava o app.
→ O Elle: nunca. Offline total, zero cadastro.

**5. Menu circular (radial) para operações frequentes**
RoomScan usa menu de 6 posições ao redor do elemento para todas as ações. Em campo com o dedo, acertar o setor certo do círculo em tablet é impreciso.
→ O Elle deve: ações frequentes em botões lineares visíveis, não em menus circulares.

**6. Mover parede que arrasta adjacentes sem aviso**
Floor Plan Creator: mover uma parede de um ambiente fechado arrasta as vizinhas silenciosamente.
→ O Elle deve: ao mover uma parede que está conectada a outra, mostrar um aviso ou travar as pontas para preservar os ângulos.

**7. Bug de zoom 3D**
OrthoGraph: zoom 3D quebrado transforma o modo de verificação em inutilizável.
→ O Elle deve: testar zoom + pan + rotação em modo 3D como prioridade antes de lançar esse modo.

**8. Altura padrão de ponto sem configuração global**
MagicPlan: cada tomada precisa ter sua altura definida individualmente via Elevation View.
→ O Elle deve: ao inserir uma tomada, o app já sugere 30 cm. Ao inserir um interruptor, sugere 1,20 m. O usuário confirma ou altera — mas o default inteligente poupa 90% do esforço.

---

## RESUMO: NENHUM APP É USÁVEL COM UMA MÃO, EM PÉ, NO CAMPO

Este é o diagnóstico universal dos 4 apps. Toda edição além de "undo" e "zoom" exige os dois dedos, o tablet apoiado, ou uma curva de aprendizado de semanas.

**Implicação direta para o Elle:**
O Elle roda em tablet de campo, mãos ocupadas com trena. O design deve partir do princípio de que cada interação pode ser feita com o **polegar de uma mão** enquanto a outra segura o equipamento.

Critério de design para o Elle:
- Botões grandes (min. 44×44pt, recomendado 56×56pt para campo)
- Ações de uma etapa para os 3 fluxos mais frequentes: iniciar parede, confirmar medida, inserir abertura
- Nenhuma ação crítica escondida em sub-menus circulares ou em 4+ toques
- Feedback visual imediato a cada toque (toast, highlight, cota aparecendo)

---

*Fontes completas por app estão detalhadas nos relatórios individuais acima.*
*Pesquisa: OrthoGraph — Architosh 2017, App Store US/GB | MagicPlan — help.magicplan.app, TechRadar, machow2.com, Capterra | RoomScan — locometric.com, App Store, MAVRiC Research | Floor Plan Creator — floorplancreator.net, Caroline on Design, Google Play*
