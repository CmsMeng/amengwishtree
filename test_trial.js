const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const results = [];

  await p.goto('file:///C:/Users/Administrator/wish-tree-pwa/dist/wish-tree.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  // 过欢迎页
  const w = await p.$('#state-welcome');
  if (w && !(await w.evaluate(el => el.classList.contains('hidden')))) {
    await p.click('#btn-welcome-start');
    await p.waitForTimeout(400);
  }

  // Test 1
  let ok = await p.isVisible('#btn-start-trial');
  results.push(['试用按钮可见', ok]);
  let txt = await p.textContent('#trial-badge');
  results.push(['显示3天试用', txt && txt.includes('3 天')]);

  // Test 2
  await p.click('#btn-start-trial');
  await p.waitForTimeout(1000);
  ok = !(await p.evaluate(() => document.getElementById('state-setup').classList.contains('hidden')));
  results.push(['点击试用→设置向导', ok]);

  // Complete setup
  await p.waitForSelector('#pw1', { timeout: 3000 });
  await p.fill('#pw1', '1234');
  await p.fill('#pw2', '1234');
  for (let i = 0; i < 7; i++) {
    await p.waitForSelector('#btn-next', { timeout: 3000 });
    // 第 6 步需要添加 2 个奖项
    if (i === 5) {
      let addBtn = await p.$('#btn-add-award');
      if (addBtn) { await addBtn.click(); await p.waitForTimeout(200); }
      addBtn = await p.$('#btn-add-award');
      if (addBtn) { await addBtn.click(); await p.waitForTimeout(200); }
      const inputs = await p.$$('.award-name');
      if (inputs.length >= 2) { await inputs[0].fill('奖品A'); await inputs[1].fill('奖品B'); }
    }
    await p.click('#btn-next');
    await p.waitForTimeout(400);
  }
  await p.waitForTimeout(1000);
  ok = !(await p.evaluate(() => document.getElementById('state-child').classList.contains('hidden')));
  results.push(['设置完成→主界面', ok]);

  // Test 3
  const badge = await p.$('.trial-top-badge');
  results.push(['主界面试用标识', !!badge]);

  // Test 4: Simulate expired
  await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('summer_wish_tree_data'));
    const past = new Date(); past.setDate(past.getDate() - 5);
    d.trialStartDate = past.toISOString().slice(0, 10);
    d.activated = false;
    localStorage.setItem('summer_wish_tree_data', JSON.stringify(d));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok = !(await p.evaluate(() => document.getElementById('trial-expired-msg').classList.contains('hidden')));
  results.push(['过期提示可见', ok]);
  ok = await p.evaluate(() => document.getElementById('btn-start-trial').classList.contains('hidden'));
  results.push(['过期后试用按钮隐藏', ok]);

  // Test 5: Activate after trial
  await p.evaluate(() => { document.getElementById('code-input').value = 'SUMMER-ZVJ6-Q566'; });
  await p.click('#btn-activate');
  await p.waitForTimeout(1200);
  const data = await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('summer_wish_tree_data'));
    return { activated: d.activated, subjects: d.subjects ? d.subjects.length : 0 };
  });
  results.push(['激活后 activated', data.activated === true]);
  results.push(['数据保留', data.subjects > 0]);

  let pass = 0;
  results.forEach(([name, ok]) => { console.log((ok ? '✅' : '❌') + ' ' + name); if (ok) pass++; });
  console.log('\n试用流程: ' + pass + '/' + results.length + ' 通过');
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})();
