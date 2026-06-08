
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js?v=6.4.2-rc7-3-1')
      .then(reg=>{
        swRegistration=reg;
        console.log('SW registered:', reg.scope, APP_VERSION);
        setInterval(()=>reg.update(), 60000);
        reg.addEventListener('updatefound', ()=>{
          const next=reg.installing;if(!next)return;
          next.addEventListener('statechange', ()=>{if(next.state==='installed'&&navigator.serviceWorker.controller)showNotice('يوجد تحديث جديد. استخدم التحديث الإجباري الآمن من الإعدادات.', 'info')});
        });
      })
      .catch(err=>console.warn('SW registration failed:', err));
  });
}
