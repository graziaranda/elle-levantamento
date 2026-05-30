# Pesquisa de Concorrentes — Apps de Levantamento Arquitetônico

Pesquisa realizada em maio/2026. Fontes: documentação oficial, help centers, reviews App Store/Google Play/Capterra, fóruns de usuários.

---

## OrthoGraph

**Início:** Login obrigatório antes de qualquer coisa. Após login: Location Manager (gerenciador de projetos). Hierarquia: edificação → andar → cômodo. Usuário começa desenhando com o dedo.

**Medição:** Três métodos: (A) esboço livre + digita medida; (B) laser Bluetooth Leica Disto D1/D2/X3/X4/D810/S910 — medida vai direto para o elemento no plano; (C) "Free Measure" para medir entre quaisquer dois pontos. Sem LiDAR nativo.

**Fechamento:** Automático — algoritmo fecha a forma a partir dos esboços. Cotas aparecem ao receber medida via laser.

**Portas/janelas:** Roda de ferramentas → Object → Door/Window → toca na parede. Posição exata via Survey Tool + laser (mede distância do canto). Suporta múltiplas janelas empilhadas na mesma parede.

**Elétrica/hidráulica:** Biblioteca de 1.300+ objetos incluindo tomadas, luminárias, encanamento, caldeiras, tanques. Altura de objeto não documentada explicitamente. Camadas DXF: menciona opção "Single Layer" — estrutura completa não documentada publicamente.

**Pé-direito:** Por parede individual (propriedades da parede). Sem campo global por cômodo.

**Multi-pavimento:** Location Manager, andares ilimitados na licença Pro. Galeria como tipo especial (não eleva andar superior — para mezaninos). Sem alinhamento automático entre andares.

**Elevação:** Sem vista de elevação ortogonal 2D nativa. Apenas 3D (walk-through, perspectiva orbital, helicóptero, controle de posição solar). Elevações formais: exportar IFC → ArchiCAD/Revit.

**Export DXF:** Menu Export → DXF. Sai geometria de paredes, aberturas, objetos, cotas. Mencionado "Advanced DXF Compatibility" e "Single Layer" option. Camadas por categoria não documentadas. Outros formatos: IFC, PDF, XLSX, JPG.

**Reclamações reais:**
- Login obrigatório antes de testar (App Store 2018)
- "App is slow, clunky, didn't even connect" (App Store 2019)
- Trava na tela de loading após login
- App Store: 2,1/5 estrelas
- Botão Help abre e-mail — sem ajuda contextual no campo (Architosh review)
- Interface "parece software de PC mal adaptado para mobile"
- Dificuldade em desselecionar itens
- Confusão sobre escopo do undo/redo
- Preço: US$14,99/semana a US$399,99/ano

**Fontes:** orthograph.net · architosh.com/2017/02/product-review-orthograph-i · shop.leica-geosystems.com/disto/orthograph · App Store

---

## MagicPlan

**Início:** Project Dashboard → nome/endereço do projeto. Cinco modos de criação: Room Scan Manual Scan (AR câmera), Auto-Scan (LiDAR iOS 17+), Square Room, Free Form/Draw Room, Import & Draw. Android: sem scan — apenas Square Room, Draw Room, Import.

**Medição:**
- Câmera AR (Corner Mode, sem LiDAR): usuário aponta para cantos um a um. ARKit detecta encontro de paredes. Calibração inicial apontando para piso e teto. Impreciso — depende de iluminação.
- Wall Mode (LiDAR manual): aponta para cada parede; verde = confirmada, sem check = não detectada.
- Auto-Scan LiDAR (iOS 17+, ainda em beta): toca botão vermelho, passeia pelo ambiente. Linhas brancas = detecção em tempo real. Paredes não detectadas ficam laranja e bloqueiam finalização.
- Manual: toca nas medidas em azul → "Change Measurement" → scroll ou digitação.

**Fechamento:** Auto-Scan: semi-automático (paredes laranja bloqueiam). Corner Mode / Wall Mode: usuário finaliza manualmente. Draw Room: usuário conecta último canto ao primeiro. Medidas aparecem em azul sobre cada parede ao criar.

**Portas/janelas:** "+ Add" → Object → arrasta para parede. Cortam a parede automaticamente. LiDAR Auto-Scan: detecção automática ao montar ("Assemble"). Cota de posição: manual via "Set Distance". Ajuste de altura na parede: via Elevation View.

**Elétrica/hidráulica:** Biblioteca 300+ objetos. Elétrica: tomadas, interruptores, painéis, luminárias, ventiladores. Hidráulica: pias, vasos, boxes, aquecedores, canos PVC/cobre. Campo "Distance from Floor" por objeto. Circuit Number para elétrica. Camadas DXF: não documentado — thread do fórum "No dimensions in DXF files" existe.

**Pé-direito:** Por andar (padrão 2,44 m) + override por ambiente individual. Se configurado individualmente ANTES do andar, o global não sobrescreve. Suporta teto inclinado via menu separado "Sloped Ceiling".

**Multi-pavimento:** "+ Add Floor". Escadas via Structural objects com atributo "Leads to". Sem alinhamento automático entre andares.

**Elevação:** Existe — Elevation View. Ferramenta de posicionamento: ver parede de frente, ajustar altura/posição de objetos. Pode ser incluída no PDF ("Display elevation in report"). Não gera cotagem formal de obra. Apenas ferramenta de posicionamento, não técnica.

**Export DXF:** App: Export icon → DXF → preview → seção Files. Browser: Send → Export Floor Plans → Export → link azul. CRÍTICO: documentação oficial afirma explicitamente "DXF — dimensions will not be included". Sem cotas no DXF. Camadas por categoria não documentadas. Outros formatos: IFC (planos Report/Estimate), PDF, JPG.

**Reclamações reais:**
- LiDAR não distingue canto de armário de canto de parede (Capterra)
- Erro sistemático de 10–15 cm no scan (Capterra)
- Tela escurece durante Auto-Scan em beta (machow2.com)
- Sem edição no navegador Mac/PC (machow2.com)
- DXF sem cotas — limitação crítica confirmada oficialmente
- Usuários perderam acesso a projetos após mudança de assinatura (Capterra)
- Android sem scan — funcionalidade muito reduzida
- Cômodos pequenos (banheiros) problemáticos para LiDAR
- Preço: US$25–40/mês

**Fontes:** help.magicplan.app · community.magicplan.app · capterra.com/p/210335/magicplan · machow2.com/magicplan-review

---

## RoomScan Pro LiDAR (Locometric)

**Hardware obrigatório:** iPhone 12 Pro+ ou iPad Pro 2020+ com sensor LiDAR. Modelos sem LiDAR: apenas Touch Mode (encostar na parede). iOS/iPadOS 17.6+ mínimo.

**Início:** Lista de propriedades/projetos. Ao criar novo: câmera ao vivo com overlay LiDAR (padrão de "tijolos" sobre superfícies detectadas).

**Três modos:**
- Brick Mode (principal): usuário fica no centro do ambiente, aponta para paredes, o padrão de tijolos aparece, toca para capturar. Swipe para portas/aberturas. Desde v10.0 (maio 2024): detecção automática de portas, janelas, móveis.
- Apple RoomPlan: usuário caminha continuamente, ARKit fecha automaticamente ao completar perímetro. Bom para espaços grandes.
- Touch Mode (sem LiDAR): encostar o dispositivo fisicamente em cada parede.

**Medição Brick Mode:** aponta câmera → padrão de tijolos = LiDAR lendo a superfície → toca para registrar. Planta se forma parede por parede em tempo real com cotas a cada captura. Claim: 7 cômodos em 8 minutos. Profissional de seguros confirmou precisão ao testar com trena laser.

**Fechamento:** No Brick Mode: não é automático — usuário escaneia cada parede individualmente, app compõe o polígono. No RoomPlan: semi-automático ao completar o perímetro.

**Portas/janelas:** Automático desde v10.0 no Brick Mode. Fallback: swipe para aberturas. Problema reportado: janelas importadas no Symbility tinham alturas incorretas.

**Elétrica/hidráulica:** NÃO EXISTE. Nenhuma biblioteca de instalações técnicas. App foca em geometria de espaço e móveis. Desde v10.0, detecta móveis/eletrodomésticos para estimativas de seguro (mercado americano).

**Pé-direito:** Automático pelo LiDAR (solicita que usuário aponte para o teto). Teto inclinado: long press para tirar média. Não mapeia tetos abobadados com precisão.

**Multi-pavimento:** "New Room" com nome do andar. Sem alinhamento automático. Exporta point cloud unificado via IFC.

**Elevação:** Não existe nativa. FLYPLAN® 3D. Via IFC exportado no Autodesk Viewer é possível gerar seções/elevações.

**Export DXF:** Disponível. Compatível com CAD. Estrutura de camadas não documentada. Profissional HVAC confirmou uso no AutoCAD. Outros: IFC (semântico), PDF vetorial, PNG, PLY/OBJ/XYZ (point cloud), USDZ (AR), Xactimate/Symbility (seguros).

**Reclamações reais:**
- Crashes em espaços grandes — reduzir qualidade 3D resolve (App Store)
- Paredes de vidro do chão ao teto = sem leitura (MAVRiC Research)
- Movimento de pessoas durante scan invalida resultado (MAVRiC Research)
- Perda de detalhes (recortes, saliências) no resultado final — exige resscan
- Geometrias não-convencionais: paredes inclinadas, pedra irregular, paredes curvas não suportadas
- Sem biblioteca de instalações técnicas
- Custo: US$9,99/mês ou US$119,99/ano

**Fontes:** locometric.com/lidar-faq · locometric.com/instructions · locometric.com/roomscan-export-formats · App Store · mavricresearch.com/2021/02

---

## Floor Plan Creator (floorplancreator.net)

**Início:** Editor com grade. Formas predefinidas (square, L, U, T) arrastáveis da toolbar. Também: ferramenta Walls para desenhar livremente. Sem wizard, sem assistente.

**Medição:** Forma predefinida: toca na borda → botão mostra comprimento atual → toca e digita valor. Ferramenta Walls: desenha linha à mão livre → converte em parede reta → seleciona e digita comprimento. Drag de pontos de controle para redimensionar visualmente. Suporte a laser Bluetooth: Bosch GLM, Leica Disto, Hilti PD-C, Stabila, Suaoki, CEM e outros — medida inserida automaticamente ao disparar.

**Fechamento:** Não automático. Formas predefinidas: já vêm fechadas. Ferramenta Walls: usuário conecta nós manualmente. Snap automático ajuda. Área calculada automaticamente quando polígono fecha.

**Cotas:** Não automáticas. "User defined dimension lines" — adicionadas manualmente da categoria Annotation. Rótulos com variáveis calculadas: `<area>`, `<perimeter>`, `<width>`, `<height>` — inseridos manualmente, preenchidos automaticamente.

**Portas/janelas:** Drag-and-drop da biblioteca para parede (snap automático). Sem cota automática de posição. Sem "cut wall" automático (não corta a parede como no MagicPlan).

**Elétrica:** Categoria "Electrical" existe. Tipos exatos não detalhados na documentação pública.

**Hidráulica:** Não documentado — provavelmente ausente como categoria específica.

**Altura do ponto:** Não existe campo para altura de instalação.

**Pé-direito:** Por pavimento. Override por parede individual. Sem campo por cômodo.

**Multi-pavimento:** Toolbar "Floors" → "Add". Pavimento novo começa em branco. Sem alinhamento automático. Vista 3D permite ver andares sobrepostos.

**Elevação:** Não existe. Apenas 3D livre.

**Export:** PNG/JPEG gratuito (com marca d'água na versão free). PDF, DXF (€4,49 compra única), SVG, .obj 3D (pagos). DXF camadas: não documentado. Problema: objetos distantes causam área de export enorme — usar "Find distant object" para limpar antes de exportar.

**Reclamações reais:**
- Cotas 100% manuais (confirmado pela FAQ)
- 1 projeto gratuito — projetos extras US$6,95
- Sem tutoriais em vídeo (Caroline on Design)
- Paredes curvas impossíveis
- Biblioteca considerada limitada (Capterra)
- Exportação gratuita tem marca d'água

**Fontes:** floorplancreator.net/help/faq · Caroline on Design · Capterra · androidsis.com
