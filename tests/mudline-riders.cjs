const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');const os=require('node:os');
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage({viewport:{width:1180,height:820},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3020/assets/games/mudline/index.html');
  let peak=0,mud=0;await page.keyboard.down('ArrowRight');
  for(let i=0;i<24;i++){await page.waitForTimeout(100);const s=await page.evaluate(()=>mudline.state());peak=Math.max(peak,s.particles);mud=Math.max(mud,s.dirt);}
  await page.keyboard.up('ArrowRight');assert.ok(peak>320,`Heavy spray: ${peak}`);assert.ok(mud>.4,`Heavy dirt: ${mud}`);
  await page.screenshot({path:path.join(os.tmpdir(),'mudline-heavy-mud.png')});console.log('Heavy spray and dirt',peak,mud);
  for(const id of ['volt-mx','flux-trail','tundra']){
    await page.locator('[data-panel="garage"]').click();await page.locator(`[data-vehicle="${id}"]`).click();assert.equal(await page.locator('[data-tune="snorkel"]').isVisible(),false);await page.locator('#applyTune').click();await page.locator('#reset').click();
    const initial=await page.evaluate(()=>mudline.state());let movement=0;
    await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');
    for(let i=0;i<12;i++){await page.waitForTimeout(100);const s=await page.evaluate(()=>mudline.state());assert.ok(s.rider.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.hypot(p.x,p.y)<156));movement=Math.max(movement,Math.hypot(s.rider[2].x-initial.rider[2].x,s.rider[2].y-initial.rider[2].y));}
    await page.keyboard.up('ArrowRight');await page.keyboard.up('Space');const result=await page.evaluate(()=>mudline.state());assert.ok(result.x>initial.x+40,`${id} drives`);assert.ok(movement>1,`${id} rider articulates`);
    await page.locator('#pause').click();await page.screenshot({path:path.join(os.tmpdir(),`mudline-${id}.png`)});await page.locator('#pause').click();console.log(id,'driven',Math.round(result.x-initial.x),'rider displacement',movement.toFixed(1));
  }
  await page.locator('[data-panel="garage"]').click();assert.equal(await page.locator('[data-vehicle]').count(),11);await page.screenshot({path:path.join(os.tmpdir(),'mudline-eleven-builds.png')});await page.locator('[data-vehicle="highwater"]').click();await page.locator('#applyTune').click();
  await page.locator('[data-panel="maps"]').click();await page.locator('[data-map="pond"]').click();await page.setViewportSize({width:820,height:1180});
  peak=0;await page.keyboard.down('ArrowRight');for(let i=0;i<30;i++){await page.waitForTimeout(100);peak=Math.max(peak,(await page.evaluate(()=>mudline.state())).particles);}await page.keyboard.up('ArrowRight');assert.ok(peak>320);assert.ok(peak<=1100);await page.screenshot({path:path.join(os.tmpdir(),'mudline-water-tablet.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),820);assert.deepEqual(errors,[]);console.log('Eleven builds, water spray, tablet layout and no browser errors passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
