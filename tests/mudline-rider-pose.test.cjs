const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/games/mudline/rider.js'),'utf8'),context);
const create=context.window.MudRider.create;
test('subtle rider motion keeps contact points fixed even in extreme crashes',()=>{
  const rider=create(),rest=rider.points();let movement=0;
  for(let i=0;i<1200;i++){
    rider.step({vx:Math.sin(i)*200,vy:Math.cos(i)*100,angle:i*.3});
    rider.points().forEach((p,n)=>{
      const distance=Math.hypot(p.x-rest[n].x,p.y-rest[n].y);assert.ok(distance<=5.2);
      if([0,4,6].includes(n))assert.equal(distance,0);
      movement=Math.max(movement,distance);
    });
  }
  assert.ok(movement>.1);
  for(let i=0;i<180;i++)rider.step({vx:0,vy:0,angle:0});
  rider.points().forEach((p,i)=>assert.ok(Math.hypot(p.x-rest[i].x,p.y-rest[i].y)<.001));
});
