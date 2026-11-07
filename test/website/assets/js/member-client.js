/* Native Supabase Auth/PostgREST adapter. Session tokens remain in memory only. */
(()=>{'use strict';
const config=window.ShiGaiMemberConfig||{}, listeners=new Set();let session=null,timer=null,pending=null,epoch=0;
const changed=()=>listeners.forEach(fn=>fn(Boolean(session)));
function configured(){
 try{const u=new URL(config.projectUrl);return config.enabled===true && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(u.origin) && u.href===u.origin+'/' && validKey(config.publicKey);}catch{return false;}
}
function validKey(key){if(typeof key!=='string')return false;if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return true;
 try{const p=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.role==='anon';}catch{return false;}}
async function request(path,body,method='POST',auth=false){
 if(!configured())throw Error('會員功能尚未開放；仍可直接遊玩。');
 if(auth&&!session)throw Error('請先登入。');
 const headers={apikey:config.publicKey,'Content-Type':'application/json'};
 if(session)headers.Authorization='Bearer '+session.access_token;
 let response;try{response=await fetch(config.projectUrl.replace(/\/$/,'')+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),cache:'no-store',credentials:'omit'});}catch{throw Error('連線失敗，請稍後重試。');}
 if(!response.ok){if(response.status===401&&auth){session=null;clearTimeout(timer);changed();}throw Error(response.status===429?'操作太頻繁，請稍後再試。':'操作未完成，請檢查登入或設定後重試。');}
 return response.status===204?null:response.json();
}
function setSession(data){if(!data?.access_token||!data?.refresh_token)throw Error('登入回應不完整。');session=data;clearTimeout(timer);const currentEpoch=epoch;timer=setTimeout(async()=>{if(!session||currentEpoch!==epoch)return;try{const data=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});if(currentEpoch===epoch&&session)setSession(data);}catch{if(currentEpoch===epoch){session=null;changed();}}},Math.max(1000,(Number(data.expires_in)||3600)*1000-60000));changed();}
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function google(){
 if(!configured())throw Error('會員功能尚未開放。');
 const verifier=b64(crypto.getRandomValues(new Uint8Array(32))),nonce=crypto.randomUUID();
 const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 // Transient PKCE secret only, never profile/scores/session tokens. Removed on return/expiry.
 const callback=new URL('member.html',new URL('../../',document.currentScript?.src||scriptUrl));
 callback.searchParams.set('login_nonce',nonce);
 sessionStorage.setItem('shigai:pkce',JSON.stringify({verifier,nonce,expires:Date.now()+600000}));
 const target=new URL(config.projectUrl.replace(/\/$/,'')+'/auth/v1/authorize');
 target.search=new URLSearchParams({provider:'google',redirect_to:callback.href,code_challenge:challenge,code_challenge_method:'s256'});
 location.assign(target.href);
}
const scriptUrl=document.currentScript.src;
async function callback(){const url=new URL(location.href);if(!url.searchParams.has('code')&&!url.searchParams.has('error'))return false;
 let stored;try{stored=JSON.parse(sessionStorage.getItem('shigai:pkce')||'null');}catch{}sessionStorage.removeItem('shigai:pkce');
 const code=url.searchParams.get('code'),nonce=url.searchParams.get('login_nonce');history.replaceState(null,'',url.pathname);
 if(!stored||stored.expires<Date.now()||nonce!==stored.nonce||!code)throw Error('登入已取消或逾時，請重新登入。');
 setSession(await request('/auth/v1/token?grant_type=pkce',{auth_code:code,code_verifier:stored.verifier}));return true;
}
window.ShiGaiMembers=Object.freeze({configured,isSignedIn:()=>Boolean(session),onChange:fn=>listeners.add(fn),google,callback,
 sendOtp:email=>request('/auth/v1/otp',{email,create_user:true}),
 verifyOtp:async(email,token)=>setSession(await request('/auth/v1/verify',{email,token,type:'email'})),
 logout:async()=>{epoch++;try{if(session)await request('/auth/v1/logout',{},'POST',true);}finally{session=null;pending=null;clearTimeout(timer);changed();}},
 profile:()=>request('/rest/v1/player_profiles?select=nickname,public_id,leaderboard_visible',undefined,'GET',true),
 updateProfile:(nickname,leaderboard_visible)=>request('/rest/v1/player_profiles',{nickname,leaderboard_visible},'PATCH',true),
 history:()=>request('/rest/v1/practice_scores?select=game_id,rules_version,level_id,value,submitted_at&order=submitted_at.desc&limit=30',undefined,'GET',true),
 leaderboard:(game,version,level)=>request('/rest/v1/rpc/game_leaderboard',{p_game_id:game,p_rules_version:version,p_level_id:level}),
 capture:record=>{pending={...record,requestId:crypto.randomUUID()};window.dispatchEvent(new Event('shigai:practice-ready'));},
 pending:()=>pending?{...pending}:null,
 savePractice:async()=>{if(!pending)throw Error('本頁尚無已完成的挑戰。');const p=pending;await request('/rest/v1/rpc/submit_practice',{p_request_id:p.requestId,p_game_id:p.gameId,p_rules_version:'practice-v1',p_level_id:String(p.levelId),p_value:p.value},'POST',true);if(pending===p)pending=null;}
});
})();
