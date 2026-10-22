const C='cg1',A=['./','index.html','manifest.webmanifest','icons/icon-192.png'];
self.oninstall=e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()));
self.onactivate=e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))).then(()=>clients.claim()));
self.onfetch=e=>{const u=new URL(e.request.url);if(u.origin!=location.origin||e.request.method!='GET')return;
const net=u.pathname.endsWith('dati.json')||e.request.mode=='navigate';
e.respondWith(net?fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)):caches.match(e.request).then(r=>r||fetch(e.request)))};
