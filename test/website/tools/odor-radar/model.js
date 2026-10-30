(function(root){
  'use strict';
  const normalize = n => ((n % 360) + 360) % 360;
  const names = ['北','東北','東','東南','南','西南','西','西北'];
  function direction(degrees){return names[Math.round(normalize(degrees)/45)%8];}
  function analyze(sources, wind, radius){
    const valid = Number.isFinite(wind.from) && Number.isFinite(wind.speed) && wind.speed >= .5;
    return sources.map(s=>{const distance=Math.hypot(s.east,s.north),bearing=normalize(Math.atan2(s.east,s.north)*180/Math.PI),difference=Math.abs(((bearing-wind.from+540)%360)-180);
      return {...s,distance,bearing,difference,upwind:valid&&distance<=radius&&difference<=35};
    }).sort((a,b)=>Number(b.upwind)-Number(a.upwind)||a.distance-b.distance);
  }
  function sector(from,radius){
    const point = a => [300 + Math.sin(a*Math.PI/180)*radius,300-Math.cos(a*Math.PI/180)*radius];
    const a=point(from-35), b=point(from+35);
    return `M300 300 L${a.join(' ')} A${radius} ${radius} 0 0 1 ${b.join(' ')} Z`;
  }
  function validateImport(data){
    if(!data || data.format!=='shi-gai-odor-demo-v1'||!Array.isArray(data.records)||data.records.length>500) throw Error('請選擇本工具匯出的 JSON，最多 500 筆。');
    const ids=new Set();
    const records=data.records.map(r=>{
      if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(r.id)||ids.has(r.id)||typeof r.time!=='string'||!Number.isFinite(Date.parse(r.time))||typeof r.odor!=='boolean'||!Number.isInteger(r.intensity)||r.intensity<(r.odor?1:0)||r.intensity>(r.odor?5:0)||!['糞便','化學','腐臭','其他','無'].includes(r.type)||(!r.odor&&r.type!=='無')||typeof r.note!=='string'||r.note.length>200||r.simulated!==true||!r.wind||!Number.isFinite(r.wind.from)||r.wind.from<0||r.wind.from>=360||!Number.isFinite(r.wind.speed)||r.wind.speed<0||r.wind.speed>20||!Number.isInteger(r.aqi)||r.aqi<0||r.aqi>500) throw Error('紀錄格式不正確；未匯入任何資料。');
      ids.add(r.id);return {id:r.id,time:new Date(r.time).toISOString(),odor:r.odor,intensity:r.intensity,type:r.type,note:r.note,simulated:true,wind:{from:r.wind.from,speed:r.wind.speed},aqi:r.aqi};
    });
    return records;
  }
  const api={normalize,direction,analyze,sector,validateImport};
  if(typeof module==='object'&&module.exports)module.exports=api; else root.OdorModel=Object.freeze(api);
})(typeof globalThis==='object'?globalThis:this);
