const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const os=require('node:os');const path=require('node:path');
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage({viewport:{width:1180,height:820}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:3020/assets/games/mudline/index.html');
await page.keyboard.down('ArrowRight');await page.waitForTimeout(2100);await page.keyboard.up('ArrowRight');
const state=await page.evaluate(()=>({game:mudline.state(),audio:MudAudio.state()}));
assert.ok(state.game.dirt>0,'Mud dirt accumulates');assert.ok(state.game.particles>0,'Tires emit particles');assert.equal(state.audio.state,'running');assert.ok(state.audio.frequency>40);assert.ok(state.audio.gain>0);
await page.screenshot({path:path.join(os.tmpdir(),'mudline-dirty.png'),timeout:10000});
await page.locator('#sound').click();await page.waitForTimeout(600);assert.ok((await page.evaluate(()=>MudAudio.state())).gain<.001);
await page.locator('[data-panel="garage"]').click();await page.screenshot({path:path.join(os.tmpdir(),'mudline-detailed-garage.png'),timeout:10000});
await page.getByRole('button',{name:'Wash vehicle'}).click();assert.equal(await page.evaluate(()=>mudline.state().dirt),0);
await page.locator('#closePanel').click();await page.locator('#pause').click();await page.reload();assert.equal(await page.evaluate(()=>mudline.state().muted),true);
assert.deepEqual(errors,[]);console.log('Mud spray, dirt accumulation, wash, Web Audio activation, mute and saved sound preference passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
