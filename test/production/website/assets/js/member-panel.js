(()=>{'use strict';const M=window.ShiGaiMembers,host=document.createElement('section');host.className='member-panel';
// Shared panel remains on the current game page, so Email OTP can save its pending practice result.
host.innerHTML=`<details><summary>會員與排行榜</summary><p>訪客可直接遊玩。練習紀錄不列入正式排行。登入只保留於本頁，離開或重新整理需再登入。</p>
<p class="member-status" role="status" aria-live="polite"></p>
<div data-guest><button type="button" data-google>Google 登入</button><form data-email><label>Email <input name="email" type="email" required autocomplete="email"></label><button>寄送驗證碼</button></form><form data-otp hidden><label>驗證碼 <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" required></label><button>登入</button></form></div>
<div data-account hidden><form data-profile><label>公開暱稱 <input name="nickname" minlength="2" maxlength="24" required></label><label><input type="checkbox" name="visible"> 願意在正式排行榜公開暱稱</label><button>儲存暱稱</button></form><button type="button" data-save>保存本次練習紀錄</button><button type="button" data-history>查看我的練習紀錄</button><button type="button" data-logout>登出</button><ul data-history-list></ul></div>
<form data-board><label>遊戲 <select name="game"></select></label><label>關卡編號 <input name="level" value="1" required maxlength="80"></label><button>查看正式排行榜</button></form><ol data-board-list></ol></details>`;
(document.querySelector('[data-members]')||document.querySelector('main')||document.body).append(host);
// Keep account controls inside the existing game settings dialog.
function placeInGameOptions(){const content=document.querySelector('#gameOptions .game-info-content');if(!document.body.hasAttribute('data-standalone-game')||!content)return;content.append(host);const button=document.getElementById('gameOptionsButton');if(button)button.hidden=false;}
placeInGameOptions();window.addEventListener('shigai:game-options-ready',placeInGameOptions,{once:true});
host.querySelector('details').addEventListener('toggle',()=>{if(host.querySelector('details').open)window.dispatchEvent(new Event('shigai:navigation-open'));});
const $=s=>host.querySelector(s),status=message=>$('.member-status').textContent=message;let email='',busy=false;
async function action(fn){if(busy)return;busy=true;host.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){status(e.message);}finally{busy=false;host.querySelectorAll('button').forEach(b=>b.disabled=!M.configured());}}
async function account(){const signed=M.isSignedIn();$('[data-guest]').hidden=signed;$('[data-account]').hidden=!signed;if(signed){const [p]=await M.profile();if(p){$('[name=nickname]').value=p.nickname;$('[name=visible]').checked=p.leaderboard_visible;}}}
M.onChange(()=>{account().catch(e=>status(e.message));if(!M.isSignedIn())$('[data-history-list]').replaceChildren();});
$('[data-google]').onclick=()=>action(()=>M.google());
$('[data-email]').onsubmit=e=>{e.preventDefault();action(async()=>{email=new FormData(e.target).get('email').trim();await M.sendOtp(email);$('[data-otp]').hidden=false;status('若信箱可接收登入信，驗證碼將寄出；請稍候。');});};
$('[data-otp]').onsubmit=e=>{e.preventDefault();action(async()=>{await M.verifyOtp(email,new FormData(e.target).get('code').trim());e.target.reset();status('已登入。');});};
$('[data-profile]').onsubmit=e=>{e.preventDefault();action(async()=>{await M.updateProfile($('[name=nickname]').value.trim(),$('[name=visible]').checked);status('暱稱已儲存。請勿使用真名或聯絡資訊。');});};
$('[data-save]').onclick=()=>action(async()=>{await M.savePractice();status('練習紀錄已保存，不列入正式排行榜。');});
$('[data-history]').onclick=()=>action(async()=>{const rows=await M.history();$('[data-history-list]').replaceChildren(...rows.map(r=>{const li=document.createElement('li');li.textContent=`${r.game_id} / ${r.level_id}：${r.value}（未驗證）`;return li;}));status(rows.length?'已讀取個人練習紀錄。':'尚無練習紀錄。');});
$('[data-logout]').onclick=()=>action(async()=>{await M.logout();status('已登出。');});
$('[data-board]').onsubmit=e=>{e.preventDefault();action(async()=>{const rows=await M.leaderboard($('[name=game]').value,'practice-v1',$('[name=level]').value);$('[data-board-list]').replaceChildren(...rows.map(r=>{const li=document.createElement('li');li.textContent=`${r.nickname}：${r.value}`;return li;}));status(rows.length?'僅顯示伺服器驗證的成績。':'目前尚無正式驗證成績，練習紀錄不會列入。');});};
window.addEventListener('shigai:practice-ready',()=>status('挑戰完成，可登入保存本頁的練習紀錄。'));
const script=document.querySelector('script[src*="member-panel.js"]');const root=new URL('../../',script.src);
if(M.configured())fetch(new URL('../database/website/games.json',root)).then(r=>{if(!r.ok)throw Error();return r.json();}).then(games=>{for(const g of games.filter(g=>g.status==='published'&&(g.kind||'game')==='game'&&g.id!=='goddess')){const option=document.createElement('option');option.value=g.id;option.textContent=g.name;$('[name=game]').append(option);}}).catch(()=>status('遊戲清單無法載入，請重新整理。'));
if(!M.configured()){status('會員功能尚未開放；仍可直接遊玩。');host.querySelectorAll('button').forEach(b=>b.disabled=true);}else action(async()=>{await M.callback();await account();status(M.isSignedIn()?'已登入。':'可使用 Google 或 Email 驗證碼登入。');});
})();
