(async function(){
  'use strict';
  const $=id=>document.getElementById(id), M=window.OdorModel;
  let sources=[], records=[], selected='', exported=false;
  const wind=()=>({from:Number($('windFrom').value),speed:Number($('windSpeed').value)});
  function validWind(){const w=wind();return Number.isFinite(w.speed)&&$('windSpeed').value!==''&&w.speed>=0&&w.speed<=20;}
  function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
  function render(){
    const w=wind(), valid=validWind(), calm=w.speed<.5;
    $('windLabel').textContent=`${M.direction(w.from)}風 · ${w.from}°`;
    $('windFrom').setAttribute('aria-valuetext',`${M.direction(w.from)}風，從${w.from}度吹來`);
    const candidates=M.analyze(sources,valid?w:{from:NaN,speed:0},Number($('radius').value));
    $('windSector').setAttribute('d',M.sector(w.from,Number($('radius').value)*50));
    $('windSector').style.display=valid&&!calm?'':'none';
    $('windArrow').setAttribute('transform',`rotate(${w.from} 300 300)`);
    $('windArrow').style.display=valid&&!calm?'':'none';
    const count=candidates.filter(s=>s.upwind).length, assessment=$('assessment');
    assessment.classList.toggle('caution',count>0||calm||!valid);
    const title=!valid?'請輸入有效風速':calm?'風太弱，暫不判斷方向':count?`${count} 個示範設施位於上風處`:'目前扇形內沒有示範設施';
    const description=!valid?'風速範圍為 0～20 m/s。':calm?'微風時方向不穩定，不能可靠地用扇形縮小範圍。':count?'如果真的聞到異味，可留意室外氣味並視需要關窗。這不是異味預報。':'沒有候選不代表沒有異味，也可能有未收錄的來源。';
    assessment.replaceChildren(element('strong',title),element('span',description));
    $('sourceMarkers').replaceChildren();$('sources').replaceChildren();
    for(const s of candidates){
      const x=300+s.east*50,y=300-s.north*50;
      const g=document.createElementNS('http://www.w3.org/2000/svg','g'),circle=document.createElementNS(g.namespaceURI,'circle'),text=document.createElementNS(g.namespaceURI,'text');
      circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','15');circle.setAttribute('class',`source-dot${s.upwind?' source-upwind':''}${selected===s.id?' source-selected':''}`);
      text.setAttribute('x',x);text.setAttribute('y',y+6);text.setAttribute('text-anchor','middle');text.setAttribute('class','source-label');text.textContent=s.id.toUpperCase();g.append(circle,text);$('sourceMarkers').append(g);
      const button=element('button',s.name,'source-button');button.type='button';button.dataset.upwind=String(s.upwind);button.setAttribute('aria-pressed',String(selected===s.id));button.dataset.source=s.id;
      button.append(element('span',`${s.distance.toFixed(1)} km · ${M.direction(s.bearing)}方${s.upwind?' · 上風處':''}`));
      button.onclick=()=>{const focus=s.id;selected=selected===s.id?'':s.id;render();document.querySelector(`[data-source="${focus}"]`).focus({preventScroll:true});};$('sources').append(button);
    }
    const aqi=Number($('aqiScenario').value);$('aqiNumber').textContent=aqi;$('aqiStatus').textContent=$('aqiScenario').selectedOptions[0].textContent.split(' · ')[1];
    $('aqiNumber').style.color=aqi<=50?'#3d6357':aqi<=100?'#846724':aqi<=150?'#a35725':'#a53c35';
  }
  const dateFormatter=new Intl.DateTimeFormat('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Taipei',hour12:false});
  function renderHistory(){
    $('recordCount').textContent=records.length;$('exportRecords').disabled=records.length===0;
    const yes=records.filter(r=>r.odor),no=records.length-yes.length;
    $('summary').textContent=records.length?`有異味 ${yes.length} 次／沒有異味 ${no} 次。這些是手動回報搭配模擬風況，尚不能推算真實風險機率。`:'先記錄一次，看看氣味筆記的樣子。';
    $('history').replaceChildren();
    if(!records.length){const row=element('tr'),cell=element('td','目前還沒有紀錄。');cell.colSpan=4;row.append(cell);$('history').append(row);return;}
    for(const r of [...records].sort((a,b)=>Date.parse(b.time)-Date.parse(a.time))){const row=element('tr');[dateFormatter.format(new Date(r.time))+'（台灣）',r.odor?`${r.type} · ${r.intensity}/5`:'沒有異味',`${M.direction(r.wind.from)}風 / ${r.wind.speed} m/s`,r.note||'—'].forEach(value=>row.append(element('td',value)));$('history').append(row);}
  }
  function record(odor){
    if(!validWind()){ $('recordMessage').textContent='請先輸入有效風速（0～20 m/s），再記錄。';$('windSpeed').focus();return; }
    if(records.length>=500){$('recordMessage').textContent='已達 500 筆上限，請先匯出紀錄；重新開啟本頁可開始新的紀錄。';return;}
    records.push({id:crypto.randomUUID(),time:new Date().toISOString(),odor,intensity:odor?Number($('intensity').value):0,type:odor?$('odorType').value:'無',note:$('note').value.trim(),simulated:true,wind:wind(),aqi:Number($('aqiScenario').value)});
    exported=false;$('note').value='';renderHistory();$('recordMessage').textContent='已加入本頁紀錄（附模擬風況）。離開前請匯出 JSON 保存。';
  }
  ['windFrom','windSpeed','radius','aqiScenario'].forEach(id=>$(id).addEventListener('input',render));
  document.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>{const [from,speed]=button.dataset.preset.split(',');$('windFrom').value=from;$('windSpeed').value=speed;render();});
  $('recordOdor').onclick=()=>record(true);$('recordClear').onclick=()=>record(false);
  $('exportRecords').onclick=()=>{
    const data={format:'shi-gai-odor-demo-v1',exportedAt:new Date().toISOString(),notice:'所有風況、AQI與設施皆為模擬，非真實監測或溯源證據。',records};
    const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=element('a');a.href=url;a.download=`odor-demo-${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);exported=true;$('recordMessage').textContent='已產生 JSON 下載，請確認檔案已保存；下次用「匯入 JSON」讀回。';
  };
  $('importRecords').onclick=()=>$('importFile').click();
  $('importFile').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    $('importRecords').disabled=true;
    try{
      if(file.size>1024*1024)throw Error('檔案過大，請使用 1 MB 以內的 JSON。');
      const incoming=M.validateImport(JSON.parse(await file.text()));
      const existing=new Set(records.map(r=>r.id)),additions=incoming.filter(r=>!existing.has(r.id));
      if(records.length+additions.length>500)throw Error('合併後超過 500 筆，未匯入任何資料。');
      records.push(...additions);if(additions.length)exported=false;renderHistory();$('recordMessage').textContent=`已合併 ${additions.length} 筆，略過 ${incoming.length-additions.length} 筆重複紀錄。`;
    }catch(error){$('recordMessage').textContent=error instanceof SyntaxError?'JSON 無法解析，未匯入任何資料。':error.message;}
    finally{event.target.value='';$('importRecords').disabled=false;}
  };
  addEventListener('beforeunload',event=>{if(records.length&&!exported){event.preventDefault();event.returnValue='';}});
  try{const response=await fetch('demo.json');if(!response.ok)throw Error('fixture');const data=await response.json();if(data.simulated!==true||!Array.isArray(data.sources))throw Error('fixture');sources=data.sources;render();renderHistory();}
  catch{ $('assessment').textContent='示範設施載入失敗，請重新整理。';$('recordOdor').disabled=true;$('recordClear').disabled=true; }
})();
