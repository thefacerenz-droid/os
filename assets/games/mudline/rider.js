/* Small, damped riding-pose offsets; hands, feet and seat stay planted. */
window.MudRider=(()=>{
  const rest=[{x:0,y:-27},{x:9,y:-51},{x:19,y:-72},{x:29,y:-42},{x:42,y:-52},{x:-17,y:-3},{x:10,y:15}];
  function create(){
    const clamp=(v,max)=>Math.max(-max,Math.min(max,v));
    let last=null,lean=0,bounce=0;
    return {points:()=>rest.map((p,i)=>{
      const weight=[0,.72,1,.35,0,.16,0][i];
      return {x:p.x+lean*weight,y:p.y+bounce*weight};
    }),step(s,dt=1/60){
      if(!Number.isFinite(dt)||dt<=0)return;
      const current={vx:Number.isFinite(s.vx)?s.vx:0,vy:Number.isFinite(s.vy)?s.vy:0,angle:Number.isFinite(s.angle)?s.angle:0};
      const elapsed=Math.min(.05,dt),frames=Math.max(.1,elapsed*60);
      const ax=last?(current.vx-last.vx)/frames:0,ay=last?(current.vy-last.vy)/frames:0;
      const pitch=last?Math.atan2(Math.sin(current.angle-last.angle),Math.cos(current.angle-last.angle))/frames:0;
      const blend=1-Math.exp(-10*elapsed);
      lean+=(clamp(-ax*.45-current.vx*.12+Math.sin(current.angle)*2-pitch*5,4.5)-lean)*blend;
      bounce+=(clamp(-ay*.4,2.5)-bounce)*blend;
      last=current;
    }};
  }
  function draw(c,points,v,dirt=0){
    const p=points||rest;
    const limb=(a,b,color,w)=>{c.beginPath();c.moveTo(p[a].x,p[a].y);c.lineTo(p[b].x,p[b].y);c.strokeStyle='#13262d';c.lineWidth=w+3;c.lineCap='round';c.stroke();c.strokeStyle=color;c.lineWidth=w;c.stroke();};
    c.save();if(v.sxs)c.translate(14,-3);
    limb(0,5,'#273e4d',10);limb(5,6,'#354e59',8);
    limb(0,1,v.trim,17);limb(1,3,'#526571',8);limb(3,4,'#b79a7d',6);
    c.strokeStyle='#132a33';c.lineWidth=7;c.beginPath();c.moveTo(p[6].x-3,p[6].y);c.lineTo(p[6].x+13,p[6].y+2);c.stroke();
    const h=p[2];c.save();c.translate(h.x,h.y);c.rotate(Math.atan2(p[1].y-h.y,p[1].x-h.x)-Math.PI/2);
    c.fillStyle=v.trim;c.strokeStyle='#13262d';c.lineWidth=2;c.beginPath();c.ellipse(0,0,13,14,0,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle='#172e39';c.fillRect(1,-6,14,8);c.strokeStyle='#b4e2df';c.lineWidth=2;c.beginPath();c.moveTo(3,-5);c.lineTo(12,-3);c.stroke();
    c.fillStyle=v.body;c.beginPath();c.moveTo(4,-12);c.lineTo(21,-8);c.lineTo(9,-6);c.fill();c.restore();
    if(dirt>.1){c.fillStyle=`rgba(105,77,46,${dirt*.85})`;for(let i=0;i<14*dirt;i++){const q=p[i%p.length];c.beginPath();c.arc(q.x+Math.sin(i*9)*6,q.y+Math.cos(i*7)*5,2+i%3,0,Math.PI*2);c.fill();}}
    c.restore();
  }
  return {create,draw};
})();
