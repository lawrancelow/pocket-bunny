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
  try{for(const c of ['VD5XTZ','A2P3U6']){const q=await fetch(`${DB}/codes/${c}.json?auth=${encodeURIComponent(tok)}`);const u=await q.json();const p=u&&players[u];
    console.log(`好友码检查 ${c}：${u?'有登记':'没有登记'}${u?(p?`，玩家资料在，${Object.keys(p.rb||{}).length} 只兔子，资料里的码${p.code===c?'一致':'不一致'}，最后上线 ${new Date((p.at||0)+8*3600e3).toISOString().slice(5,16)}`:'，但找不到玩家资料'):''}`);}}catch(e){console.log('好友码检查失败',String(e));}
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
  // 每位玩家：开始玩的时间（最老那只兔子出生的时候）、最后上线、兔子数、好友关系。只认得出豆沙和嘟嘟两家，其他人不印名字
  {const kl=ms=>new Date(ms+8*3600e3).toISOString().slice(5,16).replace('T',' ');const E=Object.entries(players).filter(([u,p])=>p&&typeof p==='object');const lab={};let k=0;
   for(const[u,p]of E){const nms=Object.values(p.rb||{}).map(x=>x&&x.p&&x.p.nm);lab[u]=nms.includes('豆沙')?'豆沙家':nms.includes('嘟嘟')?'嘟嘟家':`玩家${++k}`;}
   for(const[u,p]of E){const ags=Object.values(p.rb||{}).map(x=>+(x&&x.p&&x.p.ag)||0);const start=ags.length?(p.at||0)-Math.max(...ags)*60000:0;
     const fr=(p.fr||[]).map(f=>lab[f]||'别人').join('、')||'没有';
     console.log(`  ${lab[u]}：开始玩约 ${start?kl(start):'不明'}，最后上线 ${p.at?kl(p.at):'不明'}，兔子 ${Object.keys(p.rb||{}).length} 只，好友：${fr}`);}}
  console.log(`检查了 ${Object.keys(players).length} 位玩家（${subs} 位开了手机通知），发了 ${n} 则通知${next?`，下一则约 ${Math.round((next-now)/60000)} 分钟后`:''}${dead?`，${dead} 个订阅已失效`:''}`);
}
main().catch(e=>{console.error(e);fs.writeFileSync(STATE,JSON.stringify(st));process.exit(1);});
