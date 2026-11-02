// 口袋兔子离线快取：有网络时拿最新版，没网络时用上次的版本
const C='tuwo-2026.11.02f';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'])).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));});
// 手机通知：兔子饿了、生病了、阿姨送兔子回来……
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{};}catch(_){d={body:e.data?e.data.text():''};}
  e.waitUntil(self.registration.showNotification(d.title||'口袋兔子',{body:d.body||'兔子在找你',icon:'icon-192.png',badge:'icon-192.png',tag:d.tag||'tuwo',renotify:true,data:{url:'./'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(L=>{for(const c of L){if('focus' in c)return c.focus();}return self.clients.openWindow('./');}));});
