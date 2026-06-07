const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });

  const filePath = 'file:///' + path.resolve('elle-levantamento-tablet.html').replace(/\\/g, '/');
  await page.goto(filePath);
  await page.waitForTimeout(1500);

  await page.locator('#btn-novo').click();
  await page.waitForTimeout(800);
  const inp = page.locator('input[type="text"]').first();
  if (await inp.isVisible({ timeout: 1500 }).catch(() => false)) await inp.fill('Teste Final');
  await page.locator('button').filter({ hasText: /Criar|OK/ }).first().click().catch(() => page.keyboard.press('Enter'));
  await page.waitForTimeout(2000);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 10000 });

  const box = await page.locator('canvas').first().boundingBox();
  const cx  = box.x + (box.width - 240) * 0.42;
  const cy  = box.y + box.height * 0.45;
  console.log(`cx=${Math.round(cx)} cy=${Math.round(cy)}`);

  const confirmNumpad = async (v) => {
    const ok = page.locator('#np-ok');
    if (await ok.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Limpa e digita
      await page.keyboard.press('Control+a');
      await page.keyboard.type(v);
      await ok.click();
      await page.waitForTimeout(500);
    } else await page.keyboard.press('Escape');
  };

  const drawSingleWall = async (x1, y1, x2, y2, meters) => {
    await page.locator('[data-tool="wall"]').click(); await page.waitForTimeout(300);
    await page.mouse.click(x1, y1); await page.waitForTimeout(700);
    await page.mouse.click(x2, y2); await page.waitForTimeout(1200);
    await confirmNumpad(meters); // em METROS
    const btn = page.locator('#btn-wall-done');
    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) await btn.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  };

  // 3 paredes de 3m cada (separadas)
  await drawSingleWall(cx-130, cy-90, cx+130, cy-90, '3');
  await drawSingleWall(cx-130, cy,    cx+130, cy,    '3');
  await drawSingleWall(cx-130, cy+90, cx+130, cy+90, '3');

  await page.screenshot({ path: 'print_1_paredes.png' });
  console.log('Print 1: paredes de 3m desenhadas');

  // SELECT → seleciona parede do meio
  await page.locator('[data-tool="select"]').click(); await page.waitForTimeout(400);
  await page.mouse.click(cx, cy); await page.waitForTimeout(800);
  await page.screenshot({ path: 'print_2_sel.png' });
  console.log('Print 2: selecionada (ouro?)');

  // DRAG para cima
  await page.mouse.move(cx, cy);
  await page.mouse.down(); await page.waitForTimeout(200);
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(cx, cy - i * 3);
    await page.waitForTimeout(60);
  }
  await page.screenshot({ path: 'print_3_drag.png' });
  console.log('Print 3: DURANTE drag — overlay aparece?');

  await page.mouse.up(); await page.waitForTimeout(500);
  await page.screenshot({ path: 'print_4_fim.png' });
  console.log('Print 4: final');

  await browser.close();
  console.log('\nPrints em:', path.resolve('.'));
})();
