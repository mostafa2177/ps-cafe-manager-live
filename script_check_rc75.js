


// ============================================================
// CORE STATE & STORAGE
// ============================================================
const APP_VERSION='V6.4.2-RC7.5';
const K='ps_cafe_v4_state', SK='ps_cafe_v4_settings', QK='ps_cafe_v4_sync_queue', SMK='ps_cafe_v4_sync_meta';
const CLOUD_AUDIT_TABLE='ps_audit_logs';
let state,user=null,tab='Dashboard',dirty=false,timer=null,swRegistration=null,installPromptEvent=null,cloudMembers=[];

function syncMeta(){try{return JSON.parse(localStorage.getItem(SMK))||{verified:false,lastSuccess:'',lastError:'',syncing:false}}catch(e){return{verified:false,lastSuccess:'',lastError:'',syncing:false}}}
function setSyncMeta(patch){let m={...syncMeta(),...patch};localStorage.setItem(SMK,JSON.stringify(m));if(user)render();return m}
function shortTime(iso){return iso?new Date(iso).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'}):'—'}

function id(){return 'id_'+Math.random().toString(36).slice(2)+Date.now().toString(36)}

// DEFAULT match pricing configs per device: {mins, single, multi}
const DEF_MATCH_PRICES=[
  {mins:5,single:5,multi:10},
  {mins:10,single:10,multi:20},
  {mins:15,single:15,multi:25},
  {mins:30,single:25,multi:40}
];

function def(){
  return{
    users:[
      {id:id(),username:'admin',password:'1234',role:'Owner',active:true},
      {id:id(),username:'cashier',password:'1234',role:'Cashier',active:true}
    ],
    devices:[1,2,3,4,5].map(n=>({
      id:'ps'+n,name:'PS '+n,status:'available',singleRate:60,multiRate:90,
      matchPrices:DEF_MATCH_PRICES.map(x=>({...x}))
    })),
    products:['شاي:15','قهوة:25','نسكافيه:30','مياه:10','عصير:20','كانز:25'].map(x=>{
      let a=x.split(':');return{id:id(),name:a[0],price:+a[1],stock:0,active:true}
    }),
    profile:{businessName:'PS Cafe',ownerName:'',phone:'',address:''},sessions:[],invoices:[],expenses:[],shiftClosures:[],auditLogs:[],nextInvoice:1,updatedAt:new Date().toISOString()
  }
}

function load(){try{state=JSON.parse(localStorage.getItem(K))||def()}catch(e){state=def()}
  if(!state.profile)state.profile={businessName:'PS Cafe',ownerName:'',phone:'',address:''};
  if(!Array.isArray(state.auditLogs))state.auditLogs=[];
  if(!Array.isArray(state.shiftClosures))state.shiftClosures=[];
  state.users=(state.users||[]).map(u=>({...u,role:u.role==='Admin'?'Owner':u.role}));
  state.devices.forEach(d=>{if(!d.matchPrices)d.matchPrices=DEF_MATCH_PRICES.map(x=>({...x}))});
  save(false)
}
function save(md=true){state.updatedAt=new Date().toISOString();localStorage.setItem(K,JSON.stringify(state));if(md&&st().mode!=='secure_cloud'){dirty=true;markPending('تغيير محلي');sched()}render()}
function baseSettings(){return {mode:'offline',url:'',key:'',businessId:'',cloudEmail:'',session:null,schema:'normalized_v2_controlled_corrections'}}
function st(){try{return {...baseSettings(),...(JSON.parse(localStorage.getItem(SK))||{})}}catch(e){return baseSettings()}}
function setst(s){localStorage.setItem(SK,JSON.stringify({...baseSettings(),...s}));setup();render()}
function money(n){return (Number(n)||0).toFixed(2)}
function ceilToFive(n){n=Number(n)||0;return n<=0?0:Math.ceil(n/5)*5}
function billOpenPlay(raw){raw=Number(raw)||0;return raw<=0?0:Math.max(5,ceilToFive(raw))}
function fmt(d){return d?new Date(d).toLocaleString('ar-EG'):''}
function localBusinessDate(value=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(value instanceof Date?value:new Date(value))}
function today(){return localBusinessDate()}
function val(x){return document.getElementById(x)?.value||''}
function matchOptionPrice(opt,mode){return Number((mode==='multi'?opt.multi:opt.single) ?? opt.price ?? 0)||0}
function matchOptionLabel(opt,mode){return `${Number(opt.mins)||0} دقيقة — ${money(matchOptionPrice(opt,mode))} ج`}
function isMatchLine(x){return !!x && (x.type==='match'||x.itemType==='match'||x.item_type==='match'||String(x.name||'').trim().startsWith('مباراة'));}
function matchItemsTotal(items){return (items||[]).filter(isMatchLine).reduce((a,i)=>a+(+i.price||0)*(+i.qty||1),0);}
function nonMatchItemsTotal(items){return (items||[]).filter(i=>!isMatchLine(i)).reduce((a,i)=>a+(+i.price||0)*(+i.qty||1),0);}
function matchItemsCount(items){return (items||[]).filter(isMatchLine).reduce((a,i)=>a+(+i.qty||1),0);}
function sessionMatchCount(s){return (s&&s.sessionType==='match'?1:0)+matchItemsCount((s&&s.items)||[]);}
function invoiceMatchCount(i){return (i&&i.sessionType==='match'?1:0)+matchItemsCount((i&&i.items)||[]);}
function matchCountLabel(n){return n===1?'مباراة واحدة':(n===2?'مباراتان':(n>=3&&n<=10?n+' مباريات':n+' مباراة'));}
function closeActionMenus(){document.querySelectorAll('.action-wrap.open').forEach(el=>el.classList.remove('open'))}
function positionActionMenu(el){
  const menu=el?.querySelector('.action-menu');if(!menu)return;
  const r=el.getBoundingClientRect();
  const w=Math.max(190,menu.offsetWidth||190), h=menu.offsetHeight||150;
  let left=Math.min(Math.max(12,r.right-w),window.innerWidth-w-12);
  let top=r.bottom+6;
  if(top+h>window.innerHeight-12) top=Math.max(12,r.top-h-6);
  menu.style.left=left+'px';menu.style.top=top+'px';
}
function toggleActionMenu(id,ev){
  if(ev)ev.stopPropagation();
  document.querySelectorAll('.action-wrap').forEach(el=>{if(el.id!==id)el.classList.remove('open')});
  const el=document.getElementById(id);if(!el)return;
  el.classList.toggle('open');
  if(el.classList.contains('open'))requestAnimationFrame(()=>positionActionMenu(el));
}
document.addEventListener('click',e=>{if(!e.target.closest('.action-wrap'))closeActionMenus();});
window.addEventListener('resize',closeActionMenus);
// RC7.5: mobile scroll remains native. Pull-to-refresh is handled by CSS only.
// EC9: do not close action UI on scroll; mobile scroll events can fire immediately after tap.
function invoiceActionsModal(iid){
  const i=state.invoices.find(x=>x.id===iid);if(!i)return;
  modal(`<div class="big">⋯ إجراءات الفاتورة ${invNo(i)}</div>
    <div class="col">
      <button class="ok" onclick="showInv('${iid}')">🧾 عرض الفاتورة</button>
      <button onclick="printInvoice('${iid}')">🖨 طباعة / PDF</button>
      ${canCorrectInvoice()&&i.status!=='voided'?`<button class="btn-warn" onclick="invoiceCorrectionModal('${iid}')">✏ تصحيح موثّق</button><button class="danger" onclick="voidInvoiceModal('${iid}')">⛔ إلغاء موثّق</button>`:''}
      <button class="gray" onclick="closeM()">إغلاق</button>
    </div>`);
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function owner(){return user&&['Owner','Admin'].includes(user.role)}
function manager(){return user&&user.role==='Manager'}
function canCorrectInvoice(){return !!(owner()||(manager()&&user.canCorrectInvoices===true))}
function cashier(){return user&&user.role==='Cashier'}
function roleLabel(role){return ({Owner:'صاحب النشاط',Admin:'صاحب النشاط',Manager:'مدير',Cashier:'كاشير',Viewer:'مشاهدة فقط'}[role]||role)}
function audit(action, entityType, entityId, summary, details={}){
  if(!state)return null;
  if(!Array.isArray(state.auditLogs))state.auditLogs=[];
  const entry={id:id(),at:new Date().toISOString(),action,entityType,entityId:entityId||'',summary,details,actorId:user?.id||'',actor:user?.username||'system',actorRole:user?.role||'System',cloudSynced:false};
  state.auditLogs.unshift(entry);
  state.auditLogs=state.auditLogs.slice(0,2000);
  return entry;
}
function invActor(i){return i.issuedBy||i.user||'غير محدد — بيانات سابقة'}
function invNo(i){return Number(i.no)>0?('رقم '+i.no):'قيد الاعتماد السحابي'}
function invoiceStatusText(i){return i.status==='voided'?'ملغاة':(i.correctionSeq?'مصححة':'مكتملة')}
function invoiceRevisionRows(i,rowClass='invoice-row'){
  if(!i.correctionSeq)return '';
  const action=i.status==='voided'?'الإلغاء':'التصحيح';
  return `<div class="${rowClass}"><span>آخر ${action}</span><strong>${esc(i.correctedByLabel||'—')} — ${fmt(i.correctedAt)}</strong></div><div class="${rowClass}"><span>ملاحظة ${action}</span><span>${esc(i.correctionReason||'—')}</span></div>`;
}
function allowedTabs(){
  if(owner())return ['Dashboard','Products','Devices','Invoices','Expenses','Reports','Shifts','Audit','Users','Settings'];
  if(manager())return ['Dashboard','Products','Devices','Invoices','Expenses','Reports','Shifts'];
  if(cashier())return ['Dashboard','Products','Invoices','Shifts'];
  return ['Dashboard','Invoices','Reports'];
}

// ============================================================
// AUTH
// ============================================================
async function login(){
  const identifier=val('lu').trim(), p=val('lp'), cfg=st();
  lm.textContent='';
  if(cfg.mode==='secure_cloud'){
    if(!identifier||!p){lm.textContent='اكتب البريد الإلكتروني وكلمة المرور';return;}
    try{
      await cloudSignInCredentials(identifier,p);
      const member=await fetchSignedInMember();
      if(!member||!member.active)throw Error('هذا المستخدم غير مفعل في النشاط.');
      user={id:member.user_id,username:member.display_name||identifier,role:jsRole(member.role),canCorrectInvoices:!!member.can_correct_invoices,active:true,cloud:true};
      document.getElementById('login').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      tab='Dashboard';tabs();setup();
      await rpc('ps_record_client_event',{p_business:cfg.businessId,p_action:'LOGIN',p_summary:'تسجيل دخول: '+user.username});
      await loadCloud(true);
      return;
    }catch(e){lm.textContent=e.message||'تعذر تسجيل الدخول السحابي';return;}
  }
  let u=identifier.toLowerCase();
  let x=state.users.find(a=>a.username.toLowerCase()==u&&a.password==p&&a.active);
  if(!x){lm.textContent='بيانات الدخول غير صحيحة';return}
  user=x;
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  tab='Dashboard';tabs();setup();
  audit('LOGIN','auth',x.id,'تسجيل دخول: '+x.username);
  save();
  if(p==='1234')showNotice('تنبيه أمان: يجب على صاحب النشاط تغيير كلمة المرور الافتراضية قبل الاستخدام الحقيقي.', 'warn');
}
function jsRole(role){return ({owner:'Owner',manager:'Manager',cashier:'Cashier',viewer:'Viewer'}[role]||'Viewer')}
async function logout(){
  if(user&&st().mode==='secure_cloud'){
    try{await rpc('ps_record_client_event',{p_business:st().businessId,p_action:'LOGOUT',p_summary:'تسجيل خروج: '+user.username});}catch(e){}
    await cloudSignOut(false);
  }else if(user){audit('LOGOUT','auth',user.id,'تسجيل خروج: '+user.username);save();}
  user=null;document.getElementById('app').classList.add('hidden');document.getElementById('login').classList.remove('hidden');
}

// ============================================================
// TABS & RENDER
// ============================================================
function tabs(){
  let all=[['Dashboard','🏠 الرئيسية'],['Products','🥤 المشروبات'],['Devices','🎮 الأجهزة'],['Invoices','🧾 الفواتير'],['Expenses','💸 المصروفات'],['Reports','📊 التقارير'],['Shifts','🔁 الورديات'],['Audit','🛡️ سجل الحركات'],['Users','👥 المستخدمين'],['Settings','🏪 إدارة النشاط']];
  let allowed=allowedTabs();
  document.getElementById('tabs').innerHTML=all.filter(t=>allowed.includes(t[0])).map(t=>`<button class="tab ${tab==t[0]?'active':''}" onclick="show('${t[0]}')">${t[1]}</button>`).join('')
}
function show(t,fromPop=false){
  if(!allowedTabs().includes(t)){showNotice('ليست لديك صلاحية لفتح هذه الصفحة.', 'danger');return;}
  tab=t;tabs();render();
  if(!fromPop){try{history.pushState({tab:t},'', '#'+t)}catch(e){}}
}
function render(){
  if(!user)return;
  if(!allowedTabs().includes(tab))tab='Dashboard';
  cu.textContent=user.username;cr.textContent=roleLabel(user.role);
  let ss=st(),q=0,online=navigator.onLine,sm=syncMeta();
  if(ss.mode!=='secure_cloud'){sl.textContent='محلي';sl.className='sync';}
  else if(!online){sl.textContent='غير متصل — محفوظ';sl.className='sync err';}
  else if(sm.syncing){sl.textContent='جاري الحفظ…';sl.className='sync pending';}
  else if(q){sl.textContent='بانتظار الحفظ '+q;sl.className='sync pending';}
  else if(sm.verified&&sm.lastSuccess){sl.textContent='محفوظ ✓';sl.className='sync private-cloud';}
  else if(sm.verified){sl.textContent='متصل ✓';sl.className='sync private-cloud';}
  else{sl.textContent='غير مفعّل';sl.className='sync unknown';}
  ['Dashboard','Products','Devices','Invoices','Expenses','Reports','Shifts','Audit','Users','Settings'].forEach(x=>document.getElementById('v'+x).classList.add('hidden'));
  document.getElementById('v'+tab).classList.remove('hidden');
  renderActiveTab();
}
function renderActiveTab(){
  const map={Dashboard:rDash,Products:rProducts,Devices:rDevices,Invoices:rInvoices,Expenses:rExpenses,Reports:rReports,Shifts:rShifts,Audit:rAudit,Users:rUsers,Settings:rSettings};
  (map[tab]||rDash)();
}

// 1-second tick — update only live session fields, not the full screen.
// Open sessions show a live timer and calculated total. Matches remain fixed-price with alerts only.
function isModalOpen(){return !document.getElementById('modal')?.classList.contains('hidden')}
function dashboardTick(){
  if(!user)return;
  updateLiveSessionWidgets();
  checkAlerts();
}
setInterval(dashboardTick,1000)

// ============================================================
// SESSION HELPERS
// ============================================================
function sess(did){return state.sessions.find(s=>s.deviceId===did&&s.status==='open')}
function cost(s){
  let elapsed=Math.max(0,(Date.now()-new Date(s.start))/60000); // float minutes elapsed
  let d=state.devices.find(x=>x.id===s.deviceId)||{};
  let play=0;
  let m=s.sessionType==='match'?(Number(s.matchMins)||Math.ceil(elapsed)||1):(Math.ceil(elapsed)||1);
  if(s.sessionType==='match'){
    // Match is a fixed-price product: no live accounting timer.
    play=+s.matchPrice||0;
  } else {
    // Open session only: billed by elapsed time, minimum 5 EGP, rounded up to nearest 5, no fractions.
    let rate=s.mode==='multi'?d.multiRate:d.singleRate;
    play=billOpenPlay(elapsed/60*(+rate||0));
  }
  // Additional matches are fixed-price match charges, not drinks/add-ons.
  play += matchItemsTotal(s.items||[]);
  let dr=nonMatchItemsTotal(s.items||[]);
  return{m,elapsed,play,dr,total:play+dr,matchAdd:matchItemsTotal(s.items||[])}
}
function sessionClock(s){
  const seconds=Math.max(0,Math.floor((Date.now()-new Date(s.start))/1000));
  const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),sec=seconds%60;
  const pad=n=>String(n).padStart(2,'0');
  return h>0?`${h}:${pad(m)}:${pad(sec)}`:`${m}:${pad(sec)}`;
}
function liveSessionPanel(s,c){
  const sid=esc(s.id);
  if(s.sessionType==='match'){
    return `<div class="live-session-panel">
      <div class="live-session-box match-fixed"><span>المدة</span><strong>${Number(s.matchMins)||0} د</strong></div>
      <div class="live-session-box current-total"><span>الإجمالي</span><strong data-live-total="${sid}">${money(c.total)} ج</strong></div>
      <div class="live-session-box drink-total"><span>مشروبات</span><strong data-live-drinks="${sid}">${money(c.dr)} ج</strong></div>
      <div class="live-session-box"><span>إضافات</span><strong data-live-matchadd="${sid}">${money(c.matchAdd)} ج</strong></div>
    </div>`;
  }
  return `<div class="live-session-panel">
    <div class="live-session-box open-timer"><span>الوقت</span><strong data-live-timer="${sid}">${sessionClock(s)}</strong></div>
    <div class="live-session-box current-total"><span>الإجمالي</span><strong data-live-total="${sid}">${money(c.total)} ج</strong></div>
    <div class="live-session-box"><span>اللعب</span><strong data-live-play="${sid}">${money(c.play)} ج</strong></div>
    <div class="live-session-box drink-total"><span>مشروبات</span><strong data-live-drinks="${sid}">${money(c.dr)} ج</strong></div>
  </div>`;
}
function updateLiveSessionWidgets(){
  if(!state||tab!=='Dashboard')return;
  (state.sessions||[]).filter(s=>s.status==='open').forEach(s=>{
    const c=cost(s);
    document.querySelectorAll(`[data-live-timer="${CSS.escape(s.id)}"]`).forEach(el=>el.textContent=sessionClock(s));
    document.querySelectorAll(`[data-live-total="${CSS.escape(s.id)}"]`).forEach(el=>el.textContent=money(c.total)+' ج');
    document.querySelectorAll(`[data-live-play="${CSS.escape(s.id)}"]`).forEach(el=>el.textContent=money(c.play)+' ج');
    document.querySelectorAll(`[data-live-drinks="${CSS.escape(s.id)}"]`).forEach(el=>el.textContent=money(c.dr)+' ج');
    document.querySelectorAll(`[data-live-matchadd="${CSS.escape(s.id)}"]`).forEach(el=>el.textContent=money(c.matchAdd)+' ج');
  });
}

function badge(d){
  let c=d.status==='available'?'b-ok':d.status==='busy'?'b-busy':'b-bad';
  let t=d.status==='available'?'✔ متاح':d.status==='busy'?'● مشغول':'✕ صيانة';
  return `<span class="badge ${c}">${t}</span>`
}
function statusChip(d,s,alertCls){
  if(d.status==='maintenance')return '<span class="status-chip off">🛠 صيانة</span>';
  if(!s)return '<span class="status-chip ok">✅ متاح</span>';
  if(alertCls==='overtime'||alertCls==='warn-5')return '<span class="status-chip end">⛔ انتهت</span>';
  if(alertCls==='warn-10')return '<span class="status-chip soon">⚠ قربت</span>';
  if(s.sessionType==='match')return '<span class="status-chip match">🎮 مباراة</span>';
  return '<span class="status-chip open">⏱ مفتوحة</span>';
}


// ============================================================
// PWA INSTALLATION
// ============================================================
function isInstalledApp(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function installState(){
  if(isInstalledApp()) return {cls:'status-good',label:'التطبيق مثبت ويعمل كوضع مستقل ✓'};
  if(installPromptEvent) return {cls:'status-good',label:'جاهز للتثبيت كتطبيق على الهاتف ✓'};
  return {cls:'status-warn',label:'غير مثبت بعد — بعد تحديث النسخة اضغط فحص التثبيت.'};
}
async function installPwa(){
  if(isInstalledApp()){showNotice('التطبيق مثبت بالفعل على الهاتف ✓','success');return;}
  if(!installPromptEvent){
    showNotice('لم يظهر خيار التثبيت بعد. اضغط تحديث إجباري آمن ثم افتح الصفحة من Chrome وحاول مجددًا.', 'warn');
    return;
  }
  installPromptEvent.prompt();
  const choice = await installPromptEvent.userChoice;
  installPromptEvent = null;
  if(choice.outcome === 'accepted') showNotice('تم قبول تثبيت التطبيق ✓', 'success');
  else showNotice('تم إلغاء التثبيت. يمكنك المحاولة لاحقًا.', 'warn');
  render();
}
window.addEventListener('beforeinstallprompt', event=>{
  event.preventDefault();
  installPromptEvent = event;
  if(user && tab==='Settings') render();
});
window.addEventListener('appinstalled', ()=>{
  installPromptEvent = null;
  if(user){showNotice('تم تثبيت PS Cafe Manager بنجاح ✓','success');render();}
});

// ============================================================
// ALERT / NOTIFICATION SYSTEM
// ============================================================
const alertedSessions={};// track which alerts have fired: {sid: {w10,w5,end,over}}

function notificationState(){
  if(!window.isSecureContext)return {code:'insecure',label:'يتطلب HTTPS',cls:'status-bad'};
  if(!('Notification' in window))return {code:'unsupported',label:'غير مدعوم على هذا المتصفح',cls:'status-bad'};
  if(Notification.permission==='granted')return {code:'granted',label:'مفعلة ✓',cls:'status-good'};
  if(Notification.permission==='denied')return {code:'denied',label:'محظورة من المتصفح',cls:'status-bad'};
  return {code:'default',label:'لم يتم السماح بعد',cls:'status-warn'};
}
async function enableNotifications(){
  const current=notificationState();
  if(current.code==='insecure'){showNotice('الإشعارات تحتاج فتح التطبيق من رابط HTTPS.', 'danger');return;}
  if(current.code==='unsupported'){showNotice('الإشعارات غير مدعومة على هذا المتصفح.', 'danger');return;}
  if(current.code==='granted'){showNotice('الإشعارات مفعلة بالفعل ✓', 'success');render();return;}
  if(current.code==='denied'){
    showNotice('الإشعارات محظورة. افتح إعدادات الموقع في Chrome ثم اسمح بالإشعارات.', 'danger');render();return;
  }
  try{
    const result=await Notification.requestPermission();
    render();
    if(result==='granted') showNotice('تم تفعيل الإشعارات بنجاح ✓', 'success');
    else if(result==='denied') showNotice('تم حظر الإشعارات. يمكنك السماح بها من إعدادات الموقع.', 'danger');
    else showNotice('لم يتم منح الإذن. فعّله من إعدادات الموقع عند الحاجة.', 'warn');
  }catch(err){
    render();showNotice('تعذر طلب إذن الإشعارات على هذا المتصفح.', 'danger');
  }
}

function fireAlert(sid,level,deviceName,minsLeft){
  if(!alertedSessions[sid])alertedSessions[sid]={};
  if(alertedSessions[sid][level])return; // already fired
  alertedSessions[sid][level]=true;

  let msg='',icon='⚠️',cls='t-warn';
  if(level==='w10'){msg=`${deviceName}: باقي 10 دقائق`;icon='⏰';cls='t-warn'}
  else if(level==='w5'){msg=`${deviceName}: باقي 5 دقائق فقط!`;icon='🔴';cls='t-danger'}
  else if(level==='end'){msg=`${deviceName}: الوقت انتهى!`;icon='🏁';cls='t-end'}
  else if(level==='over'){msg=`${deviceName}: تجاوز الوقت بـ 5 دقائق!`;icon='🚨';cls='t-danger'}
  else if(String(level).startsWith('open')){msg=`${deviceName}: جلسة مفتوحة مستمرة منذ ${minsLeft} دقيقة`;icon='⏱️';cls='t-info'}

  // Sound (Web Audio API)
  playBeep(level);
  // Vibration
  if(navigator.vibrate){
    if(level==='w10') navigator.vibrate([200,100,200]);
    else if(level==='w5') navigator.vibrate([300,100,300,100,300]);
    else if(level==='end'||level==='over') navigator.vibrate([500,150,500,150,500,150,500]);
  }
  // Browser Notification
  if('Notification' in window && Notification.permission==='granted'){
    new Notification('PS Cafe Manager — '+deviceName,{body:msg.replace(deviceName+': ',''),icon:'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>'});
  }
  // Toast
  showToast(icon,msg,cls);
}

function playBeep(level){
  try{
    let ctx=new(window.AudioContext||window.webkitAudioContext)();
    let freqs={w10:[520,520],w5:[660,520,660],end:[800,600,400],over:[400,300,200,300,400]};
    let seq=freqs[level]||[520];
    let t=ctx.currentTime;
    seq.forEach((f,i)=>{
      let o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.frequency.value=f;o.type='sine';
      g.gain.setValueAtTime(0.3,t+i*0.18);
      g.gain.exponentialRampToValueAtTime(0.001,t+i*0.18+0.15);
      o.start(t+i*0.18);o.stop(t+i*0.18+0.15);
    });
    setTimeout(()=>ctx.close(),2000);
  }catch(e){}
}

function showToast(icon,msg,cls){
  let wrap=document.getElementById('alert-toast');
  if(!wrap)return;
  // EC11: compact non-blocking top toast; keep newest 3 only so it never covers bottom actions.
  while(wrap.children.length>=3)wrap.firstElementChild?.remove();
  let el=document.createElement('div');
  el.className='toast-item '+cls;
  el.innerHTML=`<span class="toast-icon">${icon}</span><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  const life=(cls||'').includes('t-danger')?4200:2600;
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(-6px)';el.style.transition='opacity 0.25s, transform 0.25s';setTimeout(()=>el.remove(),260)},life);
}
function showNotice(msg,type='info'){
  const map={success:['✅','t-ok'],danger:['⚠️','t-danger'],warn:['⏰','t-warn'],info:['ℹ️','t-info']};
  const pair=map[type]||map.info;showToast(pair[0],msg,pair[1]);
}

function checkAlerts(){
  if(!state||!Array.isArray(state.sessions))return;
  state.sessions.filter(s=>s.status==='open').forEach(s=>{
    const d=state.devices.find(x=>x.id===s.deviceId)||{};
    const deviceName=d.name||'الجهاز';
    const elapsed=Math.max(0,(Date.now()-new Date(s.start))/60000);
    if(s.sessionType==='match'){
      const target=Number(s.matchMins)||0;
      if(!target)return;
      const left=target-elapsed;
      if(target>=10 && left<=10)fireAlert(s.id,'w10',deviceName,Math.ceil(left));
      if(target>=5 && left<=5)fireAlert(s.id,'w5',deviceName,Math.ceil(left));
      if(elapsed>=target)fireAlert(s.id,'end',deviceName,0);
      if(elapsed>=target+5)fireAlert(s.id,'over',deviceName,5);
    }else{
      // Open session has no fixed end. Use practical follow-up reminders every 30 minutes.
      const milestone=Math.floor(elapsed/30)*30;
      if(milestone>=30)fireAlert(s.id,'open'+milestone,deviceName,milestone);
    }
  });
}

// ============================================================
// DASHBOARD RENDER
// ============================================================
function getDeviceAlertClass(s){
  if(!s||s.sessionType!=='match')return '';
  const target=Number(s.matchMins)||0;if(!target)return '';
  const elapsed=Math.max(0,(Date.now()-new Date(s.start))/60000),left=target-elapsed;
  if(elapsed>=target+5)return 'overtime';
  if(left<=5)return 'warn-5';
  if(left<=10)return 'warn-10';
  return '';
}
function getTimerClass(s){
  if(!s||s.sessionType!=='match')return '';
  const target=Number(s.matchMins)||0;if(!target)return '';
  const elapsed=Math.max(0,(Date.now()-new Date(s.start))/60000),left=target-elapsed;
  if(elapsed>=target)return 'over';
  if(left<=5)return 'warn5';
  if(left<=10)return 'warn10';
  return 'ok';
}
function matchProgressBar(s){ return ''; }
function openOpsCard(kind){
  if(kind==='revenue'||kind==='matches'){show('Invoices');return;}
  if(kind==='available'){show('Devices');return;}
  if(kind==='open'){
    show('Dashboard');
    setTimeout(()=>{(document.querySelector('.device-card.busy')||document.querySelector('.device-card'))?.scrollIntoView({behavior:'smooth',block:'center'});},80);
  }
}

function rDash(){
  const openSessions=state.sessions.filter(x=>x.status==='open');
  const todayInvoices=state.invoices.filter(i=>localBusinessDate(i.date)==today()&&i.status!=='voided');
  const todayRevenue=todayInvoices.reduce((a,i)=>a+(+i.total||0),0);
  const busy=state.devices.filter(d=>sess(d.id)).length;
  const available=state.devices.filter(d=>d.status==='available'&&!sess(d.id)).length;
  const matchesToday=todayInvoices.reduce((a,i)=>a+invoiceMatchCount(i),0);
  const lastInvoice=[...state.invoices].filter(i=>i.status!=='voided').sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const deviceCards=[...state.devices].sort((a,b)=>(sess(b.id)?1:0)-(sess(a.id)?1:0)).map(d=>{
      let s=sess(d.id),c=s?cost(s):null;
      let stBase=d.status==='available'?'available':d.status==='busy'?'busy':'maintenance';
      let alertCls=s?getDeviceAlertClass(s):'';
      let sessionKindCls=s?(s.sessionType==='match'?'match-session':'open-session'):'';
      let timerCls=s?getTimerClass(s):'';
      return `<div class="device-card app-device ${stBase} ${sessionKindCls} ${alertCls}" id="dc_${d.id}">
        <div class="device-card-header">
          <div>
            <div class="device-name">${d.name}</div>
            <div class="device-rate small muted">Single ${money(d.singleRate)} | Multi ${money(d.multiRate)} ج/س</div>
          </div>
          ${statusChip(d,s,alertCls)}
        </div>
        ${s?`
          <div class="session-topline compact-line">
            <span class="mini-chip">${s.sessionType==='match'?'🎮 مباراة':'⏱ مفتوحة'}</span>
            <span class="mini-chip">${s.mode==='multi'?'Multi':'Single'}</span>
            ${sessionMatchCount(s)>0?`<span class="mini-chip">${matchCountLabel(sessionMatchCount(s))}</span>`:''}
          </div>
          ${liveSessionPanel(s,c)}
          <div class="session-info app-session-info">
            <div>العميل: <strong>${esc(s.customer||'—')}</strong></div>
            <div>بدأها: <strong>${esc(s.startedBy||s.user||'—')}</strong></div>
          </div>
          <div class="quick-actions app-device-actions">
            <button onclick="matchAddModal('${s.id}')">⚽ مباراة</button>
            <button onclick="drinkModal('${s.id}')">🥤 مشروبات</button>
            <button class="danger" onclick="endSession('${s.id}')">⏹ إنهاء</button>
          </div>
        `:d.status==='available'?`
          <div class="available-line">متاح</div>
          <div class="start-options app-device-actions">
            <button class="device-start-btn" onclick="startModal('${d.id}')">▶ جلسة</button>
            <button class="match-start-btn" onclick="matchModal('${d.id}')">⚽ مباراة</button>
          </div>
        `:`
          <p class="muted small maintenance-line">صيانة</p>
        `}
      </div>`
    }).join('');
  vDashboard.innerHTML=`
    <section class="mobile-app-home">
      <div class="app-hero">
        <div>
          <div class="eyebrow">تشغيل اليوم</div>
          <div class="app-hero-title">الأجهزة</div>
        </div>
        <div class="hero-actions">
          <button class="ok" onclick="startModal()">▶ جلسة</button>
          <button class="match-start-btn" onclick="matchModal()">⚽ مباراة</button>
        </div>
      </div>
      ${cashier()?cashierShiftWidget():''}
      <div class="app-live-strip">
        <button onclick="openOpsCard('open')"><strong>${busy}</strong><span>مشغول</span></button>
        <button onclick="openOpsCard('available')"><strong>${available}</strong><span>متاح</span></button>
        <button onclick="openOpsCard('revenue')"><strong>${money(todayRevenue)} ج</strong><span>إيراد</span></button>
        <button onclick="openOpsCard('matches')"><strong>${matchesToday}</strong><span>مباريات</span></button>
      </div>
      <div class="devices-head">
        <div>
          <strong>الأجهزة</strong>
          <span>${busy} مشغول · ${available} متاح</span>
        </div>
        <button class="ghost-mini" onclick="show('Devices')">إدارة</button>
      </div>
      <div class="grid g5 app-devices-grid">${deviceCards}</div>
      <div class="daily-review-strip app-daily-actions">
        ${lastInvoice?`<button onclick="showInv('${lastInvoice.id}')">🧾 آخر فاتورة</button>`:''}
        <button class="gray" onclick="printDailyReview()">🖨 تقرير اليوم</button>
        <button class="gray" onclick="show('Shifts')">🔁 الورديات</button>
        <div class="daily-total">اليوم: <strong>${money(todayRevenue)} ج</strong></div>
      </div>
      <div class="ops-summary app-mini-stats">
        <div class="ops-card tap-card green" onclick="openOpsCard('revenue')"><div class="label">إيراد اليوم</div><div class="num">${money(todayRevenue)} ج</div></div>
        <div class="ops-card tap-card orange" onclick="openOpsCard('open')"><div class="label">جلسات مفتوحة</div><div class="num">${openSessions.length}</div></div>
        <div class="ops-card tap-card" onclick="openOpsCard('available')"><div class="label">أجهزة متاحة</div><div class="num">${available}</div></div>
        <div class="ops-card tap-card purple" onclick="openOpsCard('matches')"><div class="label">مباريات اليوم</div><div class="num">${matchesToday}</div></div>
      </div>
    </section>`;
}

// ============================================================
// OPEN SESSION MODAL
// ============================================================
function startModal(did=''){
  let av=state.devices.filter(d=>d.status==='available'&&!sess(d.id));
  modal(`<div class="big">▶ جلسة مفتوحة</div>
    <div class="grid g2">
      <div class="col"><label>الجهاز</label><select id="sd">${av.map(d=>`<option value="${d.id}" ${d.id==did?'selected':''}>${d.name}</option>`)}</select></div>
      <div class="col"><label>اسم العميل</label><input id="sc" placeholder="اختياري"></div>
      <div class="col" style="grid-column:1/-1"><label>نوع التشغيل</label>
        <div class="type-toggle">
          <button type="button" class="sel" id="tm_single" onclick="toggleMode('single')">Single</button>
          <button type="button" id="tm_multi" onclick="toggleMode('multi')">Multi</button>
        </div>
        <input type="hidden" id="sm" value="single">
      </div>
    </div>
    <br><div class="row">
      <button class="ok" onclick="start()">▶ بدء الجلسة</button>
      <button class="gray" onclick="closeM()">إلغاء</button>
    </div>`);
}
function toggleMode(m){
  document.getElementById('sm').value=m;
  document.getElementById('tm_single').className=m==='single'?'sel':'';
  document.getElementById('tm_multi').className=m==='multi'?'sel':'';
}
async function start(){
  let did=val('sd');if(!did)return alert('اختار جهاز');
  const d=state.devices.find(x=>x.id==did),sid=id();
  if(st().mode==='secure_cloud'){
    try{await rpc('ps_start_session',{p_business:st().businessId,p_id:sid,p_device_id:did,p_customer:val('sc'),p_play_mode:val('sm'),p_session_type:'open',p_match_minutes:null});closeM();await loadCloud(true);showNotice('تم بدء الجلسة وتسجيل المستخدم في السجل ✓','success');}
    catch(e){showNotice('لم تبدأ الجلسة: '+e.message,'danger');}
    return;
  }
  const when=new Date().toISOString();
  state.sessions.push({id:sid,deviceId:did,customer:val('sc'),mode:val('sm'),sessionType:'open',items:[],start:when,status:'open',user:user.username,startedBy:user.username,startedById:user.id||''});
  d.status='busy';audit('SESSION_START','session',sid,'بدء جلسة مفتوحة على '+d.name,{deviceId:did,deviceName:d.name,mode:val('sm')});closeM();save();
}

// ============================================================
// MATCH MODAL
// ============================================================
function matchModal(did=''){
  let av=state.devices.filter(d=>d.status==='available'&&!sess(d.id));
  if(!av.length&&!did){return alert('لا توجد أجهزة متاحة');}
  // Build device selector
  let devSel=`<select id="msd" onchange="updateMatchPrices()">${av.map(d=>`<option value="${d.id}" ${d.id==did?'selected':''}>${d.name}</option>`)}</select>`;
  modal(`<div class="big">⚽ مباراة</div>
    <div class="grid g2">
      <div class="col"><label>الجهاز</label>${devSel}</div>
      <div class="col"><label>اسم العميل</label><input id="msc" placeholder="اختياري"></div>
      <div class="col" style="grid-column:1/-1"><label>نوع التشغيل</label>
        <div class="type-toggle">
          <button type="button" class="sel" id="mm_single" onclick="toggleMatchMode('single')">Single</button>
          <button type="button" id="mm_multi" onclick="toggleMatchMode('multi')">Multi</button>
        </div>
        <input type="hidden" id="msm" value="single">
      </div>
      <div class="col" style="grid-column:1/-1">
        <label>المدة والسعر</label>
        <div id="match-prices-list"></div>
        <input type="hidden" id="sel-match-mins" value="">
        <input type="hidden" id="sel-match-price" value="">
      </div>
    </div>
    <br><div class="row">
      <button class="ok" onclick="startMatch()">⚽ بدء المباراة</button>
      <button class="gray" onclick="closeM()">إلغاء</button>
    </div>`);
  updateMatchPrices();
}
function toggleMatchMode(m){
  document.getElementById('msm').value=m;
  document.getElementById('mm_single').className=m==='single'?'sel':'';
  document.getElementById('mm_multi').className=m==='multi'?'sel':'';
  updateMatchPrices();
}
function updateMatchPrices(){
  let did=val('msd');
  let d=state.devices.find(x=>x.id===did);
  if(!d)return;
  let mode=document.getElementById('msm')?.value||'single';
  let prices=d.matchPrices||DEF_MATCH_PRICES;
  let html=`<div class="match-choice-grid">`;
  prices.forEach((p,i)=>{
    const price=matchOptionPrice(p,mode);
    html+=`<div class="match-choice ${i===0?'sel':''}" id="mpr_${i}" onclick="selectMatchPrice(${i},${Number(p.mins)||0},${price})"><strong>${money(price)} ج</strong><small>${Number(p.mins)||0} دقيقة</small></div>`;
  });
  html+='</div>';
  document.getElementById('match-prices-list').innerHTML=html;
  if(prices.length){let p=prices[0];document.getElementById('sel-match-mins').value=Number(p.mins)||0;document.getElementById('sel-match-price').value=matchOptionPrice(p,mode);}
}
function selectMatchPrice(idx,mins,price){
  document.querySelectorAll('.match-choice').forEach((el,i)=>{el.className='match-choice'+(i===idx?' sel':'')});
  document.getElementById('sel-match-mins').value=mins;
  document.getElementById('sel-match-price').value=price;
}
async function startMatch(){
  let did=val('msd');if(!did)return alert('اختار جهاز');
  let mins=+val('sel-match-mins');let price=+val('sel-match-price');
  if(!mins||!price)return alert('اختار مدة المباراة');
  const sid=id(), mode=document.getElementById('msm').value, d=state.devices.find(x=>x.id==did);
  if(st().mode==='secure_cloud'){
    try{await rpc('ps_start_session',{p_business:st().businessId,p_id:sid,p_device_id:did,p_customer:val('msc'),p_play_mode:mode,p_session_type:'match',p_match_minutes:mins});closeM();await loadCloud(true);showNotice('تم بدء المباراة بالسعر المسجل في قاعدة البيانات ✓','success');}
    catch(e){showNotice('لم تبدأ المباراة: '+e.message,'danger');}
    return;
  }
  state.sessions.push({id:sid,deviceId:did,customer:val('msc'),mode,sessionType:'match',matchMins:mins,matchPrice:price,items:[],start:new Date().toISOString(),status:'open',user:user.username,startedBy:user.username,startedById:user.id||''});
  d.status='busy';audit('MATCH_START','session',sid,'بدء مباراة على '+d.name,{deviceId:did,deviceName:d.name,minutes:mins,price});closeM();save();
}

// ============================================================
// SESSION ADD-ONS
// ============================================================

function matchAddModal(sid){
  const s=state.sessions.find(x=>x.id===sid);if(!s)return;
  const d=state.devices.find(x=>x.id===s.deviceId);if(!d)return;
  const mode=s.mode||'single', prices=d.matchPrices||DEF_MATCH_PRICES;
  modal(`<div class="big">⚽ إضافة مباراة للجلسة</div><div class="settings-note">اختر سعر المباراة وسيتم إضافتها إلى رسوم اللعب والمباريات، وليس إلى المشروبات.</div>
    <div class="match-choice-grid">${prices.map((p,i)=>`<div class="match-choice ${i===0?'sel':''}" onclick="selectSessionMatchCharge(${i},${Number(p.mins)||0},${matchOptionPrice(p,mode)})"><strong>${money(matchOptionPrice(p,mode))} ج</strong><small>${Number(p.mins)||0} دقيقة</small></div>`).join('')}</div>
    <input type="hidden" id="session-match-mins" value="${prices[0]?Number(prices[0].mins)||0:0}"><input type="hidden" id="session-match-price" value="${prices[0]?matchOptionPrice(prices[0],mode):0}">
    <br><div class="row"><button class="ok" onclick="addSessionMatchCharge('${sid}')">➕ إضافة المباراة</button><button class="gray" onclick="closeM()">إلغاء</button></div>`);
}
function selectSessionMatchCharge(idx,mins,price){document.querySelectorAll('.match-choice').forEach((el,i)=>{el.className='match-choice'+(i===idx?' sel':'')});document.getElementById('session-match-mins').value=mins;document.getElementById('session-match-price').value=price;}
async function addSessionMatchCharge(sid){
  const s=state.sessions.find(x=>x.id===sid);if(!s)return;
  const mins=+val('session-match-mins')||0, price=+val('session-match-price')||0;
  if(!price)return showNotice('اختر سعر المباراة أولاً.','danger');
  const item={id:id(),productId:null,name:`مباراة ${mins} دقيقة`,price,qty:1,addedBy:user.username,addedAt:new Date().toISOString(),type:'match',item_type:'match'};
  if(st().mode==='secure_cloud'){
    try{await rpc('ps_add_custom_session_item',{p_business:st().businessId,p_id:item.id,p_session_id:sid,p_name:item.name,p_price:price,p_qty:1});await loadCloud(true);showNotice('تمت إضافة المباراة وتسجيل الحركة ✓','success');closeM();}catch(e){showNotice('تعذر إضافة المباراة: '+e.message,'danger')}
    return;
  }
  s.items=s.items||[];s.items.push(item);audit('SESSION_MATCH_ADD','session',sid,'إضافة '+item.name+' للجلسة',{minutes:mins,price});save();closeM();
}

function drinkModal(sid){
  let s=state.sessions.find(x=>x.id==sid);
  modal(`<div class="big">🥤 مشروبات الجلسة</div>
    <div class="grid g2" style="align-items:end">
      <div class="col"><label>الصنف</label><select id="dp">${state.products.filter(p=>p.active).map(p=>`<option value="${p.id}">${p.name} — ${money(p.price)} ج</option>`)}</select></div>
      <div class="col"><label>الكمية</label><input id="dq" type="number" value="1" min="1"></div>
    </div>
    <div style="margin-top:10px"><button class="ok" onclick="addDrink('${sid}')">➕ إضافة</button></div>
    <br>
    <div class="tw"><table><tr><th>الصنف</th><th>كمية</th><th>سعر</th><th>إجمالي</th><th></th></tr>
    ${(s.items||[]).map((i,n)=>`<tr><td>${i.name}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.price*i.qty)}</td><td><button class="danger" onclick="remDrink('${sid}',${n})">حذف</button></td></tr>`).join('')}
    </table></div>
    <br><button class="gray" onclick="closeM()">إغلاق</button>`);
}
async function addDrink(sid){let s=state.sessions.find(x=>x.id==sid),p=state.products.find(x=>x.id==val('dp')),q=+val('dq')||1;if(!s||!p)return;if(st().mode==='secure_cloud'){try{await rpc('ps_add_session_item',{p_business:st().businessId,p_id:id(),p_session_id:sid,p_product_id:p.id,p_qty:q});await loadCloud(true);drinkModal(sid);showNotice('تمت إضافة المنتج وتسجيل الحركة ✓','success');}catch(e){showNotice('تعذر إضافة المنتج: '+e.message,'danger')}return;}s.items.push({id:id(),productId:p.id,name:p.name,price:+p.price,qty:q,addedBy:user.username,addedAt:new Date().toISOString()});audit('SESSION_ITEM_ADD','session',sid,'إضافة '+q+' × '+p.name+' للجلسة',{productId:p.id,qty:q,price:+p.price});save();drinkModal(sid)}
async function remDrink(sid,n){let s=state.sessions.find(x=>x.id==sid),removed=s?.items?.[n];if(!s||!removed)return;if(st().mode==='secure_cloud'){try{await rpc('ps_remove_session_item',{p_business:st().businessId,p_id:removed.id});await loadCloud(true);drinkModal(sid);showNotice('تم حذف المنتج وتسجيل الحركة ✓','success');}catch(e){showNotice('تعذر حذف المنتج: '+e.message,'danger')}return;}s.items.splice(n,1);audit('SESSION_ITEM_REMOVE','session',sid,'حذف '+removed.name+' من الجلسة',{productId:removed.productId,qty:removed.qty,price:removed.price});save();drinkModal(sid)}

// ============================================================
// END SESSION & INVOICE
// ============================================================
async function endSession(sid){
  let s=state.sessions.find(x=>x.id==sid),d=state.devices.find(x=>x.id==s.deviceId),c=cost(s);
  if(st().mode==='secure_cloud'){
    const iid=id();
    try{showNotice('جاري إنهاء الجلسة وتجهيز الفاتورة…','info');await rpc('ps_complete_session',{p_business:st().businessId,p_session_id:sid,p_invoice_id:iid,p_payment_method:'Cash'});await loadCloud(true);const inv=state.invoices.find(x=>x.id===iid)||state.invoices.find(x=>x.sessionId===sid)||state.invoices[0];showNotice('تم إنهاء الجلسة وفتح الفاتورة تلقائيًا ✓','success');if(inv){setTimeout(()=>showInv(inv.id),120);}else{tab='Invoices';tabs();render();showNotice('تم الإنشاء، وتم فتح صفحة الفواتير للمراجعة.','warn');}}
    catch(e){showNotice('تعذر إنهاء الجلسة: '+e.message,'danger');}
    return;
  }
  const now=new Date().toISOString();
  let inv={id:id(),sessionId:s.id,no:state.nextInvoice++,date:now,status:'completed',deviceId:d.id,deviceName:d.name,customer:s.customer,mode:s.mode,sessionType:s.sessionType||'open',matchMins:s.matchMins||null,start:s.start,end:now,minutes:c.m,playTotal:+c.play.toFixed(2),drinkTotal:+c.dr.toFixed(2),total:+c.total.toFixed(2),items:s.items,payment:'Cash',user:user.username,issuedBy:user.username,startedBy:s.startedBy||s.user||''};
  s.status='closed';s.end=inv.end;s.endedBy=user.username;s.invoiceId=inv.id;d.status='available';state.invoices.push(inv);audit('INVOICE_CREATE','invoice',inv.id,'إنشاء فاتورة #'+inv.no+' بواسطة '+user.username,{invoiceNo:inv.no,deviceId:d.id,total:inv.total,sessionId:s.id});delete alertedSessions[sid];save();setTimeout(()=>showInv(inv.id),80);
}
function showInv(iid){
  let i=state.invoices.find(x=>x.id==iid);if(!i)return;
  modal(`<div class="big invoice-modal-title">🧾 فاتورة ${invNo(i)} ${i.status==='voided'?'<span class="badge b-bad">ملغاة</span>':(i.correctionSeq?'<span class="badge b-busy">مصححة</span>':'')}</div>
    <div class="invoice-row"><span>التاريخ</span><span>${fmt(i.date)}</span></div>
    <div class="invoice-row"><span>حالة الفاتورة</span><strong>${invoiceStatusText(i)}</strong></div>
    <div class="invoice-row"><span>أنشأ الفاتورة</span><strong>${esc(invActor(i))}</strong></div>
    <div class="invoice-row"><span>بدأ الجلسة</span><span>${esc(i.startedBy||'غير محدد — بيانات سابقة')}</span></div>
    ${invoiceRevisionRows(i)}
    <div class="invoice-row"><span>الجهاز</span><span>${i.deviceName} — ${i.mode}</span></div>
    ${i.sessionType==='match'?`<div class="invoice-row"><span>نوع الجلسة</span><span>⚽ مباراة ${i.matchMins} دقيقة</span></div>`:''}
    <div class="invoice-row"><span>عدد المباريات</span><strong>${matchCountLabel(invoiceMatchCount(i))}</strong></div>
    <div class="invoice-row"><span>العميل</span><span>${i.customer||'—'}</span></div>
    <div class="invoice-row"><span>المدة الفعلية</span><span>${i.minutes} دقيقة</span></div>
    <div class="invoice-row"><span>رسوم اللعب والمباريات</span><span>${money(i.playTotal)} ج</span></div>
    <div class="invoice-row"><span>المشروبات فقط</span><span>${money(i.drinkTotal)} ج</span></div>
    <div class="invoice-total-row ${i.status==='voided'?'voided-total':''}"><span>الإجمالي</span><span>${money(i.total)} ج</span></div>
    ${i.status==='voided'?'<div class="invoice-void-note">⛔ فاتورة ملغاة — محفوظة للمراجعة ولا تُحتسب ضمن الإيراد أو الربح.</div>':''}
    <div class="row invoice-actions"><button onclick="printInvoice('${i.id}')">🖨 طباعة</button><button class="gray" onclick="closeM();show('Dashboard')">الرئيسية</button>${canCorrectInvoice()&&i.status!=='voided'?`<button class="btn-warn" onclick="invoiceCorrectionModal('${i.id}')">✏ تصحيح</button><button class="danger" onclick="voidInvoiceModal('${i.id}')">إلغاء</button>`:''}<button class="gray" onclick="closeM()">إغلاق</button></div>`);
}
function invoiceCorrectionModal(iid){
  if(!canCorrectInvoice())return showNotice('ليست لديك صلاحية تصحيح الفواتير.','danger');
  const i=state.invoices.find(x=>x.id===iid);if(!i)return;
  modal(`<div class="big">✏ تصحيح موثّق — فاتورة ${invNo(i)}</div><div class="settings-note">يمكن كتابة ملاحظة اختيارية للتوضيح. سيتم حفظ القيم القديمة والجديدة واسم المستخدم والوقت في سجل غير قابل للحذف.</div>
  <div class="grid g2"><div class="col"><label>رسوم اللعب والمباريات</label><input id="corrPlay" type="number" value="${money(i.playTotal)}"></div><div class="col"><label>طريقة الدفع</label><select id="corrPayment"><option ${i.payment==='Cash'?'selected':''}>Cash</option><option ${i.payment==='Card'?'selected':''}>Card</option><option ${i.payment==='Wallet'?'selected':''}>Wallet</option></select></div></div>
  <div class="big" style="font-size:15px;margin:16px 0 8px">بنود الفاتورة</div><div id="corrItems" class="compact-list">${(i.items||[]).map(x=>correctionItemRow(x)).join('')}</div><button class="gray" onclick="addCorrectionItemRow()">➕ إضافة بند</button>
  <div class="col mt"><label>ملاحظة التصحيح (اختياري)</label><textarea id="corrReason" rows="2" placeholder="اختياري — مثال: تصحيح كمية مشروب تم تسجيلها بالخطأ"></textarea></div>
  <br><div class="row"><button class="ok" onclick="saveInvoiceCorrection('${iid}')">💾 حفظ التصحيح</button><button class="gray" onclick="showInv('${iid}')">إلغاء</button></div>`);
}
function correctionItemRow(x={id:'',name:'',price:0,qty:1,type:'drink'}){const t=x.type||x.itemType||x.item_type||(String(x.name||'').trim().startsWith('مباراة')?'match':'drink');return `<div class="compact-line corr-item" data-id="${esc(x.id||'')}" data-type="${esc(t)}"><input class="ci-name" value="${esc(x.name||'')}" placeholder="الصنف"><input class="ci-price" type="number" value="${Number(x.price)||0}" placeholder="السعر"><input class="ci-qty" type="number" value="${Number(x.qty)||1}" placeholder="الكمية"><span class="badge ${t==='match'?'b-busy':'b-ok'}">${t==='match'?'مباراة':'مشروب'}</span><button class="danger" onclick="this.parentElement.remove()">حذف</button></div>`}
function addCorrectionItemRow(){document.getElementById('corrItems').insertAdjacentHTML('beforeend',correctionItemRow())}
function correctedItemsFromForm(){return [...document.querySelectorAll('.corr-item')].map((r,n)=>({id:r.dataset.id||id(),type:r.dataset.type||'drink',item_type:r.dataset.type||'drink',name:r.querySelector('.ci-name').value.trim()||'Item',price:+r.querySelector('.ci-price').value||0,qty:+r.querySelector('.ci-qty').value||1}));}
async function saveInvoiceCorrection(iid){
  const i=state.invoices.find(x=>x.id===iid), reason=val('corrReason').trim(), items=correctedItemsFromForm(), play=+val('corrPlay')||0, payment=val('corrPayment')||'Cash';
  if(st().mode==='secure_cloud'){
    try{await rpc('ps_correct_invoice',{p_business:st().businessId,p_invoice_id:iid,p_reason:reason,p_play_total:play,p_payment_method:payment,p_status:'completed',p_items:items.map(x=>({id:x.id,product_id:x.productId||null,name:x.name,price:x.price,qty:x.qty,item_type:x.type||x.item_type||'drink'}))});await loadCloud(true);showNotice('تم حفظ التصحيح وتسجيله باسم المستخدم ✓','success');showInv(iid);}catch(e){showNotice('تعذر التصحيح: '+e.message,'danger')}return;
  }
  const before=JSON.parse(JSON.stringify(i));i.items=items;i.playTotal=play;i.drinkTotal=nonMatchItemsTotal(items);i.total=i.playTotal+i.drinkTotal;i.payment=payment;i.correctionSeq=(i.correctionSeq||0)+1;i.correctedAt=new Date().toISOString();i.correctedByLabel=user.username;i.correctionReason=reason;audit('INVOICE_CORRECT','invoice',iid,'تصحيح فاتورة '+invNo(i)+(reason?' — السبب: '+reason:''),{before,after:i});save();showInv(iid);
}
function voidInvoiceModal(iid){
  if(!canCorrectInvoice())return showNotice('ليست لديك صلاحية إلغاء الفواتير.','danger');
  const i=state.invoices.find(x=>x.id===iid);if(!i||i.status==='voided')return;
  modal(`<div class="big">⛔ إلغاء موثّق — فاتورة ${invNo(i)}</div>
    <div class="settings-note" style="border-color:rgba(255,61,87,.34);background:rgba(255,61,87,.07)">
      الإلغاء لا يحذف الفاتورة. ستظل محفوظة في السجل للمراجعة، ولن تدخل في الإيراد بعد الإلغاء.
    </div>
    <div class="invoice-row"><span>الإجمالي الحالي</span><strong>${money(i.total)} ج</strong></div>
    <div class="invoice-row"><span>أنشأ الفاتورة</span><strong>${esc(invActor(i))}</strong></div>
    <div class="col mt"><label>ملاحظة الإلغاء (اختياري)</label><textarea id="voidReason" rows="3" placeholder="اختياري — مثال: تم إنشاء الفاتورة بالخطأ أو تم إلغاء الجلسة بناءً على توجيه المالك"></textarea></div>
    <br><div class="row"><button class="danger" onclick="confirmVoidInvoice('${iid}')">⛔ تأكيد الإلغاء وتسجيله</button><button class="gray" onclick="showInv('${iid}')">رجوع</button></div>`);
}
async function confirmVoidInvoice(iid){
  if(!canCorrectInvoice())return;
  const i=state.invoices.find(x=>x.id===iid), reason=val('voidReason').trim();
  if(!i||i.status==='voided')return;
  if(st().mode==='secure_cloud'){try{await rpc('ps_correct_invoice',{p_business:st().businessId,p_invoice_id:iid,p_reason:reason,p_play_total:i.playTotal,p_payment_method:i.payment||'Cash',p_status:'voided',p_items:(i.items||[]).map(x=>({id:x.id,product_id:x.productId||null,name:x.name,price:x.price,qty:x.qty,item_type:x.type||x.item_type||'drink'}))});await loadCloud(true);showNotice('تم إلغاء الفاتورة مع حفظ سجل المراجعة ✓','success');showInv(iid);}catch(e){showNotice('تعذر إلغاء الفاتورة: '+e.message,'danger')}return;}
  const before=JSON.parse(JSON.stringify(i));i.status='voided';i.correctionSeq=(i.correctionSeq||0)+1;i.correctedAt=new Date().toISOString();i.correctedByLabel=user.username;i.correctionReason=reason;audit('INVOICE_VOID','invoice',iid,'إلغاء فاتورة '+invNo(i)+(reason?' — السبب: '+reason:''),{before,after:JSON.parse(JSON.stringify(i))});save();showNotice('تم إلغاء الفاتورة وتسجيل العملية ✓','success');showInv(iid);
}

function printInvoice(iid){
  const i=state.invoices.find(x=>x.id===iid); if(!i)return;
  const business=esc((state.profile&&state.profile.businessName)||'PS Cafe Manager');
  const phone=esc((state.profile&&state.profile.phone)||'');
  const address=esc((state.profile&&state.profile.address)||'');
  const matchRows=(i.items||[]).filter(isMatchLine).map(x=>`<tr><td>${esc(x.name)}</td><td>${x.qty}</td><td>${money(x.price)}</td><td>${money(x.price*x.qty)}</td></tr>`).join('');
  const drinkRows=(i.items||[]).filter(x=>!isMatchLine(x)).map(x=>`<tr><td>${esc(x.name)}</td><td>${x.qty}</td><td>${money(x.price)}</td><td>${money(x.price*x.qty)}</td></tr>`).join('');
  const w=window.open('','_blank','width=460,height=760');
  if(!w){showNotice('اسمح بفتح النوافذ المنبثقة للطباعة.', 'warn');return;}
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${invNo(i)}</title><style>
  *{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#111;margin:0;padding:14px;background:#fff}.receipt{max-width:760px;margin:0 auto;padding:12px}.head{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}.brand{font-size:24px;font-weight:900;margin:0}.sub{font-size:12px;color:#555;margin-top:3px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.box{border:1px solid #ddd;border-radius:8px;padding:8px;font-size:13px}.box span{display:block;color:#555;font-size:11px}.row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed #bbb;font-size:13px}h3{font-size:14px;margin:12px 0 6px;border-bottom:1px solid #111;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 4px;border-bottom:1px solid #ddd;text-align:right}th{background:#f5f5f5}.total{font-size:22px;font-weight:900;border-top:2px solid #111;margin-top:12px;padding-top:10px;display:flex;justify-content:space-between}.total.voided{color:#666;text-decoration:line-through}.void-note{margin-top:10px;padding:8px;border:1px solid #a00;color:#a00;font-weight:700;font-size:12px}.actions{text-align:center;margin:14px 0}button{padding:9px 18px;border:0;background:#155eef;color:#fff;border-radius:6px;font-weight:700}.foot{text-align:center;color:#777;font-size:11px;margin-top:14px;border-top:1px dashed #bbb;padding-top:8px}@page{size:auto;margin:10mm}@media print{.actions{display:none}.receipt{padding:0;max-width:none}}
  

</style></head><body><div class="receipt"><div class="head"><div class="brand">${business}</div>${phone?`<div class="sub">${phone}</div>`:''}${address?`<div class="sub">${address}</div>`:''}</div>
  <div class="meta"><div class="box"><span>الفاتورة</span><strong>${invNo(i)}</strong></div><div class="box"><span>التاريخ</span><strong>${esc(fmt(i.date))}</strong></div><div class="box"><span>الجهاز</span><strong>${esc(i.deviceName||'—')} — ${esc(i.mode||'')}</strong></div><div class="box"><span>العميل</span><strong>${esc(i.customer||'—')}</strong></div></div>
  <div class="row"><span>بدأ الجلسة</span><strong>${esc(i.startedBy||'—')}</strong></div><div class="row"><span>أنشأ الفاتورة</span><strong>${esc(invActor(i))}</strong></div><div class="row"><span>المدة</span><strong>${i.minutes||0} دقيقة</strong></div><div class="row"><span>عدد المباريات</span><strong>${matchCountLabel(invoiceMatchCount(i))}</strong></div>
  <h3>اللعب والمباريات</h3><div class="row"><span>رسوم الجلسة/اللعب</span><strong>${money(i.playTotal - matchItemsTotal(i.items||[]))} ج</strong></div>${matchRows?`<table><thead><tr><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${matchRows}</tbody></table>`:''}
  ${drinkRows?`<h3>المشروبات</h3><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${drinkRows}</tbody></table>`:''}
  <div class="row"><span>إجمالي المشروبات</span><strong>${money(i.drinkTotal)} ج</strong></div><div class="total ${i.status==='voided'?'voided':''}"><span>الإجمالي</span><span>${money(i.total)} ج</span></div>${i.status==='voided'?'<div class="void-note">فاتورة ملغاة — لا تُحتسب ضمن الإيراد.</div>':''}<div class="foot">شكرًا لزيارتكم</div></div><div class="actions"><button onclick="window.print()">طباعة / حفظ PDF</button></div></body></html>`);
  w.document.close();w.focus();
}

// ============================================================
// PRODUCTS
// ============================================================
function rProducts(){vProducts.innerHTML=`
  <div class="page-header">
    <div class="page-header-left"><div class="section-title">🥤 المشروبات والمنتجات</div><div class="page-subtitle muted">إدارة قائمة المشروبات والأسعار</div></div>
    <button class="ok" onclick="prodModal()">➕ إضافة منتج</button>
  </div>
  <div class="tw"><table><tr><th>الاسم</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th></th></tr>
  ${state.products.map(p=>`<tr><td><strong>${p.name}</strong></td><td>${money(p.price)} ج</td><td>${p.stock}</td><td>${p.active?'<span class="badge b-ok">فعال</span>':'<span class="badge b-bad">غير فعال</span>'}</td><td><button onclick="prodModal('${p.id}')">✏ تعديل</button></td></tr>`).join('')}
  </table></div>`
}
function prodModal(pid=''){let p=state.products.find(x=>x.id==pid)||{name:'',price:0,stock:0,active:true};
  modal(`<div class="big">${pid?'✏ تعديل منتج':'➕ إضافة منتج'}</div>
    <div class="grid g2">
      <div class="col"><label>الاسم</label><input id="pn" value="${esc(p.name)}" placeholder="اسم المنتج"></div>
      <div class="col"><label>السعر (جنيه)</label><input id="pp" type="number" value="${p.price}" placeholder="0.00"></div>
      <div class="col"><label>المخزون</label><input id="ps" type="number" value="${p.stock}" placeholder="0"></div>
      <div class="col"><label>الحالة</label><select id="pa"><option value="true" ${p.active?'selected':''}>✔ فعال</option><option value="false" ${!p.active?'selected':''}>✕ غير فعال</option></select></div>
    </div><br>
    <div class="row"><button class="ok" onclick="saveProd('${pid}')">💾 حفظ</button><button class="gray" onclick="closeM()">إلغاء</button></div>`);
}
async function saveProd(pid){let o={name:val('pn').trim(),price:+val('pp'),stock:+val('ps'),active:val('pa')==='true'}, p=state.products.find(x=>x.id==pid), newId=pid||id();if(!o.name)return showNotice('اكتب اسم المنتج.','danger');if(st().mode==='secure_cloud'){try{await rpc('ps_upsert_product',{p_business:st().businessId,p_id:newId,p_name:o.name,p_price:o.price,p_stock:o.stock,p_active:o.active,p_expected_updated_at:p?.cloudUpdatedAt||null});closeM();await loadCloud(true);showNotice('تم حفظ المنتج وتسجيل نوع التعديل ✓','success');}catch(e){showNotice('تعذر حفظ المنتج: '+e.message,'danger')}return;}if(pid){let before={name:p.name,price:p.price,stock:p.stock,active:p.active};Object.assign(p,o);let change=(before.price!==o.price?'تعديل سعر منتج':(before.stock!==o.stock?'تعديل مخزون':'تعديل منتج'));audit('PRODUCT_EDIT','product',pid,change+': '+o.name,{before,after:o});}else{state.products.push({id:newId,...o});audit('PRODUCT_ADD','product',newId,'إضافة منتج: '+o.name,{after:o});}closeM();save()}

// ============================================================
// DEVICES PAGE (with Add Device + Match Pricing editor)
// ============================================================
function rDevices(){vDevices.innerHTML=`
  <div class="page-header">
    <div class="page-header-left"><div class="section-title">🎮 الأجهزة والأسعار</div><div class="page-subtitle muted">إدارة أجهزة البلايستيشن والتسعيرة والمباريات</div></div>
    <button class="ok" onclick="addDeviceModal()">➕ إضافة جهاز</button>
  </div>
  <div class="tw"><table><tr><th>الجهاز</th><th>الحالة</th><th>Single ج/س</th><th>Multi ج/س</th><th>تسعير المباريات</th><th>تغيير الحالة</th><th></th></tr>
  ${state.devices.map(d=>`<tr>
    <td><input id="dn${d.id}" value="${esc(d.name)}" style="width:100px"></td>
    <td>${badge(d)}</td>
    <td><input id="ds${d.id}" type="number" value="${d.singleRate}" style="width:80px"></td>
    <td><input id="dm${d.id}" type="number" value="${d.multiRate}" style="width:80px"></td>
    <td><button onclick="editMatchPrices('${d.id}')">⚽ أسعار المباريات</button></td>
    <td><select id="dt${d.id}"><option value="available" ${d.status==='available'?'selected':''}>✔ متاح</option><option value="maintenance" ${d.status==='maintenance'?'selected':''}>🔧 صيانة</option><option value="busy" ${d.status==='busy'?'selected':''}>● مشغول</option></select></td>
    <td style="display:flex;gap:6px">
      <button class="ok" onclick="saveDev('${d.id}')">حفظ</button>
      <button class="danger" onclick="delDevice('${d.id}')">حذف</button>
    </td>
  </tr>`).join('')}
  </table></div>`
}

function addDeviceModal(){
  modal(`<div class="big">➕ إضافة جهاز جديد</div>
    <div class="grid g2">
      <div class="col"><label>اسم الجهاز</label><input id="nd_name" placeholder="مثال: PS 6"></div>
      <div class="col"><label>سعر Single (ج/ساعة)</label><input id="nd_single" type="number" value="60"></div>
      <div class="col"><label>سعر Multi (ج/ساعة)</label><input id="nd_multi" type="number" value="90"></div>
    </div><br>
    <div class="row"><button class="ok" onclick="saveNewDevice()">💾 إضافة</button><button class="gray" onclick="closeM()">إلغاء</button></div>`);
}
async function saveNewDevice(){
  let name=val('nd_name').trim();if(!name)return alert('اكتب اسم الجهاز');
  let newId='ps_'+id().slice(3,9), dev={id:newId,name,status:'available',singleRate:+val('nd_single')||60,multiRate:+val('nd_multi')||90,matchPrices:DEF_MATCH_PRICES.map(x=>({...x}))};
  if(st().mode==='secure_cloud'){try{await rpc('ps_upsert_device',{p_business:st().businessId,p_id:newId,p_name:name,p_single_rate:dev.singleRate,p_multi_rate:dev.multiRate,p_maintenance:false,p_active:true,p_match_prices:dev.matchPrices,p_expected_updated_at:null});closeM();await loadCloud(true);show('Devices');showNotice('تمت إضافة الجهاز وتسجيل الحركة ✓','success');}catch(e){showNotice('تعذر إضافة الجهاز: '+e.message,'danger')}return;}
  state.devices.push(dev);audit('DEVICE_ADD','device',newId,'إضافة جهاز: '+name,{singleRate:dev.singleRate,multiRate:dev.multiRate});closeM();save();show('Devices');
}
function delDevice(did){
  if(st().mode==='secure_cloud'){showNotice('في التشغيل السحابي لا نحذف الجهاز من السجل؛ استخدم الصيانة أو تعطيل الجهاز في تحديث الإدارة القادم.','warn');return;}
  if(sess(did))return alert('الجهاز عليه جلسة مفتوحة، أنهِ الجلسة أولاً');if(!confirm('حذف الجهاز؟'))return;
  const d=state.devices.find(x=>x.id===did);state.devices=state.devices.filter(d=>d.id!==did);audit('DEVICE_DELETE','device',did,'حذف جهاز: '+(d?.name||did),{});save();show('Devices');
}
async function saveDev(did){
  let d=state.devices.find(x=>x.id==did);if(sess(did)&&val('dt'+did)!=='busy')return alert('الجهاز عليه جلسة مفتوحة');
  const changed={name:val('dn'+did),singleRate:+val('ds'+did),multiRate:+val('dm'+did),status:val('dt'+did)};
  if(st().mode==='secure_cloud'){try{await rpc('ps_upsert_device',{p_business:st().businessId,p_id:did,p_name:changed.name,p_single_rate:changed.singleRate,p_multi_rate:changed.multiRate,p_maintenance:changed.status==='maintenance',p_active:true,p_match_prices:d.matchPrices||[],p_expected_updated_at:d.cloudUpdatedAt||null});await loadCloud(true);showNotice('تم حفظ الجهاز وتسجيل التعديل ✓','success');}catch(e){showNotice('تعذر حفظ الجهاز: '+e.message,'danger')}return;}
  const before={name:d.name,singleRate:d.singleRate,multiRate:d.multiRate,status:d.status};Object.assign(d,changed);audit('DEVICE_EDIT','device',did,'تعديل جهاز: '+d.name,{before,after:changed});save();
}

function editMatchPrices(did){
  let d=state.devices.find(x=>x.id==did);
  let prices=d.matchPrices||DEF_MATCH_PRICES.map(x=>({...x}));
  modal(`<div class="big">⚽ أسعار المباريات ${esc(d.name)}</div>
    <p class="muted small" style="margin-bottom:14px">اكتب أي مدد وأسعار تحتاجها، مثل 5 دقائق = 5 جنيه أو 10 دقائق = 10 جنيه. يمكن إضافة صفوف جديدة.</p>
    <div id="matchPriceRows" class="compact-list">${prices.map((p,i)=>matchPriceEditRow(p,i)).join('')}</div>
    <button class="gray" onclick="addMatchPriceEditRow()">➕ إضافة سعر مباراة</button>
    <br><div class="row"><button class="ok" onclick="saveMatchPrices('${did}')">💾 حفظ الأسعار</button><button class="gray" onclick="closeM()">إلغاء</button></div>`);
}
function matchPriceEditRow(p={},i=0){return `<div class="compact-line match-price-edit"><input class="mp-mins" type="number" value="${Number(p.mins)||5}" placeholder="الدقائق"><input class="mp-single" type="number" value="${Number(p.single)||0}" placeholder="Single"><input class="mp-multi" type="number" value="${Number(p.multi)||0}" placeholder="Multi"><button class="danger" onclick="this.parentElement.remove()">حذف</button></div>`}
function addMatchPriceEditRow(){document.getElementById('matchPriceRows').insertAdjacentHTML('beforeend',matchPriceEditRow({mins:5,single:5,multi:10}))}
async function saveMatchPrices(did){
  let d=state.devices.find(x=>x.id==did);
  let prices=[...document.querySelectorAll('.match-price-edit')].map(r=>({mins:+r.querySelector('.mp-mins').value||0,single:+r.querySelector('.mp-single').value||0,multi:+r.querySelector('.mp-multi').value||0})).filter(x=>x.mins>0&&(x.single>0||x.multi>0));
  if(!prices.length)return showNotice('أضف سعر مباراة واحد على الأقل.','danger');
  if(st().mode==='secure_cloud'){
    try{await rpc('ps_upsert_device',{p_business:st().businessId,p_id:did,p_name:d.name,p_single_rate:d.singleRate,p_multi_rate:d.multiRate,p_maintenance:d.status==='maintenance',p_active:true,p_match_prices:prices,p_expected_updated_at:d.cloudUpdatedAt||null});closeM();await loadCloud(true);showNotice('تم حفظ أسعار المباريات وتسجيل الحركة ✓','success');}catch(e){showNotice('تعذر حفظ الأسعار: '+e.message,'danger')}
    return;
  }
  const before=JSON.parse(JSON.stringify(d.matchPrices||[]));d.matchPrices=prices;audit('DEVICE_PRICE_EDIT','device',did,'تعديل أسعار المباريات: '+d.name,{before,after:d.matchPrices});closeM();save();
}

// ============================================================
// INVOICES
// ============================================================

let invoiceFilters={q:'',range:'today',status:'all'};
function setInvoiceFilter(k,v){invoiceFilters[k]=v;rInvoices();}
function invoiceInRange(i,range){
  const d=localBusinessDate(i.date), t=today();
  if(range==='all')return true;
  if(range==='today')return d===t;
  const now=new Date();
  if(range==='yesterday'){
    const y=new Date(now);y.setDate(y.getDate()-1);return d===localBusinessDate(y);
  }
  if(range==='week'){
    const dt=new Date(i.date);return (now-dt)<=7*24*60*60*1000;
  }
  return true;
}
function invoiceFilteredList(){
  const q=(invoiceFilters.q||'').trim().toLowerCase();
  return [...state.invoices].reverse().filter(i=>{
    if(!invoiceInRange(i,invoiceFilters.range))return false;
    if(invoiceFilters.status==='voided'&&i.status!=='voided')return false;
    if(invoiceFilters.status==='corrected'&&!i.correctionSeq)return false;
    if(invoiceFilters.status==='completed'&&(i.status==='voided'||i.correctionSeq))return false;
    if(q){const blob=[i.no,i.deviceName,i.customer,i.total,invoiceStatusText(i),matchCountLabel(invoiceMatchCount(i))].join(' ').toLowerCase();if(!blob.includes(q))return false;}
    return true;
  });
}

function rInvoices(){
  const list=invoiceFilteredList();
  const visibleTotal=list.filter(i=>i.status!=='voided').reduce((a,i)=>a+(+i.total||0),0);
  const visibleMatches=list.reduce((a,i)=>a+invoiceMatchCount(i),0);
  vInvoices.innerHTML=`
  <div class="page-header">
    <div class="page-header-left"><div class="section-title">🧾 الفواتير</div><div class="page-subtitle muted">عرض سريع ومنظم للفواتير مع بحث وفلاتر مناسبة للموبايل</div></div>
  </div>
  <div class="invoice-toolbar">
    <input placeholder="بحث: رقم، جهاز، عميل، مبلغ..." value="${esc(invoiceFilters.q)}" oninput="setInvoiceFilter('q',this.value)">
    <select onchange="setInvoiceFilter('range',this.value)">
      <option value="today" ${invoiceFilters.range==='today'?'selected':''}>اليوم</option>
      <option value="yesterday" ${invoiceFilters.range==='yesterday'?'selected':''}>أمس</option>
      <option value="week" ${invoiceFilters.range==='week'?'selected':''}>آخر 7 أيام</option>
      <option value="all" ${invoiceFilters.range==='all'?'selected':''}>كل الفواتير</option>
    </select>
    <select onchange="setInvoiceFilter('status',this.value)">
      <option value="all" ${invoiceFilters.status==='all'?'selected':''}>كل الحالات</option>
      <option value="completed" ${invoiceFilters.status==='completed'?'selected':''}>مكتملة فقط</option>
      <option value="corrected" ${invoiceFilters.status==='corrected'?'selected':''}>مصححة</option>
      <option value="voided" ${invoiceFilters.status==='voided'?'selected':''}>ملغاة</option>
    </select>
  </div>
  <div class="ops-summary" style="margin-bottom:14px">
    <div class="ops-card green"><div class="label">إجمالي المعروض</div><div class="num">${money(visibleTotal)} ج</div><div class="hint">لا يشمل الملغي</div></div>
    <div class="ops-card purple"><div class="label">عدد المباريات</div><div class="num">${visibleMatches}</div><div class="hint">حسب الفلتر الحالي</div></div>
    <div class="ops-card"><div class="label">عدد الفواتير</div><div class="num">${list.length}</div><div class="hint">كل الحالات المعروضة</div></div>
    <div class="ops-card orange"><div class="label">ملغاة/مصححة</div><div class="num">${list.filter(i=>i.status==='voided'||i.correctionSeq).length}</div><div class="hint">للمراجعة فقط</div></div>
  </div>
  ${!list.length?'<div class="invoice-empty">لا توجد فواتير مطابقة للفلتر الحالي.</div>':`
  <div class="tw invoice-table-wrap"><table><tr><th>#</th><th>التاريخ</th><th>الجهاز</th><th>النوع</th><th>عدد المباريات</th><th>الإجمالي</th><th>الحالة</th><th></th></tr>
  ${list.map(i=>`<tr>
    <td><strong>${invNo(i)}</strong></td><td>${fmt(i.date)}</td><td>${esc(i.deviceName||'—')}</td>
    <td>${invoiceMatchCount(i)>0?`<span class="match-badge">⚽ ${matchCountLabel(invoiceMatchCount(i))}</span>`:'<span class="badge b-ok">مفتوحة</span>'}</td>
    <td><strong>${invoiceMatchCount(i)>0?matchCountLabel(invoiceMatchCount(i)):'—'}</strong></td>
    <td><strong style="color:${i.status==='voided'?'var(--text-muted)':'var(--green)'};${i.status==='voided'?'text-decoration:line-through;':''}">${money(i.total)} ج</strong></td>
    <td>${i.status==='voided'?'<span class="badge b-bad">ملغاة</span>':(i.correctionSeq?'<span class="badge b-busy">مصححة</span>':'<span class="badge b-ok">مكتملة</span>')}</td>
    <td><button class="gray" onclick="invoiceActionsModal('${i.id}')">⋯ إجراءات</button></td>
  </tr>`).join('')}
  </table></div>
  <div class="invoice-cards">
    ${list.map(i=>`<div class="invoice-mobile-card">
      <div class="head"><div><strong>${invNo(i)}</strong><div class="small muted">${fmt(i.date)}</div></div><div class="total" style="${i.status==='voided'?'color:var(--text-muted);text-decoration:line-through;':''}">${money(i.total)} ج</div></div>
      <div>${i.status==='voided'?'<span class="badge b-bad">ملغاة</span>':(i.correctionSeq?'<span class="badge b-busy">مصححة</span>':'<span class="badge b-ok">مكتملة</span>')} ${invoiceMatchCount(i)>0?`<span class="match-badge">⚽ ${matchCountLabel(invoiceMatchCount(i))}</span>`:'<span class="badge b-ok">مفتوحة</span>'}</div>
      <div class="meta"><div>الجهاز<br><strong>${esc(i.deviceName||'—')}</strong></div><div>العميل<br><strong>${esc(i.customer||'—')}</strong></div><div>اللعب<br><strong>${money(i.playTotal)} ج</strong></div><div>المشروبات<br><strong>${money(i.drinkTotal)} ج</strong></div></div>
      <button class="gray" style="width:100%" onclick="invoiceActionsModal('${i.id}')">⋯ إجراءات الفاتورة</button>
    </div>`).join('')}
  </div>`}`;
}

// ============================================================
// EXPENSES
// ============================================================
function rExpenses(){vExpenses.innerHTML=`
  <div class="page-header">
    <div class="page-header-left"><div class="section-title">💸 المصروفات</div><div class="page-subtitle muted">تسجيل المصروفات والإلغاءات الموثقة</div></div>
    <button class="ok" onclick="expModal()">➕ إضافة مصروف</button>
  </div>
  <div class="tw"><table><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th>المبلغ</th><th>الحالة</th><th></th></tr>
  ${state.expenses.map(e=>`<tr><td>${e.date}</td><td>${esc(e.type)}</td><td>${esc(e.note||'')}</td><td><strong style="color:${e.voidedAt?'var(--text-muted)':'var(--red)'};${e.voidedAt?'text-decoration:line-through;':''}">${money(e.amount)} ج</strong></td><td>${e.voidedAt?'<span class="badge b-bad">ملغى</span>':'<span class="badge b-ok">فعال</span>'}</td><td>${owner()&&!e.voidedAt?`<button class="danger" onclick="voidExpenseModal('${e.id}')">إلغاء موثّق</button>`:''}</td></tr>`).join('')}
  </table></div>`
}
function expModal(){modal(`<div class="big">➕ إضافة مصروف</div>
  <div class="grid g2">
    <div class="col"><label>التاريخ</label><input id="ed" type="date" value="${today()}"></div>
    <div class="col"><label>النوع</label><input id="et" placeholder="مثال: إيجار، كهرباء"></div>
    <div class="col"><label>المبلغ</label><input id="ea" type="number" placeholder="0.00"></div>
    <div class="col"><label>البيان</label><input id="en" placeholder="تفاصيل إضافية"></div>
  </div><br>
  <div class="row"><button class="ok" onclick="saveExp()">💾 حفظ</button><button class="gray" onclick="closeM()">إلغاء</button></div>`)}
async function saveExp(){
  const expense={id:id(),date:val('ed'),type:val('et').trim(),amount:+val('ea'),note:val('en'),createdBy:user.username,createdAt:new Date().toISOString(),voidedAt:null,voidReason:''};
  if(!expense.type)return showNotice('اكتب نوع المصروف.','danger');
  if(expense.amount<0)return showNotice('قيمة المصروف غير صحيحة.','danger');
  if(st().mode==='secure_cloud'){try{await rpc('ps_add_expense',{p_business:st().businessId,p_id:expense.id,p_date:expense.date,p_type:expense.type,p_amount:expense.amount,p_note:expense.note});closeM();await loadCloud(true);showNotice('تم تسجيل المصروف في سجل الحركات ✓','success');}catch(e){showNotice('تعذر حفظ المصروف: '+e.message,'danger')}return;}
  state.expenses.push(expense);audit('EXPENSE_ADD','expense',expense.id,'إضافة مصروف: '+expense.type,{amount:expense.amount,note:expense.note});closeM();save();
}
function voidExpenseModal(idv){
  if(!owner())return showNotice('إلغاء المصروفات متاح لصاحب النشاط فقط.','danger');
  const e=state.expenses.find(x=>x.id===idv); if(!e||e.voidedAt)return;
  modal(`<div class="big">⛔ إلغاء مصروف موثّق</div>
    <div class="settings-note" style="border-color:rgba(255,61,87,.34);background:rgba(255,61,87,.07)">الإلغاء لا يحذف المصروف. سيظل محفوظًا في السجل ولن يدخل في تقارير المصروفات الفعلية.</div>
    <div class="invoice-row"><span>النوع</span><strong>${esc(e.type)}</strong></div>
    <div class="invoice-row"><span>القيمة</span><strong>${money(e.amount)} ج</strong></div>
    <div class="col mt"><label>ملاحظة الإلغاء (اختياري)</label><textarea id="voidExpReason" rows="3" placeholder="اختياري — مثال: تم تسجيل المصروف بالخطأ"></textarea></div>
    <br><div class="row"><button class="danger" onclick="confirmVoidExpense('${idv}')">⛔ تأكيد الإلغاء وتسجيله</button><button class="gray" onclick="show('Expenses');closeM()">رجوع</button></div>`);
}
async function confirmVoidExpense(idv){
  if(!owner())return; const e=state.expenses.find(x=>x.id===idv), reason=val('voidExpReason').trim(); if(!e||e.voidedAt)return;
  if(st().mode==='secure_cloud'){try{await rpc('ps_void_expense',{p_business:st().businessId,p_id:idv,p_reason:reason});closeM();await loadCloud(true);showNotice('تم إلغاء المصروف مع تسجيل العملية ✓','success');}catch(err){showNotice('تعذر إلغاء المصروف: '+err.message,'danger')}return;}
  e.voidedAt=new Date().toISOString();e.voidedBy=user.username;e.voidReason=reason;audit('EXPENSE_VOID','expense',idv,'إلغاء مصروف: '+e.type+(reason?' — السبب: '+reason:''),{amount:e.amount,reason});closeM();save();
}

// ============================================================
// REPORTS
// ============================================================
function todayReviewStats(){
  const ti=state.invoices.filter(i=>localBusinessDate(i.date)==today()&&i.status!=='voided');
  const te=state.expenses.filter(e=>e.date==today()&&!e.voidedAt);
  const play=ti.reduce((a,i)=>a+(+i.playTotal||0),0), drinks=ti.reduce((a,i)=>a+(+i.drinkTotal||0),0), total=ti.reduce((a,i)=>a+(+i.total||0),0);
  const expenses=te.reduce((a,e)=>a+(+e.amount||0),0), matches=ti.reduce((a,i)=>a+invoiceMatchCount(i),0);
  return {invoices:ti,expenses:te,play,drinks,total,expensesTotal:expenses,net:total-expenses,matches};
}
function printDailyReview(){
  const s=todayReviewStats(), business=esc((state.profile&&state.profile.businessName)||'PS Cafe Manager');
  const w=window.open('','_blank','width=620,height=780');
  if(!w){showNotice('اسمح بفتح النوافذ المنبثقة للطباعة.','warn');return;}
  const expLine=owner()?`<div class="row"><span>المصروفات</span><strong>${money(s.expensesTotal)} ج</strong></div><div class="total"><span>صافي اليوم</span><span>${money(s.net)} ج</span></div>`:'';
  const invoiceRows=s.invoices.slice(-30).map(i=>`<tr><td>${invNo(i)}</td><td>${esc(i.deviceName||'—')}</td><td>${money(i.playTotal)}</td><td>${money(i.drinkTotal)}</td><td>${money(i.total)}</td></tr>`).join('');
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير اليوم</title><style>*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;padding:16px;color:#111}.sheet{max-width:820px;margin:0 auto}.head{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}h1{margin:0;font-size:23px}.sub{color:#555;font-size:12px;margin-top:4px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.k{border:1px solid #ddd;border-radius:8px;padding:9px}.k span{display:block;color:#555;font-size:11px}.k b{font-size:18px}.row,.total{display:flex;justify-content:space-between;border-bottom:1px dashed #bbb;padding:8px 0}.total{border-top:2px solid #111;border-bottom:0;font-size:20px;font-weight:900;margin-top:8px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:right}th{background:#f5f5f5}.actions{text-align:center;margin:16px 0}button{padding:9px 18px;border:0;background:#155eef;color:#fff;border-radius:6px;font-weight:700}@page{size:auto;margin:10mm}@media print{.actions{display:none}}

</style></head><body><div class="sheet"><div class="head"><h1>${business}</h1><div class="sub">تقرير اليوم — ${today()}</div></div><div class="grid"><div class="k"><span>إجمالي اليوم</span><b>${money(s.total)} ج</b></div><div class="k"><span>عدد الفواتير</span><b>${s.invoices.length}</b></div><div class="k"><span>اللعب</span><b>${money(s.play)} ج</b></div><div class="k"><span>المشروبات</span><b>${money(s.drinks)} ج</b></div></div><div class="row"><span>عدد المباريات</span><strong>${s.matches}</strong></div>${expLine}<table><thead><tr><th>الفاتورة</th><th>الجهاز</th><th>اللعب</th><th>مشروبات</th><th>الإجمالي</th></tr></thead><tbody>${invoiceRows||'<tr><td colspan="5">لا توجد فواتير اليوم</td></tr>'}</tbody></table></div><div class="actions"><button onclick="window.print()">طباعة / حفظ PDF</button></div></body></html>`);
  w.document.close();w.focus();
}
function rReports(){
  const s=todayReviewStats();
  vReports.innerHTML=`
    <div class="page-header">
      <div class="page-header-left"><div class="section-title">📊 تقرير اليوم</div><div class="page-subtitle muted">${today()}</div></div>
      <button class="gray" onclick="printDailyReview()">🖨 طباعة التقرير</button>
    </div>
    <div class="grid g3">
      <div class="kpi kpi-green"><div class="kpi-label">إجمالي الإيراد</div><b>${money(s.total)} ج</b></div>
      <div class="kpi"><div class="kpi-label">اللعب والمباريات</div><b>${money(s.play)} ج</b></div>
      <div class="kpi"><div class="kpi-label">المشروبات</div><b>${money(s.drinks)} ج</b></div>
      <div class="kpi kpi-orange"><div class="kpi-label">عدد الفواتير</div><b>${s.invoices.length}</b></div>
      <div class="kpi" style="--kpi-c:var(--purple)"><div class="kpi-label">المباريات</div><b style="color:#a78bfa">${s.matches}</b></div>
      ${owner()?`<div class="kpi kpi-red"><div class="kpi-label">المصروفات</div><b>${money(s.expensesTotal)} ج</b></div><div class="kpi kpi-${s.net>=0?'green':'red'}"><div class="kpi-label">صافي اليوم</div><b>${money(s.net)} ج</b></div>`:''}
    </div>`;
}


// ============================================================
// SHIFT HANDOVER — V6.4.2 Flexible Shift Handover
// ============================================================
function actorLabel(){return user?.username||'User'}
function invActorLabel(i){return invActor(i)||i.creator_label||i.issuedBy||i.user||''}
function shiftLabelFromRecord(x){return x.closedByLabel||x.closed_by_label||x.cashierLabel||x.actor||''}
function shiftClosedAt(x){return x.closedAt||x.closed_at||x.date||x.created_at||''}
function shiftStartFor(label){
  const rows=(state.shiftClosures||[]).filter(x=>shiftLabelFromRecord(x)===label).sort((a,b)=>new Date(shiftClosedAt(b))-new Date(shiftClosedAt(a)));
  if(rows[0])return shiftClosedAt(rows[0]);
  const first=(state.invoices||[]).filter(i=>i.status!=='voided'&&invActorLabel(i)===label).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  return first?first.date:new Date(new Date().setHours(0,0,0,0)).toISOString();
}
function shiftSummary(label=actorLabel(),fromIso=null,toIso=null){
  const from=fromIso||shiftStartFor(label), to=toIso||new Date().toISOString();
  const invoices=(state.invoices||[]).filter(i=>i.status!=='voided'&&invActorLabel(i)===label&&new Date(i.date)>new Date(from)&&new Date(i.date)<=new Date(to)).sort((a,b)=>Number(a.no||0)-Number(b.no||0));
  const playTotal=invoices.reduce((a,i)=>a+(+i.playTotal||0),0);
  const drinkTotal=invoices.reduce((a,i)=>a+(+i.drinkTotal||0),0);
  const total=invoices.reduce((a,i)=>a+(+i.total||0),0);
  return {label,from,to,invoices,invoiceCount:invoices.length,firstInvoiceNo:invoices[0]?.no||0,lastInvoiceNo:invoices[invoices.length-1]?.no||0,playTotal,drinkTotal,total};
}
function cashierShiftWidget(){
  if(!user)return '';
  const s=shiftSummary(actorLabel());
  const last=[...(state.invoices||[])].filter(i=>invActorLabel(i)===actorLabel()).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  return `<div class="shift-hero">
    <div class="page-header" style="margin-bottom:0">
      <div><div class="section-title">🔁 وردية ${esc(actorLabel())}</div><div class="page-subtitle">من آخر تسليم حتى الآن</div></div>
      <button class="ok" onclick="show('Shifts')">الوردية</button>
    </div>
    <div class="cashier-mini-grid">
      <div class="cashier-mini-card"><span class="mini-label">فواتير الوردية</span><b>${s.invoiceCount}</b></div>
      <div class="cashier-mini-card"><span class="mini-label">إجمالي الوردية</span><b>${money(s.total)} ج</b></div>
      <div class="cashier-mini-card"><span class="mini-label">اللعب والمباريات</span><b>${money(s.playTotal)} ج</b></div>
      <div class="cashier-mini-card"><span class="mini-label">المشروبات</span><b>${money(s.drinkTotal)} ج</b></div>
    </div>
    ${last?`<div class="last-invoice-card"><span>آخر فاتورة: <strong>${invNo(last)}</strong> — ${money(last.total)} ج</span><button onclick="showInv('${last.id}')">عرض / طباعة آخر فاتورة</button></div>`:''}
    <div class="shift-actions">
      <button class="ok" onclick="shiftCloseModal()">✅ تسليم وردية</button>
      <button onclick="printCurrentShift()">🖨 طباعة</button>
      <button class="cashier-update-btn" onclick="cashierSafeUpdate()">↻ تحديث</button>
    </div>
  </div>`;
}
function cashierSafeUpdate(){ clearAppCacheAndReload(); }
function rShifts(){
  if(!user){vShifts.innerHTML='';return;}
  const label=actorLabel(), s=shiftSummary(label);
  const rows=(state.shiftClosures||[]).slice().sort((a,b)=>new Date(shiftClosedAt(b))-new Date(shiftClosedAt(a)));
  const visible=(owner()||manager())?rows:rows.filter(x=>shiftLabelFromRecord(x)===label);
  vShifts.innerHTML=`<div class="page-header"><div><div class="section-title">🔁 تسليم الورديات</div><div class="page-subtitle muted">تسليم مرن بأي توقيت — بدون حذف أو تصفير الفواتير</div></div><button class="ok" onclick="shiftCloseModal()">✅ تسليم وردية الآن</button></div>
  <div class="shift-hero">
    <div class="big" style="font-size:16px">الوردية الحالية: ${esc(label)}</div>
    <div class="shift-period"><span>من: ${shortTime(s.from)}</span><span>إلى الآن: ${shortTime(s.to)}</span><span>أول فاتورة: ${s.firstInvoiceNo?('#'+s.firstInvoiceNo):'—'}</span><span>آخر فاتورة: ${s.lastInvoiceNo?('#'+s.lastInvoiceNo):'—'}</span></div>
    <div class="cashier-mini-grid">
      <div class="cashier-mini-card"><span class="mini-label">عدد الفواتير</span><b>${s.invoiceCount}</b></div>
      <div class="cashier-mini-card"><span class="mini-label">اللعب والمباريات</span><b>${money(s.playTotal)} ج</b></div>
      <div class="cashier-mini-card"><span class="mini-label">المشروبات</span><b>${money(s.drinkTotal)} ج</b></div>
      <div class="cashier-mini-card"><span class="mini-label">الإجمالي</span><b>${money(s.total)} ج</b></div>
    </div>
    <div class="shift-actions"><button class="ok" onclick="shiftCloseModal()">✅ تسليم وتصفير عداد الوردية</button><button onclick="printCurrentShift()">🖨 طباعة الوردية</button><button class="gray" onclick="cashierSafeUpdate()">↻ تحديث</button></div>
  </div>
  <div class="section-title mb">سجل التسليمات</div>
  <div class="tw"><table><tr><th>وقت التسليم</th><th>الكاشير</th><th>الفترة</th><th>فواتير</th><th>الإجمالي</th><th>الفعلي</th><th>فرق</th><th></th></tr>${visible.length?visible.map(x=>`<tr><td>${shortTime(shiftClosedAt(x))}</td><td><strong>${esc(shiftLabelFromRecord(x))}</strong></td><td>${shortTime(x.openedAt||x.opened_at)} → ${shortTime(shiftClosedAt(x))}</td><td>${x.invoiceCount||x.invoice_count||0}</td><td><strong>${money(x.total||0)} ج</strong></td><td>${money(x.actualCash||x.actual_cash||0)} ج</td><td>${money(x.difference||0)} ج</td><td><button onclick="showShiftClosure('${x.id}')">عرض</button></td></tr>`).join(''):'<tr><td colspan="8" class="muted">لا توجد تسليمات وردية بعد.</td></tr>'}</table></div>`;
}
function shiftCloseModal(){
  const s=shiftSummary(actorLabel());
  modal(`<div class="big">✅ تسليم وردية الآن</div>
  <div class="settings-note">سيتم حفظ نقطة تسليم جديدة. الفواتير لا تُحذف ولا تتغير؛ فقط الوردية القادمة ستبدأ من بعد هذه اللحظة.</div>
  <div class="invoice-row"><span>الفترة</span><strong>${shortTime(s.from)} → الآن</strong></div>
  <div class="invoice-row"><span>عدد الفواتير</span><strong>${s.invoiceCount}</strong></div>
  <div class="invoice-row"><span>إجمالي النظام</span><strong>${money(s.total)} ج</strong></div>
  <div class="grid g2 mt">
    <div class="col"><label>المبلغ الفعلي المسلم</label><input id="shiftActual" type="number" value="${money(s.total)}"></div>
    <div class="col"><label>ملاحظات التسليم</label><input id="shiftNotes" placeholder="اختياري"></div>
  </div>
  <br><div class="row"><button class="ok" onclick="closeShiftNow()">✅ تأكيد التسليم</button><button onclick="printCurrentShift()">🖨 طباعة قبل الحفظ</button><button class="gray" onclick="closeM()">إلغاء</button></div>`);
}
async function closeShiftNow(){
  const s=shiftSummary(actorLabel());
  const actual=+val('shiftActual')||0;
  const closure={id:id(),openedAt:s.from,closedAt:new Date().toISOString(),closedBy:user.cloud?user.id:(user.id||''),closedByLabel:s.label,invoiceCount:s.invoiceCount,firstInvoiceNo:s.firstInvoiceNo,lastInvoiceNo:s.lastInvoiceNo,playTotal:+s.playTotal.toFixed(2),drinkTotal:+s.drinkTotal.toFixed(2),total:+s.total.toFixed(2),actualCash:+actual.toFixed(2),difference:+(actual-s.total).toFixed(2),notes:val('shiftNotes')||'',createdAt:new Date().toISOString(),cloudSynced:false};
  if(st().mode==='secure_cloud'){
    try{
      const row={business_id:st().businessId,id:closure.id,opened_at:closure.openedAt,closed_at:closure.closedAt,closed_by:st().session?.userId||user.id,closed_by_label:closure.closedByLabel,invoice_count:closure.invoiceCount,first_invoice_no:closure.firstInvoiceNo||null,last_invoice_no:closure.lastInvoiceNo||null,play_total:closure.playTotal,drink_total:closure.drinkTotal,total:closure.total,actual_cash:closure.actualCash,difference:closure.difference,notes:closure.notes,created_at:closure.createdAt};
      await req('POST','ps_shift_closures',[row],'return=minimal');
      try{await rpc('ps_record_client_event',{p_business:st().businessId,p_action:'SHIFT_CLOSE',p_summary:'تسليم وردية '+closure.closedByLabel+' بإجمالي '+money(closure.total)+' ج'});}catch(_e){}
      closeM();await loadCloud(true);showNotice('تم تسليم الوردية وبدء عداد وردية جديد ✓','success');show('Shifts');
    }catch(e){showNotice('تعذر تسليم الوردية: '+e.message,'danger')}
    return;
  }
  if(!Array.isArray(state.shiftClosures))state.shiftClosures=[];
  state.shiftClosures.unshift(closure);
  audit('SHIFT_CLOSE','shift',closure.id,'تسليم وردية '+s.label+' بإجمالي '+money(s.total)+' ج',{invoiceCount:s.invoiceCount,firstInvoiceNo:s.firstInvoiceNo,lastInvoiceNo:s.lastInvoiceNo,total:s.total,actualCash:actual,difference:actual-s.total});
  closeM();save();showNotice('تم تسليم الوردية وبدء عداد وردية جديد ✓','success');show('Shifts');
}
function showShiftClosure(cid){
  const x=(state.shiftClosures||[]).find(a=>a.id===cid);if(!x)return;
  modal(`<div class="big">🔁 تقرير تسليم وردية</div>
  <div class="invoice-row"><span>الكاشير</span><strong>${esc(shiftLabelFromRecord(x))}</strong></div>
  <div class="invoice-row"><span>من</span><span>${shortTime(x.openedAt||x.opened_at)}</span></div>
  <div class="invoice-row"><span>إلى</span><span>${shortTime(shiftClosedAt(x))}</span></div>
  <div class="invoice-row"><span>عدد الفواتير</span><strong>${x.invoiceCount||x.invoice_count||0}</strong></div>
  <div class="invoice-row"><span>أول / آخر فاتورة</span><span>${x.firstInvoiceNo?('#'+x.firstInvoiceNo):'—'} / ${x.lastInvoiceNo?('#'+x.lastInvoiceNo):'—'}</span></div>
  <div class="invoice-row"><span>اللعب والمباريات</span><span>${money(x.playTotal||x.play_total||0)} ج</span></div>
  <div class="invoice-row"><span>المشروبات</span><span>${money(x.drinkTotal||x.drink_total||0)} ج</span></div>
  <div class="invoice-total-row"><span>إجمالي النظام</span><span>${money(x.total||0)} ج</span></div>
  <div class="invoice-row"><span>الفعلي المسلم</span><strong>${money(x.actualCash||x.actual_cash||0)} ج</strong></div>
  <div class="invoice-row"><span>الفرق</span><strong>${money(x.difference||0)} ج</strong></div>
  ${x.notes?`<div class="invoice-row"><span>ملاحظات</span><span>${esc(x.notes)}</span></div>`:''}
  <br><div class="row"><button onclick="printShiftClosure('${x.id}')">🖨 طباعة / PDF</button><button class="gray" onclick="closeM()">إغلاق</button></div>`);
}
function printCurrentShift(){printShiftReport(shiftSummary(actorLabel()),null)}
function printShiftClosure(cid){const x=(state.shiftClosures||[]).find(a=>a.id===cid);if(!x)return;printShiftReport(null,x)}
function printShiftReport(summary,closure){
  const isClosed=!!closure;
  const label=isClosed?shiftLabelFromRecord(closure):summary.label;
  const from=isClosed?(closure.openedAt||closure.opened_at):summary.from;
  const to=isClosed?shiftClosedAt(closure):summary.to;
  const count=isClosed?(closure.invoiceCount||closure.invoice_count||0):summary.invoiceCount;
  const first=isClosed?(closure.firstInvoiceNo||closure.first_invoice_no):summary.firstInvoiceNo;
  const last=isClosed?(closure.lastInvoiceNo||closure.last_invoice_no):summary.lastInvoiceNo;
  const play=isClosed?(closure.playTotal||closure.play_total||0):summary.playTotal;
  const drinks=isClosed?(closure.drinkTotal||closure.drink_total||0):summary.drinkTotal;
  const total=isClosed?(closure.total||0):summary.total;
  const actual=isClosed?(closure.actualCash||closure.actual_cash||0):total;
  const diff=isClosed?(closure.difference||0):0;
  const w=window.open('','_blank','width=520,height=760');
  if(!w){showNotice('اسمح بفتح النوافذ المنبثقة للطباعة.','warn');return;}
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تسليم وردية</title><style>*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;padding:18px;color:#111}.sheet{max-width:760px;margin:0 auto;border:1px solid #ddd;padding:22px}.head{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:14px}h1{font-size:22px;margin:0}.row{display:flex;justify-content:space-between;border-bottom:1px dashed #bbb;padding:9px 0;font-size:14px}.total{display:flex;justify-content:space-between;border-top:2px solid #111;margin-top:10px;padding-top:12px;font-size:20px;font-weight:700}.actions{text-align:center;margin:18px 0}button{padding:10px 20px;border:0;background:#155eef;color:white;border-radius:6px;font-weight:700}@page{size:auto;margin:12mm}@media print{.actions{display:none}.sheet{border:none;padding:0}}

</style></head><body><div class="sheet"><div class="head"><h1>تقرير تسليم وردية</h1><div>${esc((state.profile&&state.profile.businessName)||'PS Cafe Manager')}</div></div><div class="row"><span>الكاشير</span><strong>${esc(label)}</strong></div><div class="row"><span>من</span><strong>${shortTime(from)}</strong></div><div class="row"><span>إلى</span><strong>${shortTime(to)}</strong></div><div class="row"><span>عدد الفواتير</span><strong>${count}</strong></div><div class="row"><span>أول / آخر فاتورة</span><strong>${first?('#'+first):'—'} / ${last?('#'+last):'—'}</strong></div><div class="row"><span>إيراد اللعب</span><strong>${money(play)} ج</strong></div><div class="row"><span>إيراد المشروبات</span><strong>${money(drinks)} ج</strong></div><div class="total"><span>الإجمالي النظامي</span><span>${money(total)} ج</span></div><div class="row"><span>المبلغ الفعلي المسلم</span><strong>${money(actual)} ج</strong></div><div class="row"><span>فرق عجز/زيادة</span><strong>${money(diff)} ج</strong></div>${isClosed&&closure.notes?`<div class="row"><span>ملاحظات</span><strong>${esc(closure.notes)}</strong></div>`:''}<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;font-size:13px"><div>توقيع الكاشير: ________________</div><div>توقيع المراجع: ________________</div></div></div><div class="actions"><button onclick="window.print()">طباعة / حفظ PDF</button></div></body></html>`);
  w.document.close();w.focus();
}

// ============================================================
// AUDIT LOG — OWNER ONLY
// ============================================================
function actionLabel(a){return ({LOGIN:'تسجيل دخول',LOGOUT:'تسجيل خروج',SESSION_START:'بدء جلسة',MATCH_START:'بدء مباراة',SESSION_ITEM_ADD:'إضافة مشروب للجلسة',SESSION_ITEM_REMOVE:'حذف مشروب من الجلسة',INVOICE_CREATE:'إنشاء فاتورة',INVOICE_CORRECT:'تصحيح فاتورة',INVOICE_VOID:'إلغاء فاتورة',SESSION_END:'إنهاء جلسة',PRODUCT_ADD:'إضافة منتج',PRODUCT_EDIT:'تعديل بيانات منتج',PRODUCT_STOCK_EDIT:'تعديل مخزون',PRODUCT_PRICE_EDIT:'تعديل سعر منتج',DEVICE_ADD:'إضافة جهاز',DEVICE_EDIT:'تعديل جهاز',DEVICE_DELETE:'حذف جهاز',DEVICE_PRICE_EDIT:'تعديل أسعار جهاز',EXPENSE_ADD:'إضافة مصروف',EXPENSE_DELETE:'حذف مصروف',EXPENSE_VOID:'إلغاء مصروف',USER_ADD:'إضافة مستخدم',USER_EDIT:'تعديل مستخدم',PROFILE_EDIT:'تعديل بيانات النشاط',SHIFT_CLOSE:'تسليم وردية'}[a]||a)}
function rAudit(){
  if(!owner()){vAudit.innerHTML='';return;}
  const logs=(state.auditLogs||[]).slice(0,300);
  vAudit.innerHTML=`<div class="page-header"><div class="page-header-left"><div class="section-title">🛡️ سجل الحركات</div><div class="page-subtitle muted">من نفّذ كل إجراء ومتى — يظهر لصاحب النشاط فقط</div></div><span class="owner-only-tag">OWNER ONLY</span></div>
  <div class="settings-note">يتم تسجيل الجلسات والفواتير والمشروبات والأسعار والمصروفات وإدارة الأجهزة. عند تفعيل قاعدة البيانات الآمنة تُرفع السجلات لسجل لا يسمح للكاشير بتعديله أو حذفه.</div>
  <div class="tw"><table><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th></tr>${logs.length?logs.map(l=>`<tr><td>${fmt(l.at)}</td><td><strong>${esc(l.actor||'غير محدد')}</strong><br><span class="small muted">${esc(roleLabel(l.actorRole||''))}</span></td><td>${esc(actionLabel(l.action))}</td><td>${esc(l.summary||'')}</td></tr>`).join(''):'<tr><td colspan="4" class="muted">لا توجد حركات مسجلة بعد.</td></tr>'}</table></div>`;
}

// ============================================================
// USERS — OWNER ONLY
// ============================================================
function rUsers(){
  if(!owner()){vUsers.innerHTML='';return;}
  if(st().mode==='secure_cloud'){
    vUsers.innerHTML=`<div class="page-header"><div class="page-header-left"><div class="section-title">👥 المستخدمون</div><div class="page-subtitle muted">حسابات Supabase المصرح بها للنشاط</div></div></div>
    <div class="settings-note">للحماية، كلمات المرور لا تُخزن داخل التطبيق. إنشاء المستخدم أول مرة يتم من لوحة Supabase الخاصة بصاحب النشاط، ثم يظهر هنا دوره وحالته.</div>
    <div class="tw"><table><tr><th>المستخدم</th><th>الصلاحية</th><th>الحالة</th></tr>${(cloudMembers||[]).map(u=>`<tr><td><strong>${esc(u.display_name||'—')}</strong></td><td>${roleLabel(jsRole(u.role))}</td><td>${u.active?'فعال':'موقوف'}</td></tr>`).join('')}</table></div>`;
    return;
  }
  vUsers.innerHTML=`<div class="page-header"><div class="page-header-left"><div class="section-title">👥 المستخدمون المحليون</div><div class="page-subtitle muted">للتجربة قبل تفعيل قاعدة البيانات فقط</div></div><button class="ok" onclick="userModal()">➕ إضافة مستخدم</button></div>
  <div class="settings-note">عند تفعيل قاعدة البيانات سيتم استخدام حسابات Supabase الآمنة بدل كلمات المرور المحلية.</div>
  <div class="tw"><table><tr><th>اسم المستخدم</th><th>الصلاحية</th><th>الحالة</th><th></th></tr>${state.users.map(u=>`<tr><td><strong>${esc(u.username)}</strong></td><td>${roleLabel(u.role)}</td><td>${u.active?'فعال':'غير فعال'}</td><td><button onclick="userModal('${u.id}')">✏ تعديل</button></td></tr>`).join('')}</table></div>`;
}
function userModal(uid=''){
  if(!owner()||st().mode==='secure_cloud')return;
  let u=state.users.find(x=>x.id==uid)||{username:'',password:'',role:'Cashier',active:true};
  modal(`<div class="big">${uid?'✏ تعديل مستخدم':'➕ مستخدم جديد'}</div><div class="grid g2"><div class="col"><label>اسم المستخدم</label><input id="un" value="${esc(u.username)}"></div><div class="col"><label>كلمة المرور</label><input id="up" type="password" value="${esc(u.password)}"></div><div class="col"><label>الصلاحية</label><select id="ur"><option value="Owner" ${u.role==='Owner'?'selected':''}>صاحب النشاط</option><option value="Manager" ${u.role==='Manager'?'selected':''}>مدير</option><option value="Cashier" ${u.role==='Cashier'?'selected':''}>كاشير</option><option value="Viewer" ${u.role==='Viewer'?'selected':''}>مشاهدة فقط</option></select></div><div class="col"><label>الحالة</label><select id="ua"><option value="true" ${u.active?'selected':''}>فعال</option><option value="false" ${!u.active?'selected':''}>غير فعال</option></select></div></div><br><div class="row"><button class="ok" onclick="saveUser('${uid}')">💾 حفظ</button><button class="gray" onclick="closeM()">إلغاء</button></div>`);
}
function saveUser(uid){
  if(!owner()||st().mode==='secure_cloud')return;let n=val('un').trim(),pw=val('up');
  if(!n)return showNotice('اكتب اسم المستخدم.', 'danger');
  if(!pw||pw.length<6)return showNotice('استخدم كلمة مرور لا تقل عن 6 أحرف.', 'danger');
  if(state.users.some(u=>u.username.toLowerCase()==n.toLowerCase()&&u.id!==uid))return showNotice('اسم المستخدم موجود بالفعل.', 'danger');
  let o={username:n,password:pw,role:val('ur'),active:val('ua')==='true'};
  if(uid){let target=state.users.find(x=>x.id==uid),before={username:target.username,role:target.role,active:target.active};Object.assign(target,o);audit('USER_EDIT','user',uid,'تعديل مستخدم: '+n,{before,after:{username:n,role:o.role,active:o.active}});}
  else{let newId=id();state.users.push({id:newId,...o});audit('USER_ADD','user',newId,'إضافة مستخدم: '+n,{role:o.role,active:o.active});}
  closeM();save();
}

// ============================================================
// OWNER CONTROL / SETTINGS
// ============================================================
function rSettings(){
  if(!owner()){vSettings.innerHTML='';return;}
  let s=st(),sm=syncMeta(),ns=notificationState();
  let cloudReady=s.mode==='secure_cloud'&&!!s.businessId;
  let syncText=cloudReady?(sm.syncing?'جاري التحديث…':(sm.lastSuccess?'محفوظ ومتصل ✓':'متصل ✓')):'غير مربوط';
  vSettings.innerHTML=`
  <div class="page-header">
    <div class="page-header-left"><div class="section-title">🏪 إدارة النشاط</div><div class="page-subtitle muted">إعدادات التشغيل اليومية</div></div>
    <span class="owner-only-tag">للمالك</span>
  </div>
  <div class="owner-card">
    <div class="big" style="font-size:16px;margin-bottom:12px">🏷️ بيانات النشاط</div>
    <div class="grid g2">
      <div class="col"><label>اسم النشاط</label><input id="businessName" value="${esc(state.profile.businessName||'')}" placeholder="اسم الكافيه"></div>
      <div class="col"><label>اسم المالك</label><input id="ownerName" value="${esc(state.profile.ownerName||'')}" placeholder="اسم صاحب النشاط"></div>
      <div class="col"><label>رقم التواصل</label><input id="businessPhone" value="${esc(state.profile.phone||'')}" placeholder="رقم الهاتف"></div>
      <div class="col"><label>العنوان</label><input id="businessAddress" value="${esc(state.profile.address||'')}" placeholder="عنوان النشاط"></div>
    </div>
    <div class="settings-actions"><button class="ok" onclick="saveBusinessProfile()">💾 حفظ بيانات النشاط</button></div>
  </div>
  <div class="owner-card">
    <div class="big" style="font-size:16px;margin-bottom:12px">🔁 الاتصال والتحديث</div>
    <div class="owner-simple-grid">
      <div class="owner-simple-card"><span>حالة الاتصال</span><b>${syncText}</b></div>
      <div class="owner-simple-card"><span>آخر تحديث</span><b>${shortTime(sm.lastSuccess)}</b></div>
      <div class="owner-simple-card"><span>الإصدار</span><b>${APP_VERSION}</b></div>
    </div>
    <div class="support-actions">
      <button class="btn-blue" onclick="manualSync()">🔄 تحديث البيانات</button>
      <button class="gray" onclick="clearAppCacheAndReload()">📱 تحديث التطبيق</button>
      <button class="gray" onclick="checkForUpdate()">فحص تحديث</button>
    </div>
    ${cloudReady?'':`<div class="settings-actions"><button class="btn-warn" onclick="cloudDeviceSetupModal()">🔒 ربط جهاز بقاعدة بيانات المحل</button></div>`}
  </div>
  <div class="owner-card">
    <div class="big" style="font-size:16px;margin-bottom:12px">🔔 التنبيهات</div>
    <div class="status-panel ${ns.cls}"><strong>الحالة:</strong> ${ns.label}</div>
    <div class="support-actions"><button class="btn-blue" onclick="enableNotifications()">تفعيل التنبيهات</button><button class="gray" onclick="testAlertNow()">اختبار تنبيه</button><button class="gray" onclick="installPwa()">تثبيت التطبيق</button></div>
  </div>
  <div class="owner-card">
    <div class="big" style="font-size:16px;margin-bottom:12px">💾 النسخ الاحتياطي</div>
    <div class="row">
      <button onclick="exportBackup()">📤 تصدير Backup</button>
      <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-elevated);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;font-size:14px;font-weight:700;color:var(--text-secondary);flex:1;justify-content:center">📥 استيراد Backup <input type="file" onchange="importBackup(event)" style="display:none;width:auto"></label>
    </div>
  </div>`
}
async function saveBusinessProfile(){
  if(!owner())return;const before={...state.profile};const after={businessName:val('businessName').trim()||'PS Cafe',ownerName:val('ownerName').trim(),phone:val('businessPhone').trim(),address:val('businessAddress').trim()};
  if(st().mode==='secure_cloud'){try{await req('PATCH',`ps_business_profiles?business_id=eq.${encodeURIComponent(st().businessId)}`,{owner_name:after.ownerName,phone:after.phone,address:after.address},'return=minimal');state.profile=after;await loadCloud(true);showNotice('تم حفظ بيانات النشاط وتسجيل الحركة ✓','success');}catch(e){showNotice('تعذر حفظ البيانات: '+e.message,'danger')}return;}
  state.profile=after;audit('PROFILE_EDIT','profile','business','تعديل بيانات النشاط',{before,after:{...state.profile}});save();showNotice('تم حفظ بيانات النشاط.','success');
}
function currentCloudInputs(){return {mode:val('mode')||st().mode,url:val('url').trim().replace(/\/$/,''),key:val('key').trim(),businessId:val('businessId').trim(),cloudEmail:val('cloudEmail').trim(),session:st().session}}
function testAlertNow(){
  playBeep('w5');if(navigator.vibrate)navigator.vibrate([250,100,250]);
  if('Notification' in window&&Notification.permission==='granted')new Notification('PS Cafe Manager',{body:'اختبار التنبيه يعمل بنجاح',icon:'./icon-192.png'});
  showToast('🔔','اختبار التنبيه يعمل الآن','t-ok');
}
function showPolicy(kind){
  const name=esc((state&&state.profile&&state.profile.businessName)||'PS Cafe');
  const pages={
    terms:`<div class="big">📄 شروط الاستخدام</div><div class="policy-text"><h3>الاستخدام المصرح</h3><p>النظام مخصص لإدارة تشغيل ${name} بواسطة العاملين المصرح لهم فقط.</p><h3>مسؤولية الإدخال</h3><p>المستخدم مسؤول عن صحة الجلسات والفواتير والمصروفات التي يسجلها، وعلى صاحب النشاط مراجعة التقارير والنسخ الاحتياطية.</p><h3>حماية الحساب</h3><p>يحظر مشاركة كلمات المرور أو استخدام حساب شخص آخر. يحق لصاحب النشاط تعطيل أي حساب.</p></div>`,
    privacy:`<div class="big">🔐 سياسة الخصوصية والبيانات</div><div class="policy-text"><h3>ملكية البيانات</h3><p>بيانات التشغيل والفواتير تخص صاحب النشاط. عند تفعيل الربط السحابي تُحفظ بيانات التشغيل في مشروع Supabase الذي يملكه صاحب النشاط.</p><h3>البيانات المحلية</h3><p>قد يحتفظ الجهاز بنسخة محلية مؤقتة لاستمرار العمل عند انقطاع الإنترنت. يجب حماية الجهاز وعدم تركه لغير المصرح لهم.</p><h3>الحماية التقنية</h3><p>يستخدم التطبيق مفتاحًا عامًا مع تسجيل دخول وسياسات وصول RLS، ولا يجب إدخال أي مفتاح سري داخل التطبيق.</p></div>`,
    support:`<div class="big">🏪 الملكية والدعم</div><div class="policy-text"><h3>مالك النظام والبيانات</h3><p>صاحب النشاط هو المسؤول عن ملكية قاعدة البيانات وإدارة المستخدمين والنسخ الاحتياطية.</p><h3>الدعم</h3><p>للدعم أو تعديل الصلاحيات يرجى الرجوع إلى صاحب النشاط أو الإدارة الداخلية.</p></div>`
  };
  modal((pages[kind]||pages.terms)+`<br><button class="gray" onclick="closeM()">إغلاق</button>`);
}

function exportBackup(){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='ps_backup_'+today()+'.json';a.click()}
function importBackup(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let incoming=JSON.parse(r.result);if(!incoming||!Array.isArray(incoming.devices)||!Array.isArray(incoming.invoices))throw Error('صيغة غير صحيحة');state=incoming;save();showNotice('تم استيراد النسخة الاحتياطية بنجاح.', 'success')}catch(err){showNotice('ملف النسخة الاحتياطية غير صالح.', 'danger')}};r.readAsText(f)}
function resetAll(){if(confirm('حذف كل البيانات؟')){state=def();save()}}

// ============================================================
// MODAL
// ============================================================
function modal(h){const box=document.getElementById('mc');box.innerHTML=h;box.scrollTop=0;document.getElementById('modal').classList.remove('hidden')}
function closeM(){document.getElementById('modal').classList.add('hidden')}

// ============================================================
// SYNC QUEUE
// ============================================================
function queue(){try{return JSON.parse(localStorage.getItem(QK))||[]}catch(e){return[]}}
function setQueue(q){localStorage.setItem(QK,JSON.stringify(q.slice(-50)))}
function markPending(summary){if(st().mode!=='secure_cloud')return;let q=queue();q.push({id:id(),time:new Date().toISOString(),summary:summary||'تغيير',state:state});setQueue(q)}
function clearQueue(){if(confirm('مسح قائمة العمليات المنتظرة؟')){setQueue([]);dirty=false;render();alert('تم مسح قائمة الانتظار')}}
function showQueue(){let q=queue();modal(`<div class="big">📋 قائمة انتظار المزامنة</div>
  <p class="muted small" style="margin-bottom:14px">في التشغيل السحابي الآمن لا تُرسل حالة كاملة من الجهاز؛ كل عملية تحفظ مباشرة مع سجل حركة.</p>
  ${q.length?`<div class="tw"><table><tr><th>الوقت</th><th>العملية</th></tr>${q.map(x=>`<tr><td>${fmt(x.time)}</td><td>${esc(x.summary)}</td></tr>`).join('')}</table></div>`:'<p class="muted" style="text-align:center;padding:20px">لا توجد عمليات منتظرة ✔</p>'}
  <br><div class="row"><button class="ok" onclick="manualSync()">🔄 مزامنة الآن</button><button class="gray" onclick="closeM()">إغلاق</button></div>`)}

// ============================================================
// SUPABASE / NORMALIZED SECURE CLOUD SYNC — V6.4.1
// ============================================================
function friendlySyncError(status,raw){
  const txt=String(raw||'');
  if(status===400&&/invalid|login|credentials/i.test(txt))return 'بيانات دخول السحابة غير صحيحة.';
  if(status===401)return 'انتهت جلسة السحابة أو بيانات الدخول غير صحيحة.';
  if(status===403)return 'الحساب لا يملك صلاحية الوصول إلى بيانات النشاط.';
  if(status===404)return 'جداول قاعدة البيانات غير جاهزة. نفّذ ملف 01_SCHEMA_PRODUCTION.sql أولاً.';
  if(/row-level security|rls/i.test(txt))return 'رفضت قاعدة البيانات العملية بسبب الصلاحيات المحددة.';
  if(/Failed to fetch|NetworkError/i.test(txt))return 'تعذر الوصول إلى قاعدة البيانات. افحص الإنترنت أو الرابط.';
  return 'تعذر إتمام العملية ('+status+').';
}
function cloudDeviceSetupModal(){
  const s=st();
  modal(`<div class="big">🔒 ربط هذا الجهاز بقاعدة بيانات المحل</div>
  <div class="settings-note">هذه البيانات عامة وآمنة للاستخدام في التطبيق بعد تطبيق RLS. لا تدخل أي Secret Key أو Service Role.</div>
  <div class="col"><label>Supabase Project URL</label><input id="setupUrl" value="${esc(s.url)}" placeholder="https://xxxx.supabase.co"></div>
  <div class="col mt"><label>Publishable Key فقط</label><input id="setupKey" value="${esc(s.key)}" placeholder="sb_publishable_..."></div>
  <div class="col mt"><label>Business ID</label><input id="setupBusinessId" value="${esc(s.businessId)}" placeholder="UUID"></div>
  <br><div class="row"><button class="ok" onclick="saveCloudDeviceSetup()">💾 حفظ الربط على هذا الجهاز</button><button class="gray" onclick="closeM()">إلغاء</button></div>`);
}
function saveCloudDeviceSetup(){
  const url=val('setupUrl').trim().replace(/\/$/,''), key=val('setupKey').trim(), businessId=val('setupBusinessId').trim();
  if(!url||!key||!businessId){showNotice('أكمل بيانات الربط الثلاثة.', 'danger');return;}
  const s=st();setQueue([]);dirty=false;setst({...s,mode:'secure_cloud',url,key,businessId,session:null,schema:'normalized_v2_controlled_corrections'});closeM();
  document.querySelector('label[for="lu"]');
  showNotice('تم تجهيز الجهاز. ادخل الآن ببريد المستخدم وكلمة مروره.', 'success');
}
async function authFetch(path,opts={}){
  const s=st();if(!navigator.onLine)throw Error('لا يوجد اتصال بالإنترنت.');
  if(!s.url||!s.key)throw Error('إعدادات قاعدة البيانات غير موجودة على هذا الجهاز.');
  let response;try{response=await fetch(s.url+path,{...opts,headers:{apikey:s.key,'Content-Type':'application/json',...(opts.headers||{})}})}catch(e){throw Error('تعذر الوصول إلى قاعدة البيانات. افحص الإنترنت أو الرابط.')}
  const raw=await response.text();if(!response.ok)throw Error(friendlySyncError(response.status,raw));
  try{return raw?JSON.parse(raw):{}}catch(e){return {}}
}
async function cloudSignInCredentials(email,password){
  let s=st();setSyncMeta({syncing:true,lastError:''});
  const data=await authFetch('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
  if(!data.access_token||!data.user)throw Error('لم يتم إنشاء جلسة دخول آمنة.');
  s.session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600),userId:data.user.id,email:data.user.email};s.cloudEmail=email;s.mode='secure_cloud';s.schema='normalized_v2_controlled_corrections';setst(s);return data.user;
}
async function cloudSignIn(password){ return cloudSignInCredentials(st().cloudEmail,password); }
async function cloudSignOut(showMessage=true){
  const s=st();s.session=null;setst(s);setSyncMeta({verified:false,syncing:false,lastError:'',lastSuccess:''});
  if(showMessage)showNotice('تم تسجيل الخروج من قاعدة بيانات النشاط.', 'success');
}
async function ensureCloudToken(){
  let s=st();if(s.mode!=='secure_cloud')throw Error('قاعدة بيانات المالك غير مفعلة.');
  if(!s.session||!s.session.access_token)throw Error('يلزم تسجيل دخول المستخدم إلى قاعدة البيانات.');
  if((s.session.expires_at||0)>Math.floor(Date.now()/1000)+60)return s.session.access_token;
  const data=await authFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.session.refresh_token})});
  s.session={...s.session,access_token:data.access_token,refresh_token:data.refresh_token||s.session.refresh_token,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};setst(s);return s.session.access_token;
}
async function req(method,path,body,prefer='return=representation'){
  const s=st();if(!navigator.onLine)throw Error('لا يوجد اتصال بالإنترنت. البيانات محفوظة على الجهاز.');
  if(!s.url||!s.key||!s.businessId)throw Error('إعدادات قاعدة بيانات النشاط غير مكتملة.');
  const token=await ensureCloudToken();let r;
  try{r=await fetch(s.url+'/rest/v1/'+path,{method,headers:{apikey:s.key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined})}
  catch(err){throw Error('تعذر الوصول إلى قاعدة البيانات. افحص الإنترنت أو الرابط.');}
  const raw=await r.text();if(!r.ok)throw Error(friendlySyncError(r.status,raw));
  try{return raw?JSON.parse(raw):[]}catch(e){return []}
}
async function rpc(name,args){return req('POST','rpc/'+name,args,'return=representation');}
async function fetchSignedInMember(){
  const s=st();const rows=await req('GET',`ps_members?business_id=eq.${encodeURIComponent(s.businessId)}&user_id=eq.${encodeURIComponent(s.session.userId)}&select=*`,null);
  return rows&&rows[0];
}
async function testSupabaseConnection(){
  setSyncMeta({syncing:true,lastError:''});
  try{const member=await fetchSignedInMember();if(!member||!member.active)throw Error('الحساب ليس عضوًا مفعلًا في هذا النشاط.');setSyncMeta({verified:true,syncing:false,lastError:''});return true;}
  catch(e){setSyncMeta({verified:false,syncing:false,lastError:e.message});throw e;}
}
async function loadCloud(force=false){
  // RC1 recovery rule: sync is read-only and resilient. Old pending local queues must not block
  // cloud refresh, because they came from previous broken builds and are not authoritative.
  const b=st().businessId;
  if(!b)throw Error('معرف النشاط غير موجود على هذا الجهاز.');
  setSyncMeta({syncing:true,lastError:''});
  async function must(label,promise){
    try{return await promise;}catch(e){throw Error('فشل تحميل '+label+': '+(e.message||e));}
  }
  async function optional(label,promise,fallback=[]){
    try{return await promise;}catch(e){console.warn('Optional cloud read failed:',label,e);return fallback;}
  }
  const [profiles,devices,products,sessions,sitems,invoices,iitems,expenses,shiftClosures,logs,members]=await Promise.all([
    must('بيانات النشاط',req('GET',`ps_business_profiles?business_id=eq.${encodeURIComponent(b)}&select=*`)),
    must('الأجهزة',req('GET',`ps_devices?business_id=eq.${encodeURIComponent(b)}&select=*`)),
    optional('المشروبات',req('GET',`ps_products?business_id=eq.${encodeURIComponent(b)}&select=*`),[]),
    must('الجلسات',req('GET',`ps_sessions?business_id=eq.${encodeURIComponent(b)}&select=*`)),
    optional('بنود الجلسات',req('GET',`ps_session_items?business_id=eq.${encodeURIComponent(b)}&select=*`),[]),
    optional('الفواتير',req('GET',`ps_invoices?business_id=eq.${encodeURIComponent(b)}&select=*&order=created_at.desc`),[]),
    optional('بنود الفواتير',req('GET',`ps_invoice_items?business_id=eq.${encodeURIComponent(b)}&select=*`),[]),
    (owner()||manager())?optional('المصروفات',req('GET',`ps_expenses?business_id=eq.${encodeURIComponent(b)}&select=*`),[]):Promise.resolve([]),
    optional('الورديات',req('GET',`ps_shift_closures?business_id=eq.${encodeURIComponent(b)}&select=*&order=closed_at.desc`),[]),
    owner()?optional('سجل الحركات',req('GET',`ps_audit_logs?business_id=eq.${encodeURIComponent(b)}&select=*&order=occurred_at.desc&limit=300`),[]):Promise.resolve([]),
    owner()?optional('المستخدمين',req('GET',`ps_members?business_id=eq.${encodeURIComponent(b)}&select=*`),[]):Promise.resolve([])
  ]);
  cloudMembers=members||[];
  const itemMap={};(sitems||[]).forEach(i=>(itemMap[i.session_id]||(itemMap[i.session_id]=[])).push({id:i.id,productId:i.product_id,name:i.name,price:+i.price,qty:+i.qty,type:i.item_type||'drink',item_type:i.item_type||'drink',addedAt:i.added_at}));
  const invItemMap={};(iitems||[]).forEach(i=>(invItemMap[i.invoice_id]||(invItemMap[i.invoice_id]=[])).push({id:i.id,productId:i.product_id,name:i.name,price:+i.price,qty:+i.qty,type:i.item_type||'drink',item_type:i.item_type||'drink'}));
  const mappedSessions=(sessions||[]).map(s=>({id:s.id,deviceId:s.device_id,customer:s.customer,mode:s.play_mode,sessionType:s.session_type,matchMins:s.match_minutes,matchPrice:+s.match_price||null,items:itemMap[s.id]||[],start:s.started_at,status:s.status,end:s.ended_at,startedBy:s.started_by_label||'غير محدد',startedById:s.started_by,endedBy:s.ended_by_label||'',endedById:s.ended_by}));
  const openIds=new Set(mappedSessions.filter(s=>s.status==='open').map(s=>s.deviceId));
  const localUsers=state.users||[];
  state={users:localUsers,profile:{businessName:state.profile?.businessName||'PS Cafe',ownerName:profiles[0]?.owner_name||'',phone:profiles[0]?.phone||'',address:profiles[0]?.address||''},devices:(devices||[]).map(d=>({id:d.id,name:d.name,status:d.maintenance?'maintenance':(openIds.has(d.id)?'busy':'available'),singleRate:+d.single_rate,multiRate:+d.multi_rate,matchPrices:d.match_prices||[],cloudUpdatedAt:d.updated_at})),products:(products||[]).map(p=>({id:p.id,name:p.name,price:+p.price,stock:+p.stock,active:p.active,cloudUpdatedAt:p.updated_at})),sessions:mappedSessions,invoices:(invoices||[]).map(i=>({id:i.id,sessionId:i.session_id,no:+i.invoice_no,date:i.created_at,deviceId:i.device_id,deviceName:i.device_name,customer:i.customer,mode:i.play_mode,sessionType:i.session_type,matchMins:i.match_minutes,start:i.started_at,end:i.ended_at,minutes:i.minutes,playTotal:+i.play_total,drinkTotal:+i.drink_total,total:+i.total,items:invItemMap[i.id]||[],payment:i.payment_method,status:i.status||'completed',correctionSeq:+i.correction_seq||0,correctedAt:i.corrected_at,correctedByLabel:i.corrected_by_label,correctionReason:i.correction_reason,issuedBy:i.creator_label})),expenses:(expenses||[]).map(e=>({id:e.id,date:e.expense_date,type:e.expense_type,amount:+e.amount,note:e.note,createdBy:e.creator_label,createdAt:e.created_at,voidedAt:e.voided_at,voidReason:e.void_reason||''})),shiftClosures:(shiftClosures||[]).map(x=>({id:x.id,openedAt:x.opened_at,closedAt:x.closed_at,closedBy:x.closed_by,closedByLabel:x.closed_by_label,invoiceCount:+x.invoice_count||0,firstInvoiceNo:+x.first_invoice_no||0,lastInvoiceNo:+x.last_invoice_no||0,playTotal:+x.play_total||0,drinkTotal:+x.drink_total||0,total:+x.total||0,actualCash:+x.actual_cash||0,difference:+x.difference||0,notes:x.notes||'',createdAt:x.created_at,cloudSynced:true})),auditLogs:(logs||[]).map(l=>({id:l.id,at:l.occurred_at,action:l.action,entityType:l.entity_type,entityId:l.entity_id,summary:l.summary,details:l.details,actor:l.actor_label,actorRole:l.actor_role,cloudSynced:true})),nextInvoice:Math.max(1,...(invoices||[]).map(i=>+i.invoice_no+1)),updatedAt:new Date().toISOString()};
  localStorage.setItem(K,JSON.stringify(state));setSyncMeta({verified:true,syncing:false,lastError:''});dirty=false;setQueue([]);render();return true;
}
async function connectOwnerCloud(){
  if(!owner())return;const cfg=currentCloudInputs();
  if(cfg.mode==='offline'){setst({...cfg,session:null});setSyncMeta({verified:false,lastError:'',syncing:false,lastSuccess:''});showNotice('تم ضبط البيانات على الجهاز فقط.', 'success');return;}
  const password=val('cloudPassword');if(!cfg.url||!cfg.key||!cfg.businessId||!cfg.cloudEmail||!password){showNotice('أكمل رابط المشروع والمفتاح العام ومعرف النشاط وبيانات حساب المالك.', 'danger');return;}
  localStorage.setItem(SK,JSON.stringify({...cfg,schema:'normalized_v2_controlled_corrections'}));
  try{await cloudSignInCredentials(cfg.cloudEmail,password);const member=await fetchSignedInMember();if(!member||member.role!=='owner')throw Error('هذا الربط الأول يجب أن يتم بحساب المالك.');user={id:member.user_id,username:member.display_name||cfg.cloudEmail,role:'Owner',canCorrectInvoices:true,active:true,cloud:true};await testSupabaseConnection();await loadCloud(true);showNotice('تم ربط قاعدة بيانات المالك وقراءة البيانات الآمنة ✓', 'success');}
  catch(e){setSyncMeta({verified:false,syncing:false,lastError:e.message});render();showNotice('فشل الربط: '+e.message, 'danger');}
}
async function flushQueue(){return loadCloud(true);}
async function manualSync(){
  if(st().mode!=='secure_cloud'){showNotice('قاعدة بيانات صاحب النشاط غير مربوطة بعد.', 'warn');return;}
  try{await loadCloud(true);setSyncMeta({verified:true,syncing:false,lastSuccess:new Date().toISOString(),lastError:''});showNotice('تم تحديث البيانات من قاعدة النشاط بأمان ✓','success');}
  catch(e){setSyncMeta({verified:false,syncing:false,lastError:e.message});render();showNotice('لم يتم التحديث: '+e.message,'danger');}
}
function sched(){}
function setup(){clearInterval(timer);window.removeEventListener('online',window.__psOnline||(()=>{}));window.__psOnline=()=>{if(st().mode==='secure_cloud'&&st().session)loadCloud(true).catch(e=>setSyncMeta({verified:false,syncing:false,lastError:e.message}))};window.addEventListener('online',window.__psOnline);if(st().mode==='secure_cloud'&&st().session)timer=setInterval(()=>loadCloud().catch(e=>setSyncMeta({verified:false,syncing:false,lastError:e.message})),15000)}

async function checkForUpdate(){
  try{
    if(!('serviceWorker' in navigator)){showNotice('التحديث التلقائي غير مدعوم هنا.', 'warn');return;}
    const reg=swRegistration||await navigator.serviceWorker.getRegistration();
    if(!reg){showNotice('Service Worker غير مسجل بعد. أعد فتح التطبيق.', 'warn');return;}
    await reg.update();showNotice('تم فحص التحديث. لو توجد نسخة جديدة سيتم تحميلها عند إعادة الفتح.', 'success');
  }catch(e){showNotice('تعذر فحص التحديث الآن.', 'danger')}
}
async function clearAppCacheAndReload(){
  if(!confirm('تحديث ملفات التطبيق الآن؟ لن يتم حذف البيانات أو الفواتير المحفوظة.'))return;
  try{
    const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('ps-cafe-')).map(k=>caches.delete(k)));
    if(swRegistration)await swRegistration.update();
    location.reload(true);
  }catch(e){showNotice('تعذر تحديث الكاش الآن.', 'danger')}
}

function setupMobileBackNavigation(){
  try{history.replaceState({tab:tab||'Dashboard'},'', location.hash||'#Dashboard');}catch(e){}
  window.addEventListener('popstate',()=>{
    const m=document.getElementById('modal');
    if(m&&!m.classList.contains('hidden')){closeM();try{history.pushState({tab:tab},'', '#'+tab)}catch(e){};return;}
    if(tab!=='Dashboard'){show('Dashboard',true);return;}
    const now=Date.now();
    if(!window.__lastBackPress||now-window.__lastBackPress>1800){window.__lastBackPress=now;showNotice('اضغط رجوع مرة أخرى للخروج','info');try{history.pushState({tab:'Dashboard'},'', '#Dashboard')}catch(e){};}
  });
}
load();setup();setupMobileBackNavigation();


if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js?v=6.4.2-rc7-5')
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
