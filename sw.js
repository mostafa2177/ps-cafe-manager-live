// ============================================================
// PS Cafe Manager — Service Worker
// Version: 6.4.2-RC5.7 COMPACT DEVICE CARD LAYOUT
// ============================================================
const CACHE_NAME = 'ps-cafe-v6.4.2-rc5-8';
const OFFLINE_URL = './index.html?v=6.4.2-rc5-8';
const PRECACHE_ASSETS = [
  './', './index.html?v=6.4.2-rc5-8', './manifest.json?v=6.4.2-rc5-8',
  './icon-72.png','./icon-96.png','./icon-128.png','./icon-144.png',
  './icon-152.png','./icon-192.png','./icon-384.png','./icon-512.png','./brand-avatar.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function networkFirst(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}
    return response;
  }catch(e){return (await caches.match(request)) || (await caches.match(OFFLINE_URL));}
}
async function staleWhileRevalidate(request){
  const cached=await caches.match(request);
  const fresh=fetch(request).then(async response=>{if(response&&response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}return response;}).catch(()=>null);
  return cached || (await fresh) || (await caches.match(OFFLINE_URL));
}
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url=new URL(event.request.url);
  if(url.hostname.includes('supabase.co')){event.respondWith(fetch(event.request));return;}
  if(event.request.mode==='navigate' || url.pathname.endsWith('/index.html')){event.respondWith(networkFirst(event.request));return;}
  event.respondWith(staleWhileRevalidate(event.request));
});
self.addEventListener('sync', event => {
  if(event.tag === 'ps-sync') event.waitUntil(self.clients.matchAll().then(clients => clients.forEach(c => c.postMessage({type:'BACKGROUND_SYNC',tag:'ps-sync'}))));
});
self.addEventListener('push', event => {
  if(!event.data) return;
  const data=event.data.json();
  event.waitUntil(self.registration.showNotification(data.title || 'PS Cafe Manager', {body:data.body || '',icon:'./icon-192.png',badge:'./icon-96.png',dir:'rtl',lang:'ar',vibrate:[200,100,200],data}));
});
self.addEventListener('notificationclick', event => {event.notification.close();event.waitUntil(clients.openWindow('./'));});
