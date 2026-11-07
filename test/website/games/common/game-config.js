(()=>{'use strict';const S=window.ShiGaiGameSettings;let entry=null,play=null,observer=null;const outputs=new WeakMap();
function resolveAssets(config){const data=S.clone(config);for(const[pointer]of S.mediaFields(entry.id,data)){if(pointer.startsWith('ui.'))continue;const value=S.get(data,pointer);if(value&&value.startsWith('assets/'))S.set(data,pointer,new URL('../../../'+value,document.baseURI).href);}return data;}
function decorate(){if(!play)return;for(const node of document.querySelectorAll('button,summary,[data-game-copy]')){if(node.closest('[data-site-header],.analytics-preferences-panel,.site-privacy-footer'))continue;const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode()){const current=text.nodeValue.trim(),replacement=play.ui.phrases[current];if(outputs.get(text)===text.nodeValue||replacement===undefined||replacement===current)continue;const leading=text.nodeValue.match(/^\s*/)[0],trailing=text.nodeValue.match(/\s*$/)[0];text.nodeValue=leading+replacement+trailing;outputs.set(text,text.nodeValue);}}
const templates=play.ui.messages||{};if(Object.values(templates).some(Boolean)){let state=null;for(const key of ['ShiGaiWheelDemo','ShiGaiMinesDemo','ShiGaiMemoryDemo','ShiGaiArcadeDemo','ShiGaiMagnifierDemo','ShiGaiArtGameDemo'])if(window[key]){state=window[key].state();break;}if(state){const values={level:state.level||state.number||1,score:state.round?.score??state.model?.score??state.opened??state.total??'',total:state.total??'',seconds:Math.floor(state.seconds??state.round?.elapsed??state.elapsed??0),value:state.result||'',name:document.getElementById('answerName')?.textContent||''},format=text=>text.replace(/\{(level|score|total|seconds|value|name)\}/g,(_,key)=>String(values[key]));const dialog=document.getElementById('resultDialog');if(dialog?.open){const title=document.getElementById('resultTitle'),result=document.getElementById('resultText'),status=state.status||state.round?.status,template=status==='lost'?templates.lossTitle:templates.winTitle;if(title&&template&&title.textContent!==format(template))title.textContent=format(template);if(result&&templates.resultText&&result.textContent!==format(templates.resultText))result.textContent=format(templates.resultText);}else{const status=state.status||state.round?.status,template=state.paused?templates.paused:status==='ready'?templates.ready:'';const node=document.getElementById('gameStatus')||document.getElementById('wheelStatus');if(node&&template&&node.textContent!==format(template))node.textContent=format(template);}}}
const instruction=document.getElementById('instructions')||document.getElementById('gameManagedInstructions');if(instruction&&play.ui.instructions&&instruction.textContent!==play.ui.instructions)instruction.textContent=play.ui.instructions;
}
function accentInk(hex){const luminance=value=>{const rgb=value.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]},light=luminance(hex),contrast=value=>{const ink=luminance(value);return (Math.max(light,ink)+.05)/(Math.min(light,ink)+.05)};return contrast('#34271f')>contrast('#fffdf5')?'#34271f':'#fffdf5';}
window.addEventListener('shigai:navigation-open',()=>{const state=window.ShiGaiMemoryDemo?.state()||window.ShiGaiArcadeDemo?.state()||window.ShiGaiMagnifierDemo?.state()||window.ShiGaiArtGameDemo?.state(),pause=document.getElementById('pause')||document.getElementById('pauseButton');if(state?.paused===false&&pause&&!pause.disabled)pause.click();});
function apply(){if(!entry)return;for(const id of ['gameTitle','wheelTitle'])if(document.getElementById(id))document.getElementById(id).textContent=entry.name;for(const id of ['gameDescription','wheelDescription'])if(document.getElementById(id))document.getElementById(id).textContent=entry.description;document.title=entry.name+' · Shi-Gai';if(!play)return;document.body.classList.add('game-managed');const t=play.ui.theme,r=document.documentElement.style;r.setProperty('--game-accentInk',accentInk(t.accent));for(const k of ['background','paper','ink','accent'])r.setProperty('--game-'+k,t[k]);for(const k of ['fontSize','titleSize','mobileTitleSize','buttonRadius','contentWidth'])r.setProperty('--game-'+k,t[k]+'px');r.setProperty('--game-font',({sans:'"PingFang TC","Microsoft JhengHei",system-ui,sans-serif',serif:'"Songti TC","PMingLiU",serif',rounded:'"Arial Rounded MT Bold","PingFang TC",sans-serif',mono:'ui-monospace,Consolas,monospace'})[t.fontFamily]);for(const k of ['backgroundImage','panelImage','buttonImage'])r.setProperty('--game-'+k,play.ui[k]?'url("'+new URL('../../../'+play.ui[k],document.baseURI).href+'")':'none');for(const n of document.querySelectorAll('[data-game-rounds]'))n.textContent=n.dataset.gameRounds.replaceAll('{rounds}',String(play.config.rounds||play.config.levels?.length||''));decorate();if(!observer){observer=new MutationObserver(decorate);observer.observe(document.body,{subtree:true,childList:true,characterData:true});}}
async function load(id,fallback){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);let list;try{const response=await fetch('../../../database/website/games.json',{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error('遊戲清單無法讀取');list=await response.json();}finally{clearTimeout(timer);}entry=Array.isArray(list)?list.find(game=>game.id===id):null;if(entry?.play){play=S.normalize(id,entry.play);apply();return{...resolveAssets(play.config),title:entry.name,description:entry.description};}
const response=await fetch(fallback,{cache:'no-cache'});if(!response.ok)throw Error('遊戲設定無法讀取');const config=await response.json();apply();return config;}
window.ShiGaiGameConfig=Object.freeze({load,entry:()=>entry?S.clone(entry):null,apply});})();

(() => {
  'use strict';
  const room = document.querySelector('.memory-room,.mine-room,.arcade-room,.wheel-room');
  if (!room) return;
  const header = room.querySelector(':scope > header');
  const aside = room.querySelector('aside.settings,aside.wheel-settings');
  if (!header || !aside) return;
  document.body.classList.add('game-compact');
  const title = header.querySelector('h1');
  const description = header.querySelector('#gameDescription,#wheelDescription');
  const back = room.querySelector(':scope > .back-link');
  const wheel = room.classList.contains('wheel-room');
  const toolbar = room.querySelector('.toolbar');
  function button(label, text) {
    const node = document.createElement('button');
    node.type = 'button'; node.textContent = text; node.setAttribute('aria-label', label);
    return node;
  }
  function modal(id, label) {
    const dialog = document.createElement('dialog');
    dialog.id = id; dialog.className = 'game-info-dialog';
    dialog.setAttribute('aria-labelledby', id + 'Title');
    const bar = document.createElement('div'); bar.className = 'game-info-heading';
    const heading = document.createElement('h2'); heading.id = id + 'Title'; heading.textContent = label;
    const close = button('關閉' + label, '×'); close.className = 'game-info-close';
    close.addEventListener('click', () => dialog.close());
    const content = document.createElement('div'); content.className = 'game-info-content';
    bar.append(heading, close); dialog.append(bar, content); document.body.append(dialog);
    dialog.addEventListener('keydown', e => { e.stopPropagation(); if(e.key === 'Escape') { e.preventDefault(); dialog.close(); } });
    dialog.addEventListener('click', e => { if (e.target !== dialog) return; const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); });
    return { dialog, content };
  }
  const help = modal('gameHelp', '玩法說明');
  const options = modal('gameOptions', wheel ? '轉盤選項' : '關卡與設定');
  const helpButton = button('查看玩法說明', '?'); helpButton.id = 'gameHelpButton';
  const optionsButton = button(wheel ? '編輯轉盤選項' : '開啟關卡與設定', wheel ? '選項' : toolbar?.querySelector('select') ? '關卡' : '設定'); optionsButton.id = 'gameOptionsButton';
  function open(target) {
    window.dispatchEvent(new Event('shigai:navigation-open'));
    if (!target.open) target.showModal();
  }
  helpButton.addEventListener('click', () => open(help.dialog));
  optionsButton.addEventListener('click', () => open(options.dialog));
  if (description) help.content.append(description);
  for (const node of [...header.querySelectorAll('.eyebrow')]) node.remove();
  if (back) { back.setAttribute('aria-label', back.textContent.trim()); back.textContent = '←'; header.prepend(back); }
  header.append(helpButton, optionsButton);
  if (title) title.title = title.textContent;
  if (wheel) {
    options.content.append(aside);
    for (const node of room.querySelectorAll('.pointer-hint,.gesture-hint')) help.content.append(node);
  } else {
    help.content.append(aside);
    const controls = document.createElement('div'); controls.className = 'game-option-controls';
    for (const node of [...(toolbar?.children || [])]) {
      if (node.matches('label') || ['restart','restartButton','nextLevel','nextButton'].includes(node.id)) controls.append(node);
    }
    const size = room.querySelector('.size-label'); if (size) controls.append(size);
    options.content.append(controls);
    if (!controls.children.length) optionsButton.hidden = true;
    for (const node of room.querySelectorAll('.target,.board-hint,#puzzleSourceNote')) help.content.append(node);
  }
  window.dispatchEvent(new Event('shigai:game-options-ready'));
  // Nodes are moved, not cloned: existing IDs, uploads, state and Studio copy continue to work.
  const area = room.querySelector('.play-area,.wheel-play');
  const stage = room.querySelector('.board-wrap,.board-viewport,.stage-wrap,#questionArea,.wheel-stage');
  let pending = false;
  function fit() {
    pending = false; if (!stage || !area) return;
    const controls = room.querySelector('#gameControls,.play-controls');
    const tail = wheel ? (controls?.getBoundingClientRect().height || 90) + 64 : (controls?.getBoundingClientRect().height || 0) + (controls?.children.length ? 18 : 0) + 18;
    const height = Math.max(200, Math.floor((window.visualViewport?.height || innerHeight) - (stage.getBoundingClientRect().top + scrollY) - tail - 32));
    const value = height + 'px'; if (room.style.getPropertyValue('--play-height') !== value) room.style.setProperty('--play-height', value);
    const board = room.querySelector('.board-wrap .board,.sokoban-board');
    if (board) {
      const style = getComputedStyle(board), cols = board.classList.contains('sokoban-board') ? Number(style.getPropertyValue('--cols')) : Number(style.getPropertyValue(innerWidth <= 800 ? '--mobile-columns' : '--columns')) || 4;
      const rows = Math.max(1, Math.ceil(board.children.length / cols));
      const width = board.classList.contains('sokoban-board') ? Math.max(cols * 32, height * cols / rows) : Math.max(cols * 48, (height - (rows - 1) * 6) / rows * .75 * cols + (cols - 1) * 6);
      board.style.maxWidth = Math.floor(Math.min(area.clientWidth, width)) + 'px';
    }
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(fit); } }
  if (window.ResizeObserver) { const observer = new ResizeObserver(schedule); observer.observe(header); if (area) observer.observe(area); }
  if (stage) new MutationObserver(schedule).observe(stage, {childList:true,subtree:true});
  window.addEventListener('resize', schedule); window.visualViewport?.addEventListener('resize', schedule);
  schedule();
})();
