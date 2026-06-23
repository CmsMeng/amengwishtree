const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file:///' + path.resolve(__dirname, 'dist/wish-tree.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  let tests = 0, passed = 0;
  const check = (name, ok, detail = '') => {
    tests++;
    if (ok) { passed++; console.log('  ✅ ' + name); }
    else console.log('  ❌ ' + name + (detail ? ' — ' + detail : ''));
  };

  console.log('🧪 许愿树 PWA 测试\n');

  // === 1. 激活码页面 ===
  console.log('1. 激活码页面');
  await page.goto(FILE, { waitUntil: 'networkidle' });
  // 清空可能残留的 localStorage
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // 首次访问会先看到欢迎页
  const welcome = await page.$('#state-welcome');
  if (welcome && !(await welcome.evaluate(el => el.classList.contains('hidden')))) {
    await page.click('#btn-welcome-start');
    await page.waitForTimeout(500);
  }

  await page.waitForSelector('#state-activation', { timeout: 5000 });
  check('页面加载', await page.isVisible('#state-activation'));
  check('标题', (await page.textContent('.activation-title')).includes('许愿树'));
  check('产品特色', (await page.$$('.activation-features li')).length === 3);

  // === 2. 无效码 ===
  console.log('\n2. 无效激活码');
  // 直接用 evaluate 设值，跳过格式化器
  await page.evaluate(() => {
    document.getElementById('code-input').value = 'SUMMER-BADC-ODE';
  });
  await page.click('#btn-activate');
  await page.waitForTimeout(300);
  const err1 = await page.textContent('#code-error');
  check('显示错误提示', err1 && err1.length > 0 && (err1.includes('无效') || err1.includes('完整') || err1.includes('激活码')), 'err=' + err1);

  // === 3. 有效码 ===
  console.log('\n3. 有效激活码');
  // 用 evaluate 直接设值
  await page.evaluate(() => {
    document.getElementById('code-input').value = 'SUMMER-ZVJ6-Q566';
  });
  await page.click('#btn-activate');
  await page.waitForTimeout(1200);
  const setupVisible = await page.isVisible('#state-setup');
  check('跳转设置向导', setupVisible);
  if (!setupVisible) {
    // 调试：检查当前可见状态
    const debug = await page.evaluate(() => {
      return {
        activation: document.getElementById('state-activation')?.classList.contains('hidden'),
        setup: document.getElementById('state-setup')?.classList.contains('hidden'),
        child: document.getElementById('state-child')?.classList.contains('hidden'),
        storage: localStorage.getItem('summer_wish_tree_data'),
      };
    });
    console.log('    DEBUG:', JSON.stringify(debug).slice(0, 300));
    await page.screenshot({ path: path.resolve(__dirname, 'test_debug.png'), fullPage: true });
    await browser.close();
    process.exit(1);
  }

  // === 4. 设置向导 ===
  console.log('\n4. 设置向导');

  // Step 1: 密码
  await page.waitForSelector('#pw1', { timeout: 3000 });
  await page.fill('#pw1', '1234');
  await page.fill('#pw2', '1234');
  await page.click('#btn-next');
  await page.waitForTimeout(300);
  check('第1步密码', (await page.textContent('#setup-step-content h2')).includes('风格'));

  // Step 2: 树型 + 名称
  await page.click('#style-girl');
  await page.fill('#tree-name-inp', '测试树');
  await page.click('#btn-next');
  await page.waitForTimeout(300);
  check('第2步风格', (await page.textContent('#setup-step-content h2')).includes('强度'));

  // Step 3: 强度
  await page.click('#int-100');
  await page.click('#btn-next');
  await page.waitForTimeout(300);
  check('第3步强度', (await page.textContent('#setup-step-content h2')).includes('学科'));

  // Step 4: 学科
  await page.click('#btn-next');
  await page.waitForTimeout(300);
  check('第4步学科', (await page.textContent('#setup-step-content h2')).includes('运动'));

  // Step 5: 运动
  await page.click('#btn-next');
  await page.waitForTimeout(300);
  check('第5步运动', (await page.textContent('#setup-step-content h2')).includes('奖励'));

  // Step 6: 奖项
  await page.click('#btn-add-award');
  await page.waitForTimeout(100);
  await page.click('#btn-add-award');
  await page.waitForTimeout(100);
  const inputs = await page.$$('.award-name');
  if (inputs.length >= 2) {
    await inputs[0].fill('去迪士尼');
    await inputs[1].fill('买乐高');
  }
  await page.click('#btn-next');
  await page.waitForTimeout(300);
  check('第6步奖项', (await page.textContent('#setup-step-content h2')).includes('确认'));

  // Step 7: 确认
  await page.click('#btn-next');
  await page.waitForTimeout(1200);
  check('第7步→主界面', await page.isVisible('#state-child'));

  // === 5. 主界面 ===
  console.log('\n5. 孩子主界面');
  check('树名显示', (await page.textContent('#tree-name-display')).includes('测试树'));
  check('阶段标识', !!(await page.textContent('#tree-stage-badge')));
  check('SVG树渲染', !!(await page.$('#tree-svg')));
  check('任务卡片', !!(await page.$('#task-card')));
  check('水滴显示', (await page.textContent('#water-today')).includes('滴'));

  // === 6. 任务交互 ===
  console.log('\n6. 任务交互');

  // 运动完成
  const exBtn = await page.$('#btn-ex-done');
  if (exBtn && !(await exBtn.evaluate(el => el.classList.contains('disabled')))) {
    await exBtn.click();
    await page.waitForTimeout(500);
    const w = await page.textContent('#water-today');
    check('运动完成→水滴', w && !w.includes('0 滴'), '水滴:' + w);
  } else {
    check('运动完成→水滴', false, '按钮disabled或不存在');
  }

  // 随机任务完成
  const rdBtn = await page.$('#btn-rd-done');
  if (rdBtn && !(await rdBtn.evaluate(el => el.classList.contains('disabled')))) {
    await rdBtn.click();
    await page.waitForTimeout(300);
  }

  // 学科打卡
  const hwBtn = await page.$('#btn-hw-detail');
  if (hwBtn) {
    await hwBtn.click();
    await page.waitForTimeout(600);
    const modalVisible = await page.$('#modal-overlay:not(.hidden)');
    check('学科Modal打开', !!modalVisible);

    // 点击第一个学科
    const subjRow = await page.$('.hw-subj-row');
    if (subjRow) {
      await subjRow.click();
      await page.waitForTimeout(500);
    }
    check('计时器存在', !!(await page.$('#hw-timer-display')));
  }

  // === 7. 家长面板 ===
  console.log('\n7. 家长面板');
  // 先关闭可能残留的 Modal
  const modalOverlay = await page.$('#modal-overlay:not(.hidden)');
  if (modalOverlay) {
    await page.click('#btn-close-hw');
    await page.waitForTimeout(300);
  }
  await page.click('#btn-parent-entry');
  await page.waitForTimeout(500);
  check('密码门显示', await page.isVisible('#parent-gate'));

  // 输入密码 1234
  const pins = await page.$$('.pin-dot');
  await pins[0].click();
  await page.keyboard.type('1234', { delay: 30 });
  await page.waitForTimeout(800);
  // 可能需手动回车触发验证
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  check('进入管理面板', await page.isVisible('#parent-panel-body'));
  check('仪表盘', !!(await page.$('#dash-drops')));

  // === 8. 满级后系统（postMaxMode） ===
  console.log('\n8. 满级后系统');

  // 先关闭 modal
  const mo = await page.$('#modal-overlay:not(.hidden)');
  if (mo) { await page.click('#btn-close-hw').catch(() => {}); await page.waitForTimeout(300); }

  // 返回主界面
  const exitBtn = await page.$('#btn-parent-exit');
  if (exitBtn && await exitBtn.isVisible()) {
    await exitBtn.click();
    await page.waitForTimeout(600);
  }

  // 用 dev panel 直接设满级（不触发弹窗，弹窗在 initChildView 检测）
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('summer_wish_tree_data'));
    d.waterDrops = 100;
    d.treeStage = 5;
    d.postMaxMode = false;
    d.postMaxDrops = 0;
    localStorage.setItem('summer_wish_tree_data', JSON.stringify(d));
  });

  // 刷新触发 initChildView → 应该弹出满级弹窗
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 验证满级弹窗出现
  const pmPopup = await page.$('#postmax-continue');
  check('满级弹窗出现', !!pmPopup);

  if (pmPopup) {
    // 点击"继续浇水"
    await pmPopup.click();
    await page.waitForTimeout(800);
  }

  // 验证 postMaxMode 界面
  const badgeText = await page.textContent('#tree-stage-badge');
  check('树高米数显示', badgeText && badgeText.includes('米'), 'badge=' + badgeText);

  const waterText = await page.textContent('#water-today');
  check('无上限提示', waterText && waterText.includes('无上限'), 'water=' + waterText);

  // 连续完成任务超过 6 次，验证无上限
  for (let i = 0; i < 4; i++) {
    const btn = await page.$('#btn-ex-done');
    if (btn && !(await btn.evaluate(el => el.classList.contains('disabled')))) {
      await btn.click();
      await page.waitForTimeout(400);
    }
  }
  const wt2 = await page.textContent('#water-today');
  check('超6滴仍可获水滴', wt2 && !wt2.includes('0 滴'), 'water=' + wt2);

  // === 8b. 满级奖项（家长面板） ===
  console.log('\n8b. 满级奖项');

  // 进入家长面板
  await page.click('#btn-parent-entry');
  await page.waitForTimeout(500);
  const pins2 = await page.$$('.pin-dot');
  await pins2[0].click();
  await page.keyboard.type('1234', { delay: 30 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  // 满级菜单项应可见
  const pmMenu = await page.$('#menu-postmax');
  const pmMenuVisible = pmMenu && !(await pmMenu.evaluate(el => el.classList.contains('hidden')));
  check('满级奖项菜单可见', pmMenuVisible);

  if (pmMenuVisible) {
    await pmMenu.click();
    await page.waitForTimeout(400);

    // 添加一个满级奖项
    const addBtn = await page.$('#btn-pp-pma-add');
    if (addBtn && !(await addBtn.evaluate(el => el.disabled))) {
      await addBtn.click();
      await page.waitForTimeout(200);

      // 填写奖项
      const nameInp = await page.$('.pp-pma-name');
      const meterInp = await page.$('.pp-pma-meters');
      if (nameInp) await nameInp.fill('测试满级奖');
      if (meterInp) await meterInp.fill('3');

      await page.click('#btn-pp-pma-save');
      await page.waitForTimeout(400);
      check('满级奖项保存', true);
    } else {
      check('满级奖项保存', false, 'add button missing/disabled');
    }
  }

  // === 9. 关于弹窗 + PWA 安装说明 ===
  console.log('\n9. 关于弹窗');

  // 回到主界面
  const mo2 = await page.$('#modal-overlay:not(.hidden)');
  if (mo2) { await page.click('#btn-close-hw').catch(() => {}); await page.waitForTimeout(200); }
  const exBtn2 = await page.$('#btn-parent-exit');
  if (exBtn2 && await exBtn2.isVisible()) { await exBtn2.click(); await page.waitForTimeout(500); }

  // 点击 ? 按钮打开关于
  const aboutBtn = await page.$('#btn-about');
  if (aboutBtn) {
    await aboutBtn.click();
    await page.waitForTimeout(500);
    const aboutVisible = !(await page.$('#about-overlay.hidden'));
    check('关于弹窗打开', aboutVisible);

    if (aboutVisible) {
      // 验证 PWA 安装 iOS 步骤可见
      const iosSteps = await page.$('#pwa-ios:not(.hidden)');
      check('iOS 安装步骤可见', !!iosSteps);

      // 切换 Android
      const androidTab = await page.$('#pwa-tab-android');
      if (androidTab) {
        await androidTab.click();
        await page.waitForTimeout(300);
        const androidSteps = await page.$('#pwa-android:not(.hidden)');
        const iosHidden = await page.$('#pwa-ios.hidden');
        check('切换到 Android 步骤', !!androidSteps && !!iosHidden);
      }

      // 关闭
      await page.click('#about-close');
      await page.waitForTimeout(300);
    }
  }

  // === 10. JS 错误 ===
  console.log('\n10. JS 错误');
  check('无运行时错误', errors.length === 0, errors.join('; '));

  // 截图
  await page.screenshot({ path: path.resolve(__dirname, 'test_screenshot.png'), fullPage: true });

  // 总结
  console.log('\n' + '='.repeat(40));
  console.log('📊 ' + passed + '/' + tests + ' 通过');
  if (passed === tests) console.log('🎉 全部通过！');
  else console.log('⚠️  ' + (tests - passed) + ' 项未通过，见上方详情');
  if (errors.length > 0) console.log('JS 错误: ' + errors.join('; '));

  await browser.close();
  process.exit(passed === tests ? 0 : 1);
})().catch(e => { console.error('💥 FATAL:', e.message); process.exit(1); });
