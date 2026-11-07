// 口袋兔子 · 手机通知发送程序（在 GitHub Actions 上每 10 分钟跑一次）
// 读取 players/*/push：游戏上传的「接下来会发生的事」（at 时间、m 内容），时间到了就发通知。
// 玩家在那之后又打开过游戏（快照时间 at 比较新），就不发，因为游戏已经重新算过了。
import webpush from 'web-push';
import fs from 'fs';
const DB=process.env.TUWO_DB||'https://pocket-bunny-default-rtdb.asia-southeast1.firebasedatabase.app';
const AUTH=process.env.TUWO_AUTH||'https://identitytoolkit.googleapis.com';
const TOK=process.env.TUWO_TOK||'https://securetoken.googleapis.com';
const KEY=process.env.TUWO_KEY||'AIzaSyB5lYprszrtyGlKYw56I4fMnIKUl_4-_l8';
const PUB=process.env.VAPID_PUBLIC||'BOMtZmfqGLiMkB068mes_gBvqHyQuU5OsH424mp14jw_ThdFA9OkU-R9NPhS0urkAKgJE7A_laKql6O7h6B-Ez0';
const PRIV=process.env.VAPID_PRIVATE;
const STATE=process.env.STATE_FILE||'push_state.json';
const DRY=process.env.PUSH_DRY==='1';
const now=+process.env.PUSH_NOW||Date.now();
const st=(()=>{try{return JSON.parse(fs.readFileSync(STATE,'utf8'));}catch(e){return{};}})();
async function token(){
  if(st.rt){const r=await fetch(`${TOK}/v1/token?key=${KEY}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(st.rt)});
    if(r.ok){const j=await r.json();st.rt=j.refresh_token;return j.id_token;}}
  const r=await fetch(`${AUTH}/v1/accounts:signUp?key=${KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
  if(!r.ok)throw new Error('auth '+r.status);const j=await r.json();st.rt=j.refreshToken;return j.idToken;}
async function main(){
  if(!PRIV&&!DRY){console.log('还没有设定 VAPID_PRIVATE，先不发通知');return;}
  if(!DRY)webpush.setVapidDetails('https://lawrancelow.github.io/pocket-bunny/',PUB,PRIV);
  const tok=await token();
  const r=await fetch(`${DB}/players.json?auth=${encodeURIComponent(tok)}`);if(!r.ok)throw new Error('read '+r.status);
  const players=await r.json()||{};
  // 上次跑到哪里；第一次（或太久没跑）只看最近 20 分钟，避免补发一大堆旧通知
  const from=Math.max(st.last||0,now-20*60000);
  st.sent=st.sent||{};let n=0,dead=0,subs=0,next=0;
  for(const[uid,p]of Object.entries(players)){
    const pu=p&&p.push;if(!pu||!pu.sub||!pu.sub.endpoint||!Array.isArray(pu.nt))continue;
    subs++;for(const x of pu.nt)if(x&&x.at>now&&(!next||x.at<next))next=x.at;
    const due=pu.nt.filter(x=>x&&x.at>from&&x.at<=now&&x.at>(p.at||0));
    if(!due.length)continue;
    // 同一次只发一则（几件事一起的话合并成一句）
    const key=uid+':'+due.map(x=>x.at).join(',');if(st.sent[key])continue;
    const body=due.length===1?due[0].m:due.slice(0,3).map(x=>x.m).join('；');
    const msg=JSON.stringify({title:'口袋兔子',body,tag:'tuwo-'+(due[0].k||'call')});
    if(DRY){console.log('DRY',uid,msg);st.sent[key]=now;n++;continue;}
    try{await webpush.sendNotification(pu.sub,msg,{TTL:3600,urgency:'high'});st.sent[key]=now;n++;}
    catch(e){if(e.statusCode===404||e.statusCode===410)dead++;else console.log('发送失败',uid,e.statusCode||e.message);}
  }
  for(const[k,t]of Object.entries(st.sent))if(now-t>2*86400000)delete st.sent[k];
  st.last=now;fs.writeFileSync(STATE,JSON.stringify(st));
  {let rb=0,a1=0,a7=0,np=0;for(const p of Object.values(players)){if(!p||typeof p!=='object')continue;np++;rb+=Object.keys(p.rb||{}).length;const ago=now-(p.at||0);if(ago<864e5)a1++;if(ago<7*864e5)a7++;}
   console.log(`统计：服务器上 ${np} 位玩家，共 ${rb} 只兔子；24 小时内上线 ${a1} 位，7 天内上线 ${a7} 位`);}
  console.log(`检查了 ${Object.keys(players).length} 位玩家（${subs} 位开了手机通知），发了 ${n} 则通知${next?`，下一则约 ${Math.round((next-now)/60000)} 分钟后`:''}${dead?`，${dead} 个订阅已失效`:''}`);
}
main().catch(e=>{console.error(e);fs.writeFileSync(STATE,JSON.stringify(st));process.exit(1);});
