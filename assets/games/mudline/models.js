/* Detailed, code-drawn cartoon rigs; no external image or audio requests. */
window.MudModels = (() => {
  const ink='#142a32';
  function path(c,p,fill,stroke=ink,w=2){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}}
  function line(c,p,color,w){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=w;c.lineJoin='round';c.lineCap='round';c.stroke();}
  function disc(c,x,y,r,color,stroke,w=2){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}}
  function shade(c,color,y1,y2){const g=c.createLinearGradient(0,y1,0,y2);g.addColorStop(0,'#ffffff');g.addColorStop(.18,color);g.addColorStop(.72,color);g.addColorStop(1,'#31444c');return g;}
  function stains(c,shape,amount,seed=0){if(amount<.01)return;c.save();c.beginPath();shape.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();for(let i=0;i<90*amount;i++){const x=Math.sin(i*173.3+seed)*105,y=Math.cos(i*92.1)*38-8;disc(c,x,y,1+(i%5)*.85,i%3?'#66503ce0':'#987555d9');if(i%6===0)line(c,[[x,y],[x-2,y+7]],'#66503c99',2);}c.restore();}
  function body(c,v,dirt=0){
    const a=v.length/2;
    const shell=[[-a-4,-13],[-a+3,-31],[-a+32,-34],[-22,-18],[21,-18],[a-29,-37],[a+8,-29],[a+13,-12],[a-10,0],[-a+14,0]];
    // Chassis, exposed engine, radiator and footboards.
    line(c,[[-a+17,2],[-a+31,22],[a-28,22],[a+1,-9]],v.frame,5);
    path(c,[[-35,-6],[25,-8],[34,11],[18,25],[-24,25],[-40,9]],'#293b43');
    disc(c,-2,9,16,'#65777a',ink,3);disc(c,-2,9,8,'#30444d','#95aaaa',2);
    for(let i=0;i<5;i++)line(c,[[20+i*3,-9],[23+i*3,6]],'#a4b7b4',1.5);
    line(c,[[-a+31,15],[-25,31],[30,31]],'#8b9c9b',5);
    for(let i=0;i<6;i++)line(c,[[-20+i*8,28],[-17+i*8,33]],'#1d323a',2);
    path(c,shell,shade(c,v.body,-38,6),ink,3);
    path(c,[[-a+7,-29],[-a+27,-30],[-29,-18],[-a+14,-16]],v.trim);
    path(c,[[31,-21],[a-26,-34],[a+4,-27],[a-4,-16]],v.trim);
    path(c,[[-a+13,-10],[-a+23,-25],[-a+42,-17],[-a+37,1]],'#253b43');
    path(c,[[a-40,-15],[a-20,-29],[a-2,-12],[a-15,1]],'#253b43');
    line(c,[[-a+7,-33],[-a+35,-35]],'#273e44',5);
    line(c,[[a-22,-38],[a+3,-35]],'#273e44',5);
    for(let i=0;i<4;i++)line(c,[[-a+10+i*7,-37],[-a+11+i*7,-31]],'#50636a',2);
    path(c,[[-29,-23],[-20,-35],[21,-35],[32,-25]],shade(c,v.trim,-38,-20),ink,3);
    line(c,[[-18,-32],[16,-32]],'#ffffff55',1);
    // Chromed bumper, skid plate and winch.
    line(c,[[a+4,-5],[a+19,-8],[a+19,-32],[a+8,-35]],'#172f38',7);
    line(c,[[a+4,-5],[a+18,-8],[a+18,-31]],'#839999',2);
    path(c,[[a-8,-20],[a+12,-20],[a+10,-12],[a-7,-12]],'#203741');
    line(c,[[a-4,-17],[a+8,-17]],'#eff8bf',4);
    disc(c,a+10,-3,5,'#1a2e37','#a4b6b4',1);line(c,[[a+10,1],[a+13,12],[a+10,15]],v.trim,3);
    if(!v.sxs){
      const h=v.id==='silverback'||v.id==='paddle'?75:62;
      line(c,[[a-22,-22],[a-28,-h],[a-15,-h-3]],v.frame,7);
      path(c,[[a-35,-31],[a-42,-h+5],[a-18,-h-6],[a-5,-36]],shade(c,v.frame,-h,-26));
      path(c,[[a-35,-h+8],[a-21,-h+1],[a-13,-41],[a-28,-37]],'#253d48');
      for(let i=0;i<5;i++)line(c,[[a-32+i*2,-h+9],[a-27+i*2,-42]],'#a9c4c4',1);
    }
    const pipeX=v.sxs?v.length*.35:a-10,pipeHeight=v.snorkelHeight||75;
    line(c,[[pipeX,-15],[pipeX,-pipeHeight-9]],'#172d35',8);
    line(c,[[pipeX-2,-20],[pipeX-2,-pipeHeight-7]],'#9cbbc0',2);
    path(c,[[pipeX-7,-pipeHeight-9],[pipeX-7,-pipeHeight-17],[pipeX+8,-pipeHeight-17],[pipeX+8,-pipeHeight-9]],v.trim);
    if(v.sxs){
      path(c,[[-a+12,-17],[-a+18,-89],[a-25,-89],[a-7,-15]],'#91cfd334',null);
      path(c,[[12,-21],[12,-49],[34,-52],[38,-17]],'#1c303b');
      line(c,[[25,-40],[36,-56],[49,-48]],'#dfb291',5);disc(c,36,-66,10,v.trim,ink);path(c,[[39,-70],[47,-68],[45,-61],[38,-62]],'#bfdeda',null);
      line(c,[[-a+7,-9],[-a+15,-91],[a-26,-91],[a-6,-10]],v.frame,7);
      line(c,[[-18,-88],[-16,-8]],v.frame,5);
      line(c,[[-a+10,-13],[-a+55,-86]],'#368989',3);
      path(c,[[-a+10,-10],[-a+18,-36],[-27,-33],[-23,-9]],shade(c,v.body,-38,0));
      path(c,[[-13,-9],[-10,-32],[a-19,-33],[a-10,-9]],shade(c,v.body,-38,0));
      line(c,[[-a+24,-25],[-a+43,-25]],'#20505a',3);line(c,[[10,-24],[29,-24]],'#20505a',3);
      path(c,[[-a+2,-90],[-a+9,-102],[a-17,-102],[a-10,-90]],'#213e48');
      path(c,[[-a+3,-103],[-a+16,-114],[a-9,-114],[a-20,-103]],'#e4e0cd');line(c,[[-a+21,-109],[a-26,-109]],v.body,4);
      for(let i=0;i<5;i++){disc(c,-a+26+i*21,-78,8,'#172f3b',v.rim,2);disc(c,-a+26+i*21,-78,4,'#417d89','#93e7db',1);}
      for(let i=0;i<7;i++)disc(c,-49+i*15,-95,2,'#f5ffd4');
    }else{
      if(v.backrest)line(c,[[-32,-29],[-40,-60],[-52,-60]],'#21363f',10);
      line(c,[[23,-35],[36,-54],[52,-54]],'#364d54',4);
      line(c,[[-1,-29],[6,-50],[17,-57]],'#314f60',14);line(c,[[8,-49],[29,-42],[39,-54]],'#dfad87',6);
      line(c,[[0,-28],[-19,-7],[6,11]],'#203847',9);line(c,[[4,11],[14,11]],'#101e28',6);
      disc(c,18,-68,13,shade(c,v.trim,-82,-56),ink,2);
      path(c,[[20,-75],[33,-71],[31,-63],[20,-64]],'#b7e3dd','#28434d',1);line(c,[[22,-74],[30,-71]],'#f4ffea',1.5);
    }
    line(c,[[-a+8,-26],[-a+22,-28]],'#ffffffa0',1.5);
    stains(c,shell,dirt,v.length);
    stains(c,[[-a+26,0],[a-19,0],[a-29,27],[-a+33,25]],dirt*.85,8);
    if(v.sxs)stains(c,[[-a+17,-33],[a-18,-33],[a-9,-6],[-a+10,-6]],dirt,2);
  }
  function wheel(c,x,y,r,angle,v,tire,dirt){c.save();c.translate(x,y);c.rotate(angle);
    const g=c.createRadialGradient(-r*.3,-r*.4,2,0,0,r);g.addColorStop(0,'#58676c');g.addColorStop(.68,'#26353d');g.addColorStop(1,'#111f28');disc(c,0,0,r,g,ink,2);
    const n=tire==='paddle'?9:tire==='mud'?12:20;
    for(let i=0;i<n;i++){c.save();c.rotate(i/n*Math.PI*2);path(c,[[-8,-r+8],[-9,-r-2],[-2,-r-7],[6,-r-4],[9,-r+5],[2,-r+10]],i%2?'#34444b':'#435359',ink,1.5);line(c,[[-6,-r+1],[-1,-r-3],[5,-r]],'#617177',1.4);if(dirt>.08)line(c,[[-5,-r+7],[3,-r+3]],`rgba(116,86,54,${dirt})`,4);c.restore();}
    disc(c,0,0,r*.69,'#152732',v.rim,3);disc(c,0,0,r*.59,v.disc?v.rim:'#253b45','#a0b8b7',1);
    for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);if(!v.disc){path(c,[[-3,-5],[-5,-r*.54],[0,-r*.6],[5,-10]],shade(c,v.rim,-r,0),ink,.6);line(c,[[0,-r*.53],[1,-12]],'#e6f7ec',1);}disc(c,0,-r*.63,1.4,'#ecf7ee');c.restore();}
    disc(c,0,0,r*.18,'#a5bec0',ink,2);disc(c,0,0,r*.08,'#354d58');
    for(let i=0;i<6;i++)disc(c,Math.cos(i*Math.PI/3)*r*.25,Math.sin(i*Math.PI/3)*r*.25,1.4,'#dceee6');
    if(dirt>0)for(let i=0;i<dirt*22;i++)disc(c,Math.sin(i*17)*r*.6,Math.cos(i*9)*r*.6,1+i%3,'#795d3bc9');
    c.restore();
  }
  return {body,wheel};
})();
