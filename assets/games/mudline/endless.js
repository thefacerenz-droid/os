/* Stateless terrain keeps endless runs deterministic without growing save data. */
(function(root){
  function sample(index){
    if(index<9)return {height:480,material:'trail',level:null};
    const block=Math.floor((index-9)/36),phase=(index-9)%36;
    const hash=Math.abs(Math.sin((block+1)*127.1)*43758.5453)%1;
    if(phase<8)return {height:480-Math.sin(phase/8*Math.PI)**2*(20+hash*35),material:'trail',level:null};
    if(phase>30)return {height:480,material:'trail',level:null};
    const t=(phase-8)/22,depth=150+hash*105;
    return {height:480+Math.sin(t*Math.PI)**2*depth,material:block%4===3?'water':'mud',level:480};
  }
  function intake(position,angle,length,vehicleLength,sxs){
    const x=sxs?vehicleLength*.35:vehicleLength*.5-10,y=-length-9;
    return {x:position.x+x*Math.cos(angle)-y*Math.sin(angle),y:position.y+x*Math.sin(angle)+y*Math.cos(angle)};
  }
  const api={sample,intake};if(typeof module!=='undefined')module.exports=api;else root.MudEndless=api;
})(typeof window==='undefined'?globalThis:window);
