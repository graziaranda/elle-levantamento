# Elle Levantamento — contexto para continuar

> **Para o Claude:** leia este arquivo inteiro antes de começar. Ele resume o projeto,
> o estado atual e as regras de trabalho. A dona é a **Elle (Grazielle Aranda)**,
> arquiteta — não programadora. Fale em português, de forma simples e prática.

## O que é
App de **levantamento arquitetônico em campo**, usado no **tablet**, **100% offline**.
HTML/CSS/JS puro (sem framework, sem build complexo). Os dados (projetos desenhados)
ficam no **localStorage do navegador do tablet** — não no código.

## Arquitetura
- `index.html` — entrada modular (modo dev no PC).
- `build.py` — junta CSS + JS num **único arquivo** `elle-levantamento-tablet.html`
  (é esse que vai pro tablet, por WhatsApp/Drive). **Sempre rode `python build.py`
  depois de editar** e mande o link do arquivo gerado pra Elle.
- `css/app.css` — todo o estilo (regra: CSS em arquivo dedicado, nada de inline “gambiarra”).
- `js/`:
  - `data.js` — storage, geometria, `normalizeProject()` (migra projetos antigos).
  - `canvas-editor.js` — editor principal (paredes, aberturas, cotas, ambientes…). É o maior.
  - `dashboard.js` — lista de projetos.
  - `dxf-writer.js` / `pdf-report.js` — exportações.
  - `photo-annotator.js` — anotar fotos.
  - `app.js` — router + **overlay de erro vermelho** (mostra erros na tela do tablet,
    já que lá não há console). Útil pra depurar: peça print da faixa vermelha.

## Convenções importantes (aprendidas na marra)
- **Tamanhos no canvas:** o contexto é escalado por `ctx.scale(zoom)`. Para um elemento
  ter **tamanho fixo na tela** use `valorPx / this.zoom` (ex.: fonte `14 / this.zoom` ≈ 14px).
  Já houve bug de coisas gigantes por usar `200 / this.zoom` (=200px). Mantenha textos ~13–16px.
- **Sem Node** na máquina da Elle; valide JS por contagem de chaves/heurística, não por `node`.
- **Não dá pra testar no navegador daqui** — a Elle testa no tablet e manda print.
  Por isso o overlay de erro é essencial.

## Como funciona hoje (interações principais)
- **Parede (guiada):** toca no canto inicial → arrasta a direção (trava 90°/45°) →
  solta → **teclado numérico** pede o comprimento em cm → parede exata, encadeia.
  Botões flutuantes **✓ Concluir** e **↶ Desfazer ponto**. Fecha o ambiente sozinho
  ao voltar perto do 1º ponto.
- **Porta/Janela:** toca na parede (ela acende) → formulário com **largura, distância
  do canto** (botão ⇄ inverter canto) **+ prévia ao vivo** na planta; porta tem
  dobradiça/abre-para, janela tem peitoril. O vínculo `wallId` viaja pro DXF.
- **Cota, Instalação, Foto, Nota, Ambiente, Fundo (imagem), Calibrar escala** existem.
- Navegação: 2 dedos movem/zoom; botões **+ / − / Centralizar** no canto.

## Estado / pendências (último ponto)
- Reescrita do “coração” (paredes + aberturas) feita. Recalibração de TODOS os tamanhos
  de texto/linha feita (estavam gigantes).
- **Aguardando feedback da Elle no tablet** sobre: (1) inserir porta com distância do
  canto + prévia resolveu o posicionamento; (2) o formulário grande pode estar cobrindo
  a planta no tablet em pé — se atrapalhar, virar um **painel lateral menor**.
- Ideias futuras já citadas: paredes curvas/anguladas com ângulo digitado (hoje só
  arraste+snap), e demais itens do levantamento depois do “coração”.

## Fluxo de trabalho com git
- **Ao começar:** `git pull`
- **REGRA (a Elle pediu isso): ao terminar CADA tarefa, faça automaticamente,
  sem ela pedir:** `git add -A && git commit -m "<resumo claro>" && git push`.
  Não espere ela mandar — só não suba código quebrado/pela metade.
- Repositório: https://github.com/graziaranda/elle-levantamento (privado)

## Regras da Elle
- **Qualidade > velocidade.** Fazer do jeito certo, não o mais rápido. Sem hack inline.
- Sempre que reconstruir o bundle, **mandar o link do arquivo** e **abrir a pasta** pra ela.
- Ela acompanha tudo por print do tablet — seja didático e peça prints quando precisar.
