/* ══ CONFIG：GAS 部署網址 ══ */
const CFG={GAS_URL:'https://script.google.com/macros/s/AKfycbyfpN0qV8S5eZYPL7NMjTUAN3FCc_1LGJpFB-fAUPm0tcvxDgXNsuQzaIYdcN4RU8VaLQ/exec'};

/* 完美對齊您最新更新的精確寬度 */
const COLS=[
  {k:'stockDate',n:'備貨日期',w:95,role:'s'},
  {k:'item',n:'品項',w:158,role:'s'},
  {k:'batch',n:'批號',w:85,role:'s'},
  {k:'shipDate',n:'送貨日期',w:105,role:'s'},
  {k:'customer',n:'客戶',w:70,role:'s'},
  {k:'category',n:'科別',w:50,role:'s'},
  {k:'type',n:'賣備樣',w:50,role:'s'},
  {k:'orderNo',n:'訂購單號',w:80,role:'s'},
  {k:'remark',n:'備註',w:300,role:'s'},
  {k:'invoiceDate',n:'發票日期',w:85,role:'a'},
  {k:'invoiceNo',n:'發票號碼',w:100,role:'a'},
  {k:'erp',n:'ERP銷帳',w:175,role:'a'},
  {k:'loanReturn',n:'借出還回單',w:105,role:'a'},
  {k:'loanOut',n:'借出單',w:105,role:'a'},
  {k:'note',n:'註記',w:150,role:'a'},
  {k:'sales',n:'業務',w:55,role:'a'}
];
const EMPTY_F=[{k:'invoiceDate',n:'發票日期'},{k:'invoiceNo',n:'發票號碼'},{k:'erp',n:'ERP銷帳'},{k:'loanReturn',n:'借出還回單'},{k:'loanOut',n:'借出單'}];
const LBL={};COLS.forEach(c=>LBL[c.k]=c.n);

let DB={records:[],logs:[]};
let ITEM_CATALOG=['速原2.5ml-2級','速原5ml-2級','速原10ml-2級','樂業5ml','樂業10ml','薇基因(盒裝)','妙癒修復霜-20ml(盒裝)','妙癒修復霜-5ml(軟管)','歐儷芙舒口噴劑'];
let SALES_NAMES=['王大明','李小美','陳建志'];

const PRODUCT_FAMILIES=[
  {key:'newepi',name:'NEW EPI',color:'#1B4E8C',g1:'#7FB3E0',g2:'#3D7FC4',items:['速原2.5ml-2級','速原5ml-2級','速原10ml-2級','樂業5ml','樂業10ml']},
  {key:'vaginne',name:'薇基因',color:'#9B5FB5',g1:'#D2A0DC',g2:'#9B5FB5',items:['薇基因(盒裝)']},
  {key:'wonder',name:'妙癒修復霜',color:'#1F6B45',g1:'#A9D6AE',g2:'#5B9F68',items:['妙癒修復霜-20ml(盒裝)','妙癒修復霜-5ml(軟管)']},
  {key:'orelief',name:'歐儷芙',color:'#1A8A8A',g1:'#7FD9D9',g2:'#22A6A6',items:['歐儷芙舒口噴劑']}
];
function familyOf(item){ return PRODUCT_FAMILIES.find(f=>f.items.includes(item)) || {key:'other',name:'其他',color:'var(--tx-3)',g1:'#ccc',g2:'#999',items:[]}; }
// 業務庫存統計卡片用的短名稱：NEW EPI 系列不用顯示 ml／級數，
// 「速原2.5ml-2級」顯示成「速原2.5」、「樂業10ml」顯示成「樂業10」就好。
// 只有符合「數字+ml（可選-數字級）結尾」的品項名稱才會被縮短，其他系列的品項名稱不受影響。
function shortItemName(item){
  return String(item||'').replace(/(\d+(?:\.\d+)?)ml(?:-\d+級)?$/,'$1');
}

async function api(a,p){
  try{
    const res=await fetch(CFG.GAS_URL,{method:'POST',body:JSON.stringify({action:a,...p})});
    const text=await res.text();
    try{ return JSON.parse(text); }
    catch(parseErr){ return{status:'error',message:'伺服器回傳了非預期的內容，請檢查 GAS 部署設定。'}; }
  }catch(e){return{status:'error',message:'連線失敗：'+e.message};}
}

function nowT(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${m}-${dd} `+d.toTimeString().slice(0,5);
}

function addLog(o){DB.logs.push({t:nowT(),actor:o.actor||CUR,act:o.act,ok:o.ok!==false,rid:o.rid||'',desc:o.desc||'',diffs:o.diffs||null,src:o.src||(ROLE==='admin'?'行政端網頁':'業務端網頁'),err:o.err||''});}
async function refreshLogs(){
  const res=await api('getLogs',{salesName:ROLE==='sales'?CUR:''});
  if(res.status==='success')DB.logs=res.data;
}

let ROLE='sales',CUR='王大明',CUR_EMAIL='',VIEW='group',BQ=1,AQ=1,PKT=null,PKV={},EDID=null,GROUPS=[],GEDI=null,CUR_STOCK_ITEM=null;

function renderModeBadges(){
  const html = `<div class="bar-out ico" id="__REFRESH__" title="重新整理" aria-label="重新整理">↻</div><div class="bar-out" onclick="logout()">登出</div>`;
  const slot1 = document.getElementById('modeBadgeSlot1');
  const slot2 = document.getElementById('modeBadgeSlot2');
  const slot3 = document.getElementById('modeBadgeSlot3');
  if (slot1) { slot1.innerHTML = html.replace('__REFRESH__','salesRefreshBtn'); slot1.querySelector('#salesRefreshBtn').setAttribute('onclick','refreshSales()'); }
  if (slot2) { slot2.innerHTML = html.replace('__REFRESH__','adminRefreshBtn'); slot2.querySelector('#adminRefreshBtn').setAttribute('onclick','refreshAdmin()'); }
  if (slot3) { slot3.innerHTML = html.replace('__REFRESH__','mgrRefreshBtn'); slot3.querySelector('#mgrRefreshBtn').setAttribute('onclick','refreshManager()'); }
}
renderModeBadges();

const CURRENT_YM=(function(){const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');})();
let FM=CURRENT_YM,FI='',FShip='',ASales='',AItem='',AEmpty=new Set(),LOGF='all';
let GRID=[],EDITS={};

function showLoad(msg){document.getElementById('loadOverlayText').textContent=msg||'讀取資料中…';document.getElementById('loadOverlay').style.display='flex';}
function hideLoad(){document.getElementById('loadOverlay').style.display='none';}

const ROSTERS={
  sales:[
    {name:'翁培文',email:'mavish@goodcare-biotech.com.tw'},{name:'劉仲元',email:'marcus@goodcare-biotech.com.tw'},
    {name:'郭其融',email:'lucas@goodcare-biotech.com.tw'},{name:'謝羽宸',email:'daphne-hsieh@goodcare-biotech.com.tw'},
    {name:'羅彩鳳',email:'ran@goodcare-biotech.com.tw'},{name:'李雪梅',email:'mandy@goodcare-biotech.com.tw'},
    {name:'李靜宜',email:'ella@goodcare-biotech.com.tw'},{name:'陳玉屏',email:'maggie@goodcare-biotech.com.tw'},
    {name:'陳怡伶',email:'rita@goodcare-biotech.com.tw'},{name:'陳嬿伊',email:'amychen@goodcare-biotech.com.tw'},
    {name:'李姸慧',email:'gina@goodcare-biotech.com.tw'},{name:'孫郁婷',email:'sunny@goodcare-biotech.com.tw'},
    {name:'李佩盈',email:'patty@goodcare-biotech.com.tw'},{name:'徐純慧',email:'una@goodcare-biotech.com.tw'},
    {name:'許智評',email:'deva@goodcare-biotech.com.tw'},{name:'陳文嬛',email:'renee@goodcare-biotech.com.tw'},
    {name:'涂宇萱',email:'hannah@goodcare-biotech.com.tw'},{name:'楊智凱',email:'joseph@goodcare-biotech.com.tw'},
    {name:'謝昶明',email:'liam@goodcare-biotech.com.tw'}
  ],
  admin:[
    {name:'陳家祈',email:'joanne@goodcare-biotech.com.tw'},{name:'顧晨馨',email:'chenhsin@goodcare-biotech.com.tw'},
    {name:'吳靜婷',email:'ivy@goodcare-biotech.com.tw'},{name:'邱馨儀',email:'shinyi@goodcare-biotech.com.tw'},
    {name:'周姝彣',email:'lala@goodcare-biotech.com.tw'},{name:'李翊瑄',email:'vera@goodcare-biotech.com.tw'},
    {name:'楊筱筠',email:'sherry@goodcare-biotech.com.tw'},{name:'盧語璇',email:'zoe@goodcare-biotech.com.tw'},
    {name:'詹琇竹',email:'vicky@goodcare-biotech.com.tw'},{name:'江翰屏',email:'vicky-chiang@goodcare-biotech.com.tw'}
  ],
  manager:[
    {name:'妙玉姐',email:'kelly@goodcare-biotech.com.tw'},{name:'陳家祈',email:'joanne@goodcare-biotech.com.tw'},
    {name:'吳靜婷',email:'ivy@goodcare-biotech.com.tw'},{name:'周姝彣',email:'lala@goodcare-biotech.com.tw'},
    {name:'謝昶明',email:'liam@goodcare-biotech.com.tw'}
  ]
};
const ROLE_LABEL={sales:'業務登入',admin:'行政登入',manager:'報表'};
function rolesForEmail(email){
  const roles=new Set(Object.keys(ROSTERS).filter(k=>ROSTERS[k].some(p=>p.email===email)));
  if(roles.has('manager')) roles.add('admin');
  const order=['sales','admin','manager'];
  return order.filter(r=>roles.has(r));
}
function nameForEmail(email){
  for(const k of ['sales','admin','manager']){ const f=ROSTERS[k].find(p=>p.email===email); if(f)return f.name; }
  return (email||'').split('@')[0]||'使用者';
}

let FIREBASE_READY=false, FIREBASE_USER=null;
window.addEventListener('firebase-ready', ()=>{
  FIREBASE_READY=true;
  window.__fb.redirectResultPromise.then(result=>{
    if(result && result.user){ handleAuthedUser(result.user); }
  }).catch(err=>{ toast('Google 登入失敗：'+(err.message||err.code||'未知錯誤'), true); });
  window.__fb.onAuthStateChanged(window.__fb.auth, (user)=>{
    FIREBASE_USER=user;
    if(user && document.getElementById('login').style.display!=='none'){ handleAuthedUser(user); }
  });
});

function isInAppBrowser(){ return /Line\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent||''); }
function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'') || window.innerWidth<900; }
async function googleSignIn(btn){
  if(btn.disabled)return;
  if(!FIREBASE_READY){toast('Google 登入服務準備中，請稍後再試',true);return;}
  if(isInAppBrowser()){ document.getElementById('inAppWarn').style.display='block'; return; }
  const orig=document.getElementById('googleBtnText').textContent;
  btn.disabled=true;document.getElementById('googleBtnText').textContent='登入中…';
  // 原本手機一律強制用 signInWithRedirect（整頁導去 Google 再導回來）。
  // 但這個方式依賴「導回頁面後還讀得到剛剛存的登入狀態」，手機瀏覽器（尤其 iOS Safari）
  // 對第三方儲存空間的封鎖越來越嚴格，常常導致導回來之後 getRedirectResult() 讀不到
  // 任何東西、卻也不會報錯——使用者看到的就是「登入完又跳回登入畫面」。
  // signInWithPopup 不需要整頁跳轉、不依賴那個儲存空間，所以不分手機或電腦，
  // 一律先嘗試彈窗登入；只有瀏覽器真的擋掉彈窗時，才退回用整頁跳轉。
  try{
    const result=await window.__fb.signInWithPopup(window.__fb.auth, window.__fb.provider);
    await handleAuthedUser(result.user);
  }catch(err){
    const code=err&&err.code||'';
    const msg=String(err&&err.message||'');
    const popupBlocked = code==='auth/popup-blocked' || code==='auth/operation-not-supported-in-this-environment'
      || msg.includes('initial state') || msg.includes('Cross-Origin-Opener-Policy');
    if(popupBlocked){
      try{ await window.__fb.signInWithRedirect(window.__fb.auth, window.__fb.provider); return; }catch(e2){}
    }
    if(code!=='auth/popup-closed-by-user' && code!=='auth/cancelled-popup-request'){ toast('Google 登入失敗：'+(err.message||code), true); }
  }
  btn.disabled=false;document.getElementById('googleBtnText').textContent=orig;
}
async function handleAuthedUser(user){
  const email=user.email||'';
  const roles=rolesForEmail(email);
  if(!roles.length){ await window.__fb.signOut(window.__fb.auth); toast('此帳號尚未開通使用權限：'+email, true); return; }
  CUR_EMAIL=email; CUR=nameForEmail(email);
  if(roles.length===1){ proceedLogin(roles[0]); return; }
  const remembered=localStorage.getItem('lastRole:'+email);
  if(remembered && roles.includes(remembered)){ proceedLogin(remembered); return; }
  showRoleChooser(roles);
}
function showRoleChooser(roles){
  const box=document.getElementById('roleChooserOptions');
  box.innerHTML=roles.map(r=>`<button class="btn-role-choice" onclick="proceedLogin('${r}')">${ROLE_LABEL[r]}</button>`).join('');
  document.getElementById('googleStep').style.display='none';
  document.getElementById('roleChooser').style.display='block';
}
function proceedLogin(role){
  ROLE=role;
  localStorage.setItem('lastRole:'+CUR_EMAIL, role);
  document.getElementById('login').style.display='none';
  document.getElementById('roleChooser').style.display='none';
  document.getElementById('salesApp').style.display='none';
  document.getElementById('adminApp').style.display='none';
  document.getElementById('managerApp').style.display='none';
  if(role==='admin'){
    document.getElementById('adminApp').style.display='block';
    setupRoleSwitcher('adminSwitchRole');
    loadAdminData();
  }else if(role==='manager'){
    document.getElementById('managerApp').style.display='block';
    document.getElementById('mgrName').textContent=CUR;
    setupRoleSwitcher('mgrSwitchRole');
    loadManagerData();
  }else{
    document.getElementById('salesApp').style.display='block';
    document.getElementById('nmT').textContent=CUR;document.getElementById('avT').textContent=CUR.slice(0,1);
    setupRoleSwitcher('salesSwitchRole');
    loadSalesData(true); 
  }
}
function setupRoleSwitcher(slotId){
  const el=document.getElementById(slotId); if(!el)return;
  const roles=rolesForEmail(CUR_EMAIL).filter(r=>r!==ROLE);
  if(roles.length){
    el.style.display='flex';
    el.innerHTML=roles.map(r=>`<button onclick="proceedLogin('${r}')">${ROLE_LABEL[r]}</button>`).join('');
  }else{ el.style.display='none'; el.innerHTML=''; }
}
function logout(){
  if(window.__fb && window.__fb.auth) window.__fb.signOut(window.__fb.auth).catch(()=>{});
  document.getElementById('login').style.display='flex';
  document.getElementById('googleStep').style.display='block';
  document.getElementById('roleChooser').style.display='none';
  document.getElementById('salesApp').style.display='none';
  document.getElementById('adminApp').style.display='none';
  document.getElementById('managerApp').style.display='none';
  const gb=document.getElementById('googleBtn');if(gb){gb.disabled=false;document.getElementById('googleBtnText').textContent='使用 Google 帳號登入';}
}

// ── 資料讀取 ──
let STOCK_LEVELS=[];
async function loadSalesData(silent){
  if(!silent)showLoad('讀取您的備貨紀錄中…');
  try{
    const res=await api('salesInit', {salesName:CUR, yearMonth:CURRENT_YM});
    if(res.status==='success'){
      DB.records = res.records||[];
      DB.logs = res.logs||[];
      STOCK_LEVELS = res.stock&&res.stock.items||[];
      SALES_LOGS_LOADED=false;
    }else if(!silent) toast('讀取資料失敗：'+(res.message||'未知錯誤'), true);
    initSales();
  }catch(err){
    if(!silent) toast('連線失敗，暫時顯示上次的資料：'+err.message, true);
    initSales();
  }finally{ if(!silent) hideLoad(); }
}
async function refreshSales(){
  const btn=document.getElementById('salesRefreshBtn');const old=btn.textContent;btn.textContent='↻ 更新中…';
  await loadSalesData(false);
  btn.textContent=old;toast('已更新為最新資料');
}

let ADMIN_LOGS_LOADED=false;
async function loadAdminData(){
  showLoad('讀取整份總表中…');
  try{
    const res=await api('adminInit', {});
    if(res.status==='success'){
      DB.records = res.data||[];
      if(res.options && res.options.salesNames && res.options.salesNames.length) SALES_NAMES = res.options.salesNames;
    }else toast('讀取總表失敗：'+(res.message||'未知錯誤'), true);
    ADMIN_LOGS_LOADED=false;
    initAdmin();
  }catch(err){
    toast('連線失敗，暫時顯示上次的資料：'+err.message, true);
    initAdmin();
  }finally{ hideLoad(); }
}
async function ensureAdminLogsLoaded(force){
  if(ADMIN_LOGS_LOADED&&!force)return;
  document.getElementById('aLogList').innerHTML=`<div class="emp-s">讀取操作紀錄中…</div>`;
  try{
    const res=await api('getLogs', {
      keyword:document.getElementById('logKw').value.trim(),
      actor:document.getElementById('logActor').value,
      dateFrom:document.getElementById('logFrom').value,
      dateTo:document.getElementById('logTo').value
    });
    if(res.status==='success'){
      DB.logs=res.data; ADMIN_LOGS_LOADED=true;
      fillLogActorOptions();
      document.getElementById('aLogCount').textContent='共 '+res.data.length+' 筆';
    }else{
      document.getElementById('aLogList').innerHTML=`<div class="emp-s" style="color:var(--bad)">讀取失敗：${esc(res.message||'未知錯誤')}</div>`;
      return;
    }
    renderALog();
  }catch(err){
    document.getElementById('aLogList').innerHTML=`<div class="emp-s" style="color:var(--bad)">連線失敗：${esc(err.message)}</div>`;
  }
}
function fillLogActorOptions(){
  const sel=document.getElementById('logActor'), cur=sel.value;
  const names=[...new Set(DB.logs.map(l=>l.actor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-TW'));
  sel.innerHTML='<option value="">全部人員</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  if(names.includes(cur))sel.value=cur;
}
let _logTimer=null;
function debounceLogSearch(){clearTimeout(_logTimer);_logTimer=setTimeout(applyLogSearch,400);}
function applyLogSearch(){renderALog();}
function resetLogSearch(){
  document.getElementById('logKw').value='';
  document.getElementById('logActor').value='';
  document.getElementById('logFrom').value='';
  document.getElementById('logTo').value='';
  renderALog();
}
async function refreshAdmin(){
  const btn=document.getElementById('adminRefreshBtn');const old=btn.textContent;btn.textContent='↻ 更新中…';
  await loadAdminData();
  btn.textContent=old;toast('已更新為最新資料');
}

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function jse(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function busy(btn,on,label){
  if(!btn)return;
  if(on){ if(btn.dataset.orig===undefined)btn.dataset.orig=btn.textContent; btn.disabled=true; btn.classList.add('is-busy'); btn.textContent=label||'處理中…'; }
  else { btn.disabled=false; btn.classList.remove('is-busy'); if(btn.dataset.orig!==undefined)btn.textContent=btn.dataset.orig; }
}
function toast(m,bad){const t=document.getElementById('tst');t.textContent=m;t.classList.toggle('bad',!!bad);t.classList.add('on');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),2800);}
function mk(el){const w=el.closest('.fw');const v=el.value&&el.value.trim()!=='';el.classList.toggle('on',v);if(w)w.classList.toggle('ok',v);fillCount();}
function fillCount(){const el=document.getElementById('fCnt');if(el)el.textContent=document.querySelectorAll('#pg-reg .fw.ok').length;}
function qd(id,off){
  const d=new Date();d.setDate(d.getDate()+off);
  const el=document.getElementById(id);
  const m=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  el.value=`${d.getFullYear()}-${m}-${dd}`;
  mk(el);
}
function bq(d){BQ=Math.max(1,Math.min(50,BQ+d));document.getElementById('bqV').value=BQ;document.getElementById('bqBtnN').textContent=BQ;}
function bqSetLive(v){document.getElementById('bqBtnN').textContent=(parseInt(v)||0);}
function bqSet(v){let n=parseInt(v);if(isNaN(n)||n<1)n=1;if(n>50)n=50;BQ=n;document.getElementById('bqV').value=BQ;document.getElementById('bqBtnN').textContent=BQ;}
function aq(d){AQ=Math.max(1,Math.min(50,AQ+d));document.getElementById('aqV').textContent=AQ;}
function val(id){return document.getElementById(id).value.trim();}

function myHistory(field){const s=new Set();DB.records.forEach(x=>{if(x.sales===CUR&&x[field])s.add(x[field]);});return[...s].sort((a,b)=>a.localeCompare(b,'zh-TW'));}
const PK={customer:{t:'選擇客戶名稱',ph:'請選擇或輸入客戶名稱',l:()=>myHistory('customer')},
  item:{t:'選擇品項',ph:'請選擇品項',l:()=>ITEM_CATALOG},
  category:{t:'選擇科別',ph:'選擇或輸入',l:()=>myHistory('category')},
  type:{t:'選擇賣/備/樣',ph:'選擇或輸入',l:()=>myHistory('type')},
  'ac-item':{t:'選擇品項',ph:'請選擇品項',l:()=>ITEM_CATALOG},
  'ac-sales':{t:'選擇業務',ph:'請選擇業務',l:()=>SALES_NAMES},
  'stock-item':{t:'選擇要設定期初庫存的品項',ph:'',l:()=>ITEM_CATALOG},
  'admin-sales-filter':{t:'篩選業務',ph:'',l:()=>SALES_NAMES},
  'admin-item-filter':{t:'篩選品項',ph:'',l:()=>ITEM_CATALOG}};
function openPk(k){PKT=k;document.getElementById('pkT').textContent=PK[k].t;document.getElementById('pkS').value='';
  document.getElementById('pkBg').classList.add('on');renderPk();setTimeout(()=>document.getElementById('pkS').focus(),80);}
function closePk(){document.getElementById('pkBg').classList.remove('on');}
function renderPk(){const all=PK[PKT].l(),q=document.getElementById('pkS').value.trim(),cur=PKV[PKT]||'';
  const f=q?all.filter(v=>v.includes(q)):all;let h='';
  if(!f.length&&!q)h+=`<div class="pk-e">尚無歷史紀錄，請直接輸入後按右上角「確認」</div>`;
  h+=f.map(v=>`<div class="pk-it ${v===cur?'on':''}" onclick="pickV('${jse(v)}')">${esc(v)}${v===cur?'<span>✓</span>':''}</div>`).join('');
  document.getElementById('pkL').innerHTML=h;}
function confirmCustomPk(){
  const v=document.getElementById('pkS').value.trim();
  if(!v){toast('請先輸入內容',true);return;}
  pickV(v);
}
function pickV(v){
  if(PKT==='stock-item'){closePk();openStockEditFor(v);return;} 
  if(PKT==='admin-sales-filter'){closePk();ASales=v;renderAChips();renderGrid();return;}
  if(PKT==='admin-item-filter'){closePk();AItem=v;renderAChips();renderGrid();return;}
  PKV[PKT]=v;const b=document.getElementById('pk-'+PKT),s=b.querySelector('.v');
  s.textContent=v;s.classList.remove('ph');b.classList.add('on');b.closest('.fw').classList.add('ok');closePk();fillCount();}
function clearPk(k){PKV[k]='';const b=document.getElementById('pk-'+k);if(!b)return;const s=b.querySelector('.v');
  s.textContent=PK[k].ph;s.classList.add('ph');b.classList.remove('on');b.closest('.fw').classList.remove('ok');fillCount();}

/* ── SALES ── */
function initSales(){
  qd('f-sd', 0);
  renderRecHead();renderMChips();renderIChips();renderRec();renderStats();renderStockFlow();renderPend();renderLogs();fillCount();
}
let SALES_LOGS_LOADED=false;
async function ensureSalesLogsLoaded(){
  if(SALES_LOGS_LOADED)return;
  document.getElementById('logList').innerHTML=`<div class="emp-s">讀取操作紀錄中…</div>`;
  const res=await api('getLogs',{salesName:CUR});
  if(res.status==='success'){DB.logs=res.data;SALES_LOGS_LOADED=true;}
  renderLogs();
}
function tab(n,b){document.querySelectorAll('#salesApp .pg').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('#salesApp .nav-b').forEach(x=>x.classList.remove('on'));
  document.getElementById('pg-'+n).classList.add('on');b.classList.add('on');window.scrollTo({top:0,behavior:'smooth'});
  if(n==='logs')ensureSalesLogsLoaded();}
function setView(v){VIEW=v;document.getElementById('vL').classList.toggle('on',v==='list');
  document.getElementById('vG').classList.toggle('on',v==='group');renderRec();}
function renderMChips(){
  const activeCols=COLS.filter(c=>hfActive(RF,c.k));
  document.getElementById('mChips').innerHTML=
    `<div class="ym-wrap"><button type="button" class="ym-btn" tabindex="-1">${FM.slice(0,4)}年${+FM.slice(5)}月<span class="ym-ico">▾</span></button>
      <input type="month" id="ymPicker" value="${FM}" class="ym-native-overlay" onchange="pickYm(this.value)"></div>`+
    `<button type="button" class="chip wo ${FShip==='hd'?'on':''}" onclick="toggleShipFilter('hd')">未送貨</button>`+
    `<button type="button" class="chip wo ${FShip==='sh'?'on':''}" onclick="toggleShipFilter('sh')">已送貨</button>`+
    `<button type="button" class="filter-ico-btn ${activeCols.length?'on':''}" onclick="openFilterModal('rec')" title="篩選">${filterIconSvg()}篩選${activeCols.length?' ('+activeCols.length+')':''}</button>`;
  document.getElementById('activeFilterChips').innerHTML=activeCols.map(c=>
    `<span class="af-chip" onclick="openFilterModal('rec','${c.k}')">${c.n}<span class="af-x" onclick="event.stopPropagation();quickClearFilter('${c.k}')">✕</span></span>`).join('');
}
function quickClearFilter(col){ delete RF[col]; renderMChips(); renderRecHead(); renderRec(); }
function filterIconSvg(){return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="4 4 20 4 14 13 14 19 10 21 10 13 4 4"></polygon></svg>`;}
function pickYm(v){if(!v)return;FM=v;renderMChips();renderRec();}
function toggleShipFilter(v){FShip=(FShip===v)?'':v;renderMChips();renderRec();}
function renderIChips(){const cnt={};DB.records.filter(x=>x.sales===CUR&&x.item).forEach(x=>cnt[x.item]=(cnt[x.item]||0)+1);
  document.getElementById('iChips').innerHTML=`<button class="chip ${FI===''?'on':''}" onclick="FI='';renderIChips();renderRec()">全部</button>`+
    Object.keys(cnt).map(i=>`<button class="chip ${FI===i?'on':''}" onclick="FI='${jse(i)}';renderIChips();renderRec()">${esc(i)}<span class="n">${cnt[i]}</span></button>`).join('');}
function myRecs(){
  let rows=DB.records.filter(x=>x.sales===CUR&&x.stockDate&&x.stockDate.startsWith(FM)&&(!FI||x.item===FI)&&(!FShip||shipStatus(x)===FShip));
  Object.keys(RF).forEach(col=>{
    const ex=RF[col];
    if(!ex||!ex.size)return;
    rows=rows.filter(x=>{
      const raw=x[col];
      const v=(raw!==undefined&&raw!==null&&String(raw).trim()!=='')?String(raw):'';
      return !ex.has(v);
    });
  });
  return rows;
}
function stOf(x){return (x.invoiceDate||x.invoiceNo)?'sh':'hd';}
// 「我的紀錄」頁面專用的送貨狀態判斷：送貨日期／客戶兩欄都有填才算已送貨，
// 跟 stOf()（發票是否登打，給行政／主管報表用）是不同的概念，先不動 stOf() 影響其他頁面。
function shipStatus(x){return (x.shipDate&&x.customer)?'sh':'hd';}
function fmtDateShort(d){
  if(!d)return'未填日期';
  const p=d.split('-');if(p.length<3)return d;
  const wd=['日','一','二','三','四','五','六'][new Date(d).getDay()];
  return `${+p[1]}/${+p[2]}（週${wd}）`;
}
// 依備貨日期分段，新到舊；同一天內的資料維持原本順序
function dateSections(rows){
  const order=[],by={};
  rows.forEach(x=>{const d=x.stockDate||'';if(!by[d]){by[d]=[];order.push(d);}by[d].push(x);});
  order.sort((a,b)=>b.localeCompare(a));
  return order.map(d=>({date:d,rows:by[d]}));
}
function pendRecs(){return DB.records.filter(x=>x.sales===CUR&&!x.customer&&(x.invoiceDate||x.invoiceNo||x.loanOut||x.loanReturn));}
let RECFULL=false;
function toggleRecFull(){RECFULL=!RECFULL;renderRecHead();renderRec();}
let GRID_COL_W={}, REC_COL_W={};
function colW(store,c){ if(store[c.k]===undefined) store[c.k]=c.w; return store[c.k]; }

function attachColResize(rowId, colgroupId, store){
  const row=document.getElementById(rowId), colgroup=document.getElementById(colgroupId);
  if(!row||!colgroup) return;
  const tableId = colgroupId==='recCol' ? 'recTableEl' : 'gridTableEl';
  row.querySelectorAll('.col-rs').forEach(handle=>{
    handle.addEventListener('mousedown', function(e){
      e.preventDefault(); e.stopPropagation();
      const key=handle.dataset.col, idx=COLS.findIndex(c=>c.k===key), col=colgroup.children[idx];
      if(!col) return;
      handle.classList.add('active');
      const table=document.getElementById(tableId);
      const startX=e.clientX, startW=col.offsetWidth||parseInt(col.style.width)||80;
      const startTableW=table?(parseInt(table.style.width)||table.offsetWidth):0;
      let raf=null, pending=startW;
      document.body.style.cursor='col-resize';
      function onMove(ev){
        pending=Math.max(40, startW+(ev.clientX-startX));
        if(!raf) raf=requestAnimationFrame(()=>{
          col.style.width=pending+'px';
          if(table)table.style.width=(startTableW+(pending-startW))+'px';
          raf=null;
        });
      }
      function onUp(){
        store[key]=pending;
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
        document.body.style.cursor=''; handle.classList.remove('active');
      }
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
  });
}
function renderRecHead(){
  document.getElementById('recCol').innerHTML=COLS.map(c=>
    `<col style="width:${colW(REC_COL_W,c)}px" class="${c.role==='a'&&!RECFULL?'colhide':''}">`).join('')+'<col style="width:112px">';
  document.getElementById('recHead').innerHTML=COLS.map(c=>{
    const active=hfActive(RF,c.k);
    const thCls=[c.role==='a'&&!RECFULL?'colhide':'','th-f',active?'th-f-on':''].filter(Boolean).join(' ');
    return `<th class="${thCls}" onclick="openHeaderFilter(event,'rec','${c.k}')">${c.n}<span class="th-fico">▾</span><span class="col-rs" data-col="${c.k}"></span></th>`;
  }).join('')
    +`<th class="th-status">狀態<button type="button" class="th-toggle" onclick="event.stopPropagation();toggleRecFull()" title="${RECFULL?'收合發票～業務欄位':'展開發票～業務欄位'}">${RECFULL?'－':'＋'}</button></th>`;
  attachColResize('recHead','recCol',REC_COL_W);
  setExactTableWidth('recTableEl',COLS,REC_COL_W,RECFULL,112);
}
function setExactTableWidth(tableId,cols,store,onlyVisible,extra){
  const table=document.getElementById(tableId);
  if(!table)return;
  let total=0;
  cols.forEach(c=>{ if(onlyVisible!==undefined && c.role==='a' && !onlyVisible) return; total+=colW(store,c); });
  table.style.width=(total+(extra||0))+'px';
}
function recRowHtml(x){
  return `<tr onclick="openEd('${x.recordId}')" style="cursor:pointer">`+COLS.map(c=>
    `<td class="pad ${(c.k==='stockDate'||c.k==='shipDate'||c.k==='invoiceDate'||c.k==='orderNo'||c.k==='invoiceNo'||c.k==='batch')?'mn':''} ${c.role==='a'&&!RECFULL?'colhide':''}">${esc(x[c.k]||'—')}</td>`).join('')+
    `<td class="pad"><span class="sm ${shipStatus(x)==='sh'?'g':'h'}">${shipStatus(x)==='sh'?'已送貨':'未送貨'}</span></td></tr>`;
}
function renderRec(){
  const rows=myRecs(),el=document.getElementById('recCards'),showItem=!FI;
  rows.sort((a,b)=>(b.stockDate||'').localeCompare(a.stockDate||'')); // 依備貨日期新到舊排序
  if(!rows.length)el.innerHTML=`<div class="emp"><div class="emp-i">＋</div><div class="emp-t">本月尚無備貨紀錄</div><div class="emp-s">前往「備貨登記」新增第一筆</div></div>`;
  else if(VIEW==='list'){
    el.innerHTML=dateSections(rows).map(sec=>`<div class="rc-date-sec">${fmtDateShort(sec.date)}</div>`+
      sec.rows.map(x=>{const fam=familyOf(x.item);
        return `<div class="rc" onclick="openEd('${x.recordId}')"><div class="rc-s" style="background:${fam.color}"></div>
        <div class="rc-b"><div class="rc-t"><span class="rc-c">${esc(x.customer||'（未填）')}<span class="rc-cat">${esc(x.category||'—')}</span></span><span class="bg ${shipStatus(x)}">${shipStatus(x)==='sh'?'已送貨':'未送貨'}</span></div>
        <div class="rc-m">${showItem?`<span style="color:${fam.color};font-weight:500">${esc(x.item||'（未填）')}</span>`:''}${typeBadge(x.type)}<span>單號 <b>${esc(x.orderNo||'—')}</b></span></div>
        </div><div class="rc-a">›</div></div>`;}).join('')
    ).join('');
  }else{
    GROUPS=[];
    el.innerHTML=dateSections(rows).map(sec=>{
      const g={};sec.rows.forEach(x=>{const k=x.customer+'|'+x.item;(g[k]=g[k]||[]).push(x)});
      const cards=Object.values(g).map(its=>{const i=GROUPS.push(its)-1,f=its[0],fam=familyOf(f.item);
        return `<div class="rc" onclick="tg(${i})"><div class="rc-s" style="background:${fam.color}"></div><div class="rc-b">
        <div class="rc-t"><span class="rc-c">${esc(f.customer||'（未填）')}<span class="rc-cat">${esc(f.category||'—')}</span><span class="rc-q">×${its.length}</span></span><span class="bg ${shipStatus(f)}">${shipStatus(f)==='sh'?'已送貨':'未送貨'}</span></div>
        <div class="rc-m">${showItem?`<span style="color:${fam.color};font-weight:500">${esc(f.item||'（未填）')}</span>`:''}</div>
        <div class="rc-sub" id="g${i}">${its.map(x=>`<div class="rc-sr" onclick="event.stopPropagation();openEd('${x.recordId}')">${typeBadge(x.type)}<span style="flex:1">單號 ${esc(x.orderNo||'—')} ${shipStatus(x)==='sh'?'已送貨':'未送貨'}</span><span>編輯 ›</span></div>`).join('')}</div>
        </div><div class="rc-a rc-a-split">
          <div class="rc-a-top" onclick="event.stopPropagation();openGroupEdit(${i})" title="批次編輯">✎</div>
          <div class="rc-a-bot" onclick="event.stopPropagation();tg(${i})" title="展開／收合">▾</div>
        </div></div>`;
      }).join('');
      return `<div class="rc-date-sec">${fmtDateShort(sec.date)}</div>`+cards;
    }).join('');
  }

  if(VIEW==='list'){
    document.getElementById('recTB').innerHTML=rows.map(recRowHtml).join('');
  }else{
    const g={};rows.forEach(x=>{const k=x.stockDate+'|'+x.customer+'|'+x.item;(g[k]=g[k]||[]).push(x)});
    const totalCols=COLS.length+1;
    document.getElementById('recTB').innerHTML=Object.values(g).map((its,i)=>{const f=its[0];
      const parent=`<tr class="grp-row" onclick="tgT(${i})" style="cursor:pointer;background:var(--sub)">
        <td class="pad mn">${esc(f.stockDate)}</td><td class="pad" colspan="${totalCols-1}">
          <b>${esc(f.customer||'（未填）')}</b> ${esc(f.item||'（未填）')} <span class="mn" style="color:var(--nav-2)">×${its.length} 筆</span>
          <span style="float:right;color:var(--tx-3)">展開 ▾</span></td></tr>`;
      const children=its.map(x=>`<tr id="tgt-${i}" style="display:none" onclick="openEd('${x.recordId}')">`+recRowHtml(x).replace(/^<tr[^>]*>/,'')).join('');
      return parent+children;
    }).join('');
  }

  document.getElementById('s1').textContent=rows.length;
  document.getElementById('s2').textContent=rows.filter(x=>shipStatus(x)==='sh').length;
  document.getElementById('s3').textContent=rows.filter(x=>shipStatus(x)==='hd').length;
  document.getElementById('s4').textContent=pendRecs().length;
  renderIB();
}
function tg(i){document.getElementById('g'+i).classList.toggle('o');}
const ITEM_PALETTE=['#16304C','#166B47','#8C6E32','#7A3B69','#2C6B6B','#8A5D0B','#5A4FA0','#B5342C'];
function itemColor(name){if(!name)return'var(--tx)';let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))>>>0;
  return ITEM_PALETTE[h%ITEM_PALETTE.length];}
const TYPE_COLOR={'賣':'sell','備':'prep','樣':'sample'};
function typeBadge(t){if(!t)return'';const cls=TYPE_COLOR[t];const label=cls?t:'其它';
  return `<span class="tbadge${cls?' '+cls:' o'}" title="${esc(t)}">${label}</span>`;}
function tgT(i){document.querySelectorAll(`#tgt-${i}`).forEach(r=>{r.style.display=r.style.display==='none'?'table-row':'none';});}
function keyHtml(){return `<div class="key"><span><i style="background:var(--ok)"></i>已送貨</span><span><i style="background:var(--nav-3)"></i>未送貨</span></div>`;}
function renderIB(){const m={};myRecs().forEach(x=>{if(!x.item)return;m[x.item]=m[x.item]||{sh:0,hd:0};m[x.item][shipStatus(x)]++});
  const e=Object.entries(m);
  document.getElementById('ibRec').innerHTML=e.length?e.map(([n,v])=>{const t=v.sh+v.hd,p=Math.round(v.sh/t*100);
    return `<div class="sp"><div class="sp-t"><span class="sp-n">${esc(n)}</span><span class="sp-v">共 <b>${t}</b> 筆</span></div>
    <div class="stk"><div class="a" style="width:${p}%"></div><div class="b" style="width:${100-p}%"></div></div></div>`;}).join('')+keyHtml()
    :`<div class="emp-s">本月尚無資料</div>`;}
function pctDelta(elId,cur,prev){
  const el=document.getElementById(elId);if(!el)return;
  if(!prev){el.textContent=cur>0?'首次紀錄':'—';el.className='dlt';return;}
  const pct=Math.round((cur-prev)/prev*100),up=pct>=0;
  el.innerHTML=(up?'▲ ':'▼ ')+Math.abs(pct)+'% 較上月';
  el.className='dlt '+(up?'up':'down');
}

function getPrevYM() {
  const [y, m] = CURRENT_YM.split('-').map(Number);
  let py = y, pm = m - 1;
  if(pm < 1) { pm = 12; py--; }
  return py + '-' + String(pm).padStart(2, '0');
}

function renderStats(){
  const rows=DB.records.filter(x=>x.sales===CUR&&x.stockDate&&x.stockDate.startsWith(CURRENT_YM));
  const prevRows=DB.records.filter(x=>x.sales===CUR&&x.stockDate&&x.stockDate.startsWith(getPrevYM()));
  const cShip=rows.filter(x=>stOf(x)==='sh').length,cHold=rows.filter(x=>stOf(x)==='hd').length,cPend=pendRecs().length;
  const pShip=prevRows.filter(x=>stOf(x)==='sh').length,pHold=prevRows.filter(x=>stOf(x)==='hd').length;
  document.getElementById('t1').textContent=rows.length;
  document.getElementById('t2').textContent=cShip;
  document.getElementById('t3').textContent=cHold;
  document.getElementById('t4').textContent=cPend;
  pctDelta('t1d',rows.length,prevRows.length);
  pctDelta('t2d',cShip,pShip);
  pctDelta('t3d',cHold,pHold);
  document.getElementById('t4d').textContent=cPend?'需要您的確認':'已全部補齊';
  document.getElementById('t4d').className='dlt'+(cPend?' down':' up');

  const v=[39,52,33,62,47,rows.length||1],mx=Math.max(...v);
  document.getElementById('chW').innerHTML=v.map((n,i)=>`<div class="ch-c"><div class="ch-b ${i===5?'now':''}" style="height:${Math.round(n/mx*100)}%"><span class="ch-v">${n}</span></div></div>`).join('');

  const fam={};
  PRODUCT_FAMILIES.forEach(f=>{
    fam[f.key]={name:f.name,color:f.color,items:{}};
    f.items.forEach(itemName=>{fam[f.key].items[itemName]={sh:0,hd:0};});
  });
  DB.records.filter(x=>x.sales===CUR&&x.item).forEach(x=>{
    const f=familyOf(x.item);
    if(!fam[f.key])return;
    if(!fam[f.key].items[x.item])fam[f.key].items[x.item]={sh:0,hd:0};
    fam[f.key].items[x.item][stOf(x)]++;
  });
  const famList=PRODUCT_FAMILIES.map(f=>fam[f.key]);
  document.getElementById('ibStat').innerHTML=`<div class="fam-page-grid">`+famList.map((f,i)=>{
    let famTotal=0;Object.values(f.items).forEach(v=>{famTotal+=v.sh+v.hd;});
    const specCells=Object.entries(f.items).map(([n,vv])=>
      `<div class="fam-spec-cell"><div class="fsn">${esc(shortItemName(n))}</div><div class="fsv">${vv.sh+vv.hd}</div></div>`).join('');
    return `<div class="fam-card ${i===0?'fam-card-wide':''}" style="border-top-color:${f.color}">
      <div class="fam-card-head"><span class="fam-swatch" style="background:${f.color}"></span><span class="fam-card-name">${esc(f.name)}</span></div>
      <div class="fam-card-total" style="color:${f.color}">${famTotal}</div>
      <div class="fam-spec-row">${specCells}</div>
    </div>`;
  }).join('')+`</div>`;

  const cm={};rows.forEach(x=>{if(x.customer)cm[x.customer]=(cm[x.customer]||0)+1;});
  const rank=Object.entries(cm).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const rmax=rank.length?rank[0][1]:1;
  document.getElementById('topCust').innerHTML=rank.length?rank.map(([name,cnt],i)=>
    `<div class="rank-row"><span class="rank-n mn">${String(i+1).padStart(2,'0')}</span><span class="rank-name">${esc(name)}</span>
     <div class="rank-bar"><span style="width:${Math.round(cnt/rmax*100)}%"></span></div><span class="rank-v mn">${cnt}</span></div>`).join('')
    :`<div class="emp-s">本月尚無資料</div>`;

  const withShip=DB.records.filter(x=>x.sales===CUR&&x.stockDate&&x.shipDate);
  const el1=document.getElementById('fulfillAvg'),elN=document.getElementById('fulfillN');
  if(withShip.length){
    const days=withShip.map(x=>(new Date(x.shipDate)-new Date(x.stockDate))/86400000);
    const avg=(days.reduce((a,b)=>a+b,0)/days.length).toFixed(1);
    el1.textContent=avg;elN.textContent=withShip.length;
    const bk={f:0,m:0,s:0};days.forEach(d=>{if(d<=1)bk.f++;else if(d<=3)bk.m++;else bk.s++;});
    const tt=withShip.length;
    document.getElementById('fulfillBars').innerHTML=[
      ['0–1 天',bk.f],['2–3 天',bk.m],['4 天以上',bk.s]
    ].map(([lbl,n])=>`<div class="fb-row"><span>${lbl}</span><div class="fb-track"><span style="width:${Math.round(n/tt*100)}%"></span></div><span class="mn">${n}</span></div>`).join('');
  }else{el1.textContent='—';elN.textContent='0';document.getElementById('fulfillBars').innerHTML=`<div class="emp-s">尚無已送貨的紀錄可供計算</div>`;}
}
function renderStockFlow(){
  const prevYMv=monthsBack(CURRENT_YM,2)[0];
  const pLabel=(+prevYMv.slice(5))+'月', cLabel=(+CURRENT_YM.slice(5))+'月';
  document.getElementById('stockFlowFormula').textContent=`${pLabel}庫存 － ${cLabel}出貨 ＝ ${cLabel}庫存`;
  let totalOpening=0,totalShipped=0,totalRemaining=0;
  STOCK_LEVELS.forEach(it=>{ totalShipped+=it.shipped||0; if(it.isSet){ totalOpening+=it.opening||0; totalRemaining+=Math.max(0,it.remaining||0); } });
  document.getElementById('stockFlowSummary').innerHTML=
    `<div class="sf-num"><div class="v">${totalOpening}</div><div class="k">${pLabel}庫存</div></div>`+
    `<div class="sf-arrow">－</div>`+
    `<div class="sf-num"><div class="v" style="color:var(--bad)">${totalShipped}</div><div class="k">${cLabel}出貨</div></div>`+
    `<div class="sf-arrow">＝</div>`+
    `<div class="sf-num"><div class="v" style="color:var(--ok)">${totalRemaining}</div><div class="k">${cLabel}庫存</div></div>`;

  const rowsEl=document.getElementById('stockFlowRows');
  if(!STOCK_LEVELS.length){
    rowsEl.innerHTML=`<div class="emp"><div class="emp-i">—</div><div class="emp-t">尚未設定任何品項的期初庫存</div><div class="emp-s">點選下方按鈕新增第一個品項</div></div>`;
    return;
  }
  const setItems=STOCK_LEVELS.filter(it=>it.isSet).sort((a,b)=>(b.remaining||0)-(a.remaining||0));
  const unsetItems=STOCK_LEVELS.filter(it=>!it.isSet);
  const bars=setItems.map(it=>{
    const total=Math.max(it.opening,it.shipped,1);
    const remain=Math.max(0,it.remaining);
    const remainPct=Math.round(remain/total*100);
    const shipPct=Math.min(100-remainPct,Math.round(it.shipped/total*100));
    const low=remain<=Math.max(2,Math.round(it.opening*0.15));
    return `<div class="wf-row" onclick="openStockEditFor('${jse(it.item)}')">
      <div class="wf-top"><span class="wf-name">${esc(it.item)}</span><span class="wf-nums">${it.opening} － ${it.shipped} ＝ <b class="${low?'low':''}">${remain}</b></span></div>
      <div class="wf-bar"><div class="wf-seg wf-remain ${low?'low':''}" style="width:${remainPct}%"></div><div class="wf-seg wf-used" style="width:${shipPct}%"></div></div>
    </div>`;
  }).join('');
  const unsetHtml=unsetItems.length?`<div class="wf-unset-title">尚未設定期初庫存</div>`+unsetItems.map(it=>{
    const sug=it.suggestedOpening!==null?`（上月剩餘 ${it.suggestedOpening} 可帶入）`:'';
    return `<div class="stk-row"><div class="stk-unset">${esc(it.item)}${it.shipped?`　本月已出貨 ${it.shipped}`:''}${sug?'　'+sug:''}</div><span class="stk-edit" onclick="openStockEditFor('${jse(it.item)}')">設定 ›</span></div>`;
  }).join(''):'';
  rowsEl.innerHTML=bars+unsetHtml;
}
function openAddStockItem(){openPk('stock-item');}
function openStockEditFor(item){
  CUR_STOCK_ITEM=item;
  document.getElementById('stockItemName').textContent=item;
  document.getElementById('stockRef').textContent=CURRENT_YM;
  const existing=STOCK_LEVELS.find(x=>x.item===item);
  const qtyEl=document.getElementById('stock-qty');
  qtyEl.value=(existing&&existing.isSet)?existing.opening:'';mk(qtyEl);
  const sugEl=document.getElementById('stockSuggest');
  if(existing&&existing.suggestedOpening!==null&&!existing.isSet){
    const pym = getPrevYM();
    sugEl.innerHTML=`上個月（${pym.split('-')[0]}年${+pym.split('-')[1]}月）剩餘 <b>${existing.suggestedOpening}</b>，
      <span style="color:var(--nav-2);text-decoration:underline;cursor:pointer" onclick="document.getElementById('stock-qty').value=${existing.suggestedOpening};mk(document.getElementById('stock-qty'))">帶入這個數字</span>`;
  }else{ sugEl.innerHTML=''; }
  document.getElementById('stockMv').classList.add('on');
}
function closeStockEdit(){document.getElementById('stockMv').classList.remove('on');}
async function saveStockEdit(btn){
  if(btn&&btn.disabled)return;
  const qty=parseInt(document.getElementById('stock-qty').value);
  if(isNaN(qty)||qty<0){toast('請輸入正確的數量',true);return;}
  busy(btn,true,'儲存中…');
  const res=await api('setOpeningStock',{salesName:CUR,yearMonth:CURRENT_YM,item:CUR_STOCK_ITEM,qty,actor:CUR});
  if(res.status==='success'){
    closeStockEdit();
    toast(`已設定「${CUR_STOCK_ITEM}」期初庫存為 ${qty}`);
    busy(btn,false);
    const [sRes] = await Promise.all([ api('getStockLevels',{salesName:CUR,yearMonth:CURRENT_YM}), refreshLogs() ]);
    if(sRes.status==='success')STOCK_LEVELS=sRes.items||[];
    renderStockFlow();renderLogs();
  }else{ toast('儲存失敗：'+(res.message||'未知錯誤'),true); busy(btn,false); }
}
function renderPend(){const rows=pendRecs(),n=rows.length;
  document.getElementById('pCnt').textContent=n;document.getElementById('pCnt2').textContent=n;
  document.getElementById('pAlert').style.display=n?'flex':'none';
  document.getElementById('pDot').style.display=n?'inline-block':'none';
  const el=document.getElementById('pendList');
  if(!n){el.innerHTML=`<div class="pn"><div class="emp"><div class="emp-i">✓</div><div class="emp-t">目前沒有待補齊項目</div><div class="emp-s">所有資料都已完整</div></div></div>`;return;}
  el.innerHTML=rows.map(x=>`<div class="pd"><div class="pd-t"><span class="pd-n">${esc(x.item||'（未指定品項）')}</span><span class="pd-d">${esc(x.invoiceDate||'—')}</span></div>
    <div class="pd-s">${x.invoiceNo?'發票 '+esc(x.invoiceNo)+' 已開立，':''}尚未有客戶與明細資料</div>
    <button class="pd-a" onclick="openEd('${x.recordId}')">補齊資料</button></div>`).join('');}

// ==========================================
// 1. 業務端與行政端的 LOG 渲染主入口
// ==========================================
let LOG_CACHE=[];

function renderLogs(){
  applySalesLogSearch(); 
}

function renderALog(){
  let l=DB.logs.slice();
  const kw = document.getElementById('logKw').value.trim().toLowerCase();
  const actor = document.getElementById('logActor').value;
  const f = document.getElementById('logFrom').value;
  const t = document.getElementById('logTo').value;
  
  if(LOGF==='fail') l=l.filter(x=>!x.ok);
  if(actor) l=l.filter(x=>x.actor===actor);
  if(kw) l=l.filter(x=>[x.act, x.desc, x.actor, x.rid, (x.diffs||[]).map(d=>d.label+d.before+d.after).join(' ')].join(' ').toLowerCase().includes(kw));
  if(f) { const ft=new Date(f+' 00:00:00').getTime(); l=l.filter(x=>x.ts>=ft); }
  if(t) { const tt=new Date(t+' 23:59:59').getTime(); l=l.filter(x=>x.ts<=tt); }
  
  LOG_CACHE=l.reverse();
  document.getElementById('aLogList').innerHTML = LOG_CACHE.length 
    ? `<div class="timeline-wrapper">` + LOG_CACHE.map((x,i)=>logHtml(x,i)).join('') + `</div>`
    : `<div class="emp-s" style="margin-top:40px;">${LOGF==='fail'?'目前沒有失敗紀錄':'尚無符合條件的操作紀錄'}</div>`;
}

// ==========================================
// 2. 產生精美時間軸卡片 (HTML)
// ==========================================
function logHtml(l, i){
  LOG_CACHE[i] = l;
  let summary = '';
  const hasDiffs = l.diffs && l.diffs.length > 0;
  
  if(hasDiffs){
    const fields = l.diffs.map(d=>d.label).join('、');
    summary = `<span style="color:var(--tx-2)">異動了 <b>${l.diffs.length}</b> 個欄位：</span><br><span style="font-size:11.5px;color:var(--tx-3)">${esc(fields)}</span>`;
  } else {
    summary = esc(l.desc || '');
  }
  
  const dotClass = !l.ok ? 'fail' : (hasDiffs ? 'edit' : 'create');
  const errHtml = (!l.ok && l.err) ? `<div class="log-err">失敗原因：${esc(l.err)}</div>` : '';
  const detailBtn = hasDiffs ? `<button type="button" class="log-detail-link" onclick="openLogDetail(${i})">查看前後對照明細 ➔</button>` : '';

  return `<div class="timeline-item">
    <div class="timeline-time">${esc(l.t.replace(' ','<br>'))}</div>
    <div class="timeline-node"><div class="timeline-dot ${dotClass}"></div></div>
    <div class="timeline-content">
      <div class="log-top">
        <span class="log-act ${l.ok?'':'fail'}">${esc(l.act)}${l.ok?'':'（失敗）'}</span>
        ${ROLE==='admin' ? `<span class="log-actor">👤 ${esc(l.actor)}</span>` : `<span class="log-actor">${l.rid ? '#'+l.rid.slice(-5).toUpperCase() : ''}</span>`}
      </div>
      <div class="log-summary">${summary}</div>
      ${errHtml}
      <div class="log-foot">
        <span class="log-src">📍 ${esc(l.src||'')}</span>
        ${detailBtn}
      </div>
    </div>
  </div>`;
}

// ==========================================
// 3. 打開明細彈窗 (產生表格化對照)
// ==========================================
function openLogDetail(i){
  const l=LOG_CACHE[i]; if(!l)return;
  document.getElementById('logDetailTitle').textContent = `${l.act}${l.ok?'':'（失敗）'}`;
  document.getElementById('logDetailMeta').innerHTML = `時間：${l.tFull||l.t} ｜ 人員：${l.actor||''} ｜ 來源：${l.src||''} <br> Record ID：${l.rid||'無'}`;
  
  let body='';
  if(l.diffs && l.diffs.length){
    body = `<table class="diff-table">
      <thead><tr><th width="30%">異動欄位</th><th>變更內容 (舊 ➔ 新)</th></tr></thead>
      <tbody>` + l.diffs.map(d=>
        `<tr>
          <td style="font-weight:600;color:var(--tx-2);">${esc(d.label)}</td>
          <td>
            ${d.before ? `<span class="diff-del">${esc(d.before)}</span> <span class="diff-arrow">➔</span> ` : `<span class="diff-arrow" style="margin-left:0">➔</span> `}
            ${d.after ? `<span class="diff-add">${esc(d.after)}</span>` : `<span class="diff-add" style="color:var(--tx-3);font-style:italic">（清除）</span>`}
          </td>
        </tr>`
      ).join('') + `</tbody></table>`;
  } else {
    body = `<div class="detail-pre">${esc(l.desc||'（無其他說明）')}</div>`;
  }
  if(!l.ok && l.err) body += `<div style="margin-top:15px;color:var(--bad);font-weight:600;">❌ 失敗原因：${esc(l.err)}</div>`;
  
  document.getElementById('logDetailBody').innerHTML = body;
  document.getElementById('logDetailMv').classList.add('on');
}

function copyLogDetails() {
    const el = document.getElementById('logDetailBody');
    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text).then(()=>{
        toast('✅ 內容已複製到剪貼簿');
    }).catch(()=>{
        toast('複製失敗，請手動圈選複製', true);
    });
}

// ==========================================
// 4. 業務端專用 LOG 篩選功能
// ==========================================
let _salesLogTimer=null;
function debounceSalesLogSearch(){ clearTimeout(_salesLogTimer); _salesLogTimer=setTimeout(applySalesLogSearch,400); }
function applySalesLogSearch(){
    let l = DB.logs.filter(x => x.actor === CUR);
    const kw = document.getElementById('salesLogKw').value.trim().toLowerCase();
    const f = document.getElementById('salesLogFrom').value;
    const t = document.getElementById('salesLogTo').value;
    
    if(kw) l = l.filter(x => [x.act, x.desc, x.rid, (x.diffs||[]).map(d=>d.label+d.before+d.after).join(' ')].join(' ').toLowerCase().includes(kw));
    if(f) { const ft=new Date(f+' 00:00:00').getTime(); l=l.filter(x=>x.ts>=ft); }
    if(t) { const tt=new Date(t+' 23:59:59').getTime(); l=l.filter(x=>x.ts<=tt); }
    
    LOG_CACHE = l.slice().reverse();
    document.getElementById('logList').innerHTML = LOG_CACHE.length 
      ? `<div class="timeline-wrapper">` + LOG_CACHE.map((x,i)=>logHtml(x,i)).join('') + `</div>` 
      : `<div class="emp-s" style="margin-top:40px;">找不到符合條件的操作紀錄</div>`;
}

// ==========================================
// 5. 匯出紀錄 (CSV)
// ==========================================
function exportLogs(mode) {
    let dataToExport = mode === 'sales' ? DB.logs.filter(x=>x.actor===CUR) : DB.logs;
    
    if(mode === 'sales') {
        const kw = document.getElementById('salesLogKw').value.trim().toLowerCase();
        const f = document.getElementById('salesLogFrom').value;
        const t = document.getElementById('salesLogTo').value;
        if(kw) dataToExport = dataToExport.filter(l => [l.act, l.desc, l.rid].join(' ').toLowerCase().includes(kw));
        if(f) { const ft=new Date(f+' 00:00:00').getTime(); dataToExport=dataToExport.filter(l=>l.ts>=ft); }
        if(t) { const tt=new Date(t+' 23:59:59').getTime(); dataToExport=dataToExport.filter(l=>l.ts<=tt); }
    } else {
        const kw = document.getElementById('logKw').value.trim().toLowerCase();
        const actor = document.getElementById('logActor').value;
        const f = document.getElementById('logFrom').value;
        const t = document.getElementById('logTo').value;
        if(LOGF==='fail') dataToExport=dataToExport.filter(x=>!x.ok);
        if(actor) dataToExport=dataToExport.filter(x=>x.actor===actor);
        if(kw) dataToExport=dataToExport.filter(x=>[x.act, x.desc, x.actor, x.rid, (x.diffs||[]).map(d=>d.label+d.before+d.after).join(' ')].join(' ').toLowerCase().includes(kw));
        if(f) { const ft=new Date(f+' 00:00:00').getTime(); dataToExport=dataToExport.filter(l=>l.ts>=ft); }
        if(t) { const tt=new Date(t+' 23:59:59').getTime(); dataToExport=dataToExport.filter(l=>l.ts<=tt); }
    }
    
    if(!dataToExport || !dataToExport.length){ toast('沒有資料可匯出', true); return; }
    
    let csv = '\uFEFF';
    csv += '時間,操作人員,動作,狀態,RecordID,異動說明,來源\n';
    dataToExport.reverse().forEach(l => {
        const time = l.tFull || l.t;
        const actor = l.actor;
        const act = l.act;
        const ok = l.ok ? '成功' : '失敗';
        const rid = l.rid || '';
        let desc = l.desc || '';
        if(l.diffs && l.diffs.length) desc = l.diffs.map(d=>`${d.label}: ${d.before}->${d.after}`).join(' | ');
        if(!l.ok && l.err) desc += ` (錯誤: ${l.err})`;
        const src = l.src || '';
        
        const row = [time, actor, act, ok, rid, desc, src].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        csv += row + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `系統操作紀錄_${nowT().replace(/[: ]/g,'')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── 以下為原本新增備貨等按鈕邏輯 ──
async function submitReg(btn){
  if(btn.disabled)return;
  const item={customer:PKV.customer||'',item:PKV.item||'',category:PKV.category||'',type:PKV.type||'',
    batch:val('f-batch'),stockDate:val('f-sd'),shipDate:val('f-hd'),orderNo:val('f-on'),remark:val('f-rm')};
  if(!item.customer||!item.item){
    addLog({act:'新增紀錄',ok:false,desc:'嘗試新增備貨紀錄',err:'必填欄位未完成（客戶名稱／品項）'});
    renderLogs();toast('請填寫客戶名稱與品項',true);return;}
  busy(btn,true,'送出中…');
  const res=await api('createRecords',{item,qty:BQ,actor:CUR});
  if(res.status==='success'){
    toast(`已建立 ${res.createdCount} 筆備貨紀錄`);
    ['f-batch','f-hd','f-on','f-rm'].forEach(id=>{const e=document.getElementById(id);e.value='';mk(e);});
    ['customer','item','category','type'].forEach(clearPk);BQ=1;bq(0);
    (res.ids||[]).forEach(id=>DB.records.push({recordId:id,...item,invoiceDate:'',invoiceNo:'',erp:'',loanReturn:'',loanOut:'',note:'',sales:CUR,updatedAt:new Date().toISOString()}));
    renderMChips();renderIChips();renderRec();renderStats();renderStockFlow();renderPend();
    tab('rec',document.querySelectorAll('#salesApp .nav-b')[1]);
    busy(btn,false);
    loadSalesData(); 
  }else{
    addLog({act:'新增紀錄',ok:false,desc:`嘗試新增客戶「${item.customer}」備貨紀錄`,err:res.message||'未知錯誤'});
    renderLogs();toast('送出失敗：'+(res.message||'未知錯誤'),true);
    busy(btn,false);
  }
}
function fillDatalist(dlId,values){const dl=document.getElementById(dlId);if(dl)dl.innerHTML=values.map(v=>`<option value="${esc(v)}">`).join('');}
function openEd(id){const x=DB.records.find(v=>v.recordId===id);if(!x)return;EDID=id;
  document.getElementById('edRef').textContent='REC / '+id;
  set('e-cu',x.customer);set('e-it',x.item);set('e-ca',x.category);set('e-ty',x.type);set('e-sd',x.stockDate);set('e-hd',x.shipDate);set('e-ba',x.batch);set('e-on',x.orderNo);
  fillDatalist('dl-e-cu',myHistory('customer'));
  fillDatalist('dl-e-it',myHistory('item'));
  fillDatalist('dl-e-ca',myHistory('category'));
  fillDatalist('dl-e-ty',myHistory('type'));
  document.getElementById('edMv').classList.add('on');}
function set(id,v){const e=document.getElementById(id);e.value=v||'';mk(e);}
function closeEd(){document.getElementById('edMv').classList.remove('on');}
function openGroupEdit(i){GEDI=i;const its=GROUPS[i];if(!its)return;
  document.getElementById('gEdRef').textContent=its.length+' 筆';
  document.getElementById('gEdCount').textContent=its.length;
  ['g-ca','g-ty','g-ba','g-hd'].forEach(id=>{const e=document.getElementById(id);e.value='';mk(e);});

  const previewCols=COLS.filter(c=>c.k!=='stockDate'&&c.k!=='customer'&&c.k!=='item'); 
  const head='<tr><th>單號</th>'+previewCols.map(c=>`<th>${c.n}</th>`).join('')+'</tr>';
  const body=its.map((x,ri)=>`<tr><td class="mn">#${ri+1} ${esc(x.orderNo||x.recordId)}</td>`+
    previewCols.map(c=>`<td class="${c.k==='remark'?'':'mn'}">${esc(x[c.k]||'—')}</td>`).join('')+'</tr>').join('');
  document.getElementById('gEdPreview').innerHTML=head+body;

  const fields=[['category','科別'],['type','賣/備/樣'],['batch','批號'],['shipDate','送貨日期']];
  let warn='';
  fields.forEach(([k,label])=>{
    const cnt={};its.forEach(x=>{const v=x[k]&&x[k].trim()?x[k]:'（空白）';cnt[v]=(cnt[v]||0)+1;});
    const keys=Object.keys(cnt);
    if(keys.length>1)warn+=`<div class="gwarn"><b>${label}</b> 組內原本不一致：${keys.map(v=>`${esc(v)}×${cnt[v]}`).join('、')}</div>`;
  });
  document.getElementById('gEdWarn').innerHTML=warn?`<div class="gwarn-box">此組別部分欄位原本就填得不一樣，套用後將全部覆蓋為您輸入的新值：${warn}</div>`:'';
  document.getElementById('gEdMv').classList.add('on');}
function closeGroupEdit(){document.getElementById('gEdMv').classList.remove('on');}
async function saveGroupEdit(btn){
  if(btn&&btn.disabled)return;
  const its=GROUPS[GEDI];if(!its)return;
  const changes={};
  const ca=val('g-ca'),ty=val('g-ty'),ba=val('g-ba'),hd=val('g-hd');
  if(ca)changes.category=ca;if(ty)changes.type=ty;if(ba)changes.batch=ba;if(hd)changes.shipDate=hd;
  if(!Object.keys(changes).length){toast('請至少填寫一個要套用的欄位');return;}
  busy(btn,true,'套用中…');
  let okAll=true,applied=0;
  for(const x of its){
    const diffs=[];Object.keys(changes).forEach(k=>{if(String(x[k]||'')!==String(changes[k]))diffs.push({label:LBL[k],before:x[k],after:changes[k]});});
    if(!diffs.length)continue;
    const res=await api('updateRecord',{recordId:x.recordId,changes,actor:CUR,source:'業務端網頁（整組批次）'});
    if(res.status==='success'){applied++;Object.assign(x,changes);}
    else{okAll=false;addLog({act:'批次修改',ok:false,rid:x.recordId,diffs,err:res.message||'未知錯誤',src:'業務端網頁（整組批次）'});}
  }
  closeGroupEdit();
  renderRec();renderStats();renderPend();
  busy(btn,false);
  if(applied===0)toast('組內資料已與輸入值相同，沒有變更');
  else toast(okAll?`已套用到 ${applied} 筆紀錄`:'部分紀錄更新失敗，請查看操作紀錄',!okAll);
  loadSalesData(); 
}
async function saveEd(btn){
  if(btn&&btn.disabled)return;
  const x=DB.records.find(v=>v.recordId===EDID);if(!x)return;
  const nv={customer:val('e-cu'),item:val('e-it'),category:val('e-ca'),type:val('e-ty'),stockDate:val('e-sd'),shipDate:val('e-hd'),batch:val('e-ba'),orderNo:val('e-on')};
  const diffs=[];Object.keys(nv).forEach(k=>{if(String(x[k]||'')!==String(nv[k]||''))diffs.push({label:LBL[k],before:x[k],after:nv[k]});});
  if(!diffs.length){toast('沒有任何變更');closeEd();return;}
  busy(btn,true,'儲存中…');
  const res=await api('updateRecord',{recordId:EDID,changes:nv,actor:CUR,expectedUpdatedAt:x.updatedAt});
  if(res.status==='success'){
    Object.assign(x,nv);
    closeEd();
    if(ROLE==='admin'){renderGrid();renderALog();}else{renderIChips();renderRec();renderStats();renderPend();}
    toast('已儲存修改，操作已記錄');
    busy(btn,false);
    if(ROLE==='admin')loadAdminData();else loadSalesData(); 
  }else if(res.status==='conflict'){
    addLog({act:'修改紀錄',ok:false,rid:EDID,diffs,err:'版本衝突：這筆資料已被他人修改'});
    renderLogs();toast('這筆資料剛剛被其他人改過，已為您載入最新版本，請重新確認後再儲存',true);
    busy(btn,false);closeEd();
    if(ROLE==='admin')loadAdminData();else loadSalesData();
  }else{
    addLog({act:'修改紀錄',ok:false,rid:EDID,diffs,err:res.message||'未知錯誤'});
    renderLogs();toast('儲存失敗：'+(res.message||'未知錯誤'),true);
    busy(btn,false);
  }}
async function delRec(btn){
  if(btn&&btn.disabled)return;
  const x=DB.records.find(v=>v.recordId===EDID);if(!x)return;
  busy(btn,true,'刪除中…');
  const res=await api('deleteRecord',{recordId:EDID,actor:CUR});
  if(res.status==='success'){
    DB.records=DB.records.filter(v=>v.recordId!==EDID); 
    closeEd();
    if(ROLE==='admin'){renderGrid();renderALog();}else{renderIChips();renderRec();renderStats();renderPend();}
    toast('已刪除此筆紀錄');
    busy(btn,false);
    if(ROLE==='admin')loadAdminData();else loadSalesData();
  }else{
    addLog({act:'刪除紀錄',ok:false,rid:EDID,err:res.message||'未知錯誤'});renderLogs();toast('刪除失敗',true);
    busy(btn,false);
  }}

/* ── ADMIN ── */
function initAdmin(){renderAChips();renderGrid();renderALog();}

/* ══════════════ MANAGER (主管儀表板) ══════════════ */
let MGR_STOCK_ALL=[];
async function loadManagerData(){
  showLoad('讀取全公司資料中…');
  try{
    const res=await api('managerInit', {});
    if(res.status==='success'){
      DB.records = res.records||[];
      MGR_STOCK_ALL = res.stock||[];
    }else toast('讀取資料失敗：'+(res.message||'未知錯誤'), true);
    renderManagerDashboard();
  }catch(err){
    toast('連線失敗：'+err.message, true);
    renderManagerDashboard();
  }finally{ hideLoad(); }
}
async function refreshManager(){
  const btn=document.getElementById('mgrRefreshBtn');const old=btn.textContent;btn.textContent='↻ 更新中…';
  await loadManagerData();
  btn.textContent=old;toast('已更新為最新資料');
}
function monthsBack(ym,n){
  const arr=[];let[y,m]=ym.split('-').map(Number);
  for(let i=n-1;i>=0;i--){let mm=m-i,yy=y;while(mm<1){mm+=12;yy--;}arr.push(yy+'-'+String(mm).padStart(2,'0'));}
  return arr;
}
let MGR_SELECTED=null;
function renderNameGrid(){
  const reportedSet=new Set(MGR_STOCK_ALL.filter(r=>r.yearMonth===CURRENT_YM).map(r=>r.sales));
  document.getElementById('mgrNameGrid').innerHTML=ROSTERS.sales.map(p=>
    `<button type="button" class="mgr-name-btn ${MGR_SELECTED===p.name?'on':''}" onclick="selectMgrPerson('${jse(p.name)}')">
      <span class="rpt-dot ${reportedSet.has(p.name)?'reported':''}"></span>${esc(p.name)}
    </button>`).join('');
}
async function selectMgrPerson(salesName){
  MGR_SELECTED=salesName;
  renderNameGrid();
  const area=document.getElementById('mgrDetailArea');
  area.scrollIntoView({behavior:'smooth',block:'nearest'});
  area.innerHTML=`<div class="emp-s">讀取 ${esc(salesName)} 的資料中…</div>`;
  const rows=DB.records.filter(x=>x.sales===salesName&&x.stockDate&&x.stockDate.startsWith(CURRENT_YM));
  const cShip=rows.filter(x=>stOf(x)==='sh').length, cHold=rows.filter(x=>stOf(x)==='hd').length;
  const res=await api('getStockLevels',{salesName,yearMonth:CURRENT_YM});
  if(MGR_SELECTED!==salesName)return;
  if(res.status!=='success'){area.innerHTML=`<div class="emp-s">讀取失敗：${esc(res.message||'未知錯誤')}</div>`;return;}
  const items=(res.items||[]).slice().sort((a,b)=>a.item.localeCompare(b.item,'zh-TW'));
  const head=`<div class="mgr-detail-head"><span class="mgr-detail-name">${esc(salesName)}</span>
    <div class="mgr-detail-stats"><span>本月備貨 <b>${rows.length}</b></span><span>已出貨 <b style="color:var(--ok)">${cShip}</b></span><span>庫存中 <b>${cHold}</b></span></div></div>`;
  if(!items.length){
    area.innerHTML=head+`<div class="emp"><div class="emp-i">—</div><div class="emp-t">${esc(salesName)} 尚未設定任何品項的期初庫存</div><div class="emp-s">也還沒有本月的備貨紀錄可供比對</div></div>`;
    return;
  }
  const allItems=ITEM_CATALOG.map(name=>{
    const found=items.find(x=>x.item===name);
    return found||{item:name,opening:null,shipped:0,remaining:null,isSet:false,suggestedOpening:null};
  }).filter(it=>it.isSet||it.shipped>0);
  if(!allItems.length){
    area.innerHTML=head+`<div class="emp"><div class="emp-i">—</div><div class="emp-t">${esc(salesName)} 本月沒有任何庫存異動</div><div class="emp-s">尚未設定期初庫存，也沒有備貨登記紀錄</div></div>`;
    return;
  }
  const chartHtml=buildStockChartSVG(allItems);
  const unsetList=allItems.filter(it=>!it.isSet&&it.shipped>0);
  const unsetHtml=unsetList.length?`<div class="cmp-unset-list">
    <div class="cmp-unset-title">尚未設定期初庫存，僅顯示本月已出貨數：</div>
    ${unsetList.map(it=>`<span class="cmp-unset-tag">${esc(it.item)} <b>${it.shipped}</b></span>`).join('')}
  </div>`:'';
  const body=`<div class="chart-scroll">${chartHtml}</div>
    ${unsetHtml}
    <div class="sr-key"><span><i style="background:#3E7CC4"></i>目前剩餘庫存</span>
    <span><i style="background:#9C2F2A"></i>本月已出貨（已建立備貨登記）</span></div>`;
  area.innerHTML=head+body;
}
function niceCeil_(v){
  if(v<=5)return 5;
  const mag=Math.pow(10,Math.floor(Math.log10(v)));
  const norm=v/mag;
  const nice=norm<=1?1:norm<=2?2:norm<=5?5:10;
  return nice*mag;
}
function buildStockChartSVG(allItems){
  const W=Math.max(560,allItems.length*76+70), H=300;
  const padL=42,padT=18,padB=76,chartH=H-padT-padB,chartR=W-16;
  const maxVal=Math.max(1,...allItems.map(it=>it.isSet?Math.max(it.opening,it.shipped):it.shipped));
  const niceMax=niceCeil_(maxVal);
  const chartW=chartR-padL, gap=chartW/allItems.length, barW=Math.min(44,gap*0.52);
  const yBase=padT+chartH;
  let grid='',ylab='';
  for(let i=0;i<=4;i++){
    const val=Math.round(niceMax*i/4);
    const y=yBase-(val/niceMax*chartH);
    grid+=`<line x1="${padL}" y1="${y}" x2="${chartR}" y2="${y}" stroke="#E3E6EA" stroke-width="1"/>`;
    ylab+=`<text x="${padL-8}" y="${y+3.5}" text-anchor="end" font-size="9.5" fill="#939DA9" font-family="'IBM Plex Mono',monospace">${val}</text>`;
  }
  let bars='',xlab='';
  allItems.forEach((it,i)=>{
    const cx=padL+gap*i+gap/2, x=cx-barW/2;
    const used=it.shipped, remain=it.isSet?it.remaining:0;
    const usedH=Math.round(used/niceMax*chartH), remH=Math.round(remain/niceMax*chartH);
    const total=it.isSet?Math.max(it.opening,used):used;
    if(remH>0)bars+=`<rect x="${x}" y="${yBase-remH}" width="${barW}" height="${remH}" fill="#3E7CC4"/>`;
    if(usedH>0)bars+=`<rect x="${x}" y="${yBase-remH-usedH}" width="${barW}" height="${usedH}" fill="#9C2F2A"/>`;
    if(total>0)bars+=`<text x="${cx}" y="${yBase-remH-usedH-6}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#101720" font-family="'IBM Plex Mono',monospace">${total}</text>`;
    const label=it.item.length>11?it.item.slice(0,10)+'…':it.item;
    xlab+=`<text x="${cx}" y="${yBase+14}" text-anchor="end" font-size="9.5" fill="#5E6A78" font-family="'Noto Sans TC',sans-serif" transform="rotate(-38 ${cx} ${yBase+14})">${esc(label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="庫存直條圖">
    ${grid}${ylab}
    <line x1="${padL}" y1="${yBase}" x2="${chartR}" y2="${yBase}" stroke="#101720" stroke-width="1.2"/>
    ${bars}${xlab}
  </svg>`;
}
function renderManagerDashboard(){
  document.getElementById('mgrYM').textContent=CURRENT_YM;
  const prevYM=monthsBack(CURRENT_YM,2)[0];
  const rows=DB.records.filter(x=>x.stockDate&&x.stockDate.startsWith(CURRENT_YM));
  const prevRows=DB.records.filter(x=>x.stockDate&&x.stockDate.startsWith(prevYM));
  const cShip=rows.filter(x=>stOf(x)==='sh').length, cHold=rows.filter(x=>stOf(x)==='hd').length;
  const cPend=DB.records.filter(x=>!x.customer&&(x.invoiceDate||x.invoiceNo||x.loanOut||x.loanReturn)).length;
  const pShip=prevRows.filter(x=>stOf(x)==='sh').length, pHold=prevRows.filter(x=>stOf(x)==='hd').length;
  document.getElementById('m1').textContent=rows.length;
  document.getElementById('m2').textContent=cShip;
  document.getElementById('m3').textContent=cHold;
  document.getElementById('m4').textContent=cPend;
  pctDelta('m1d',rows.length,prevRows.length);
  pctDelta('m2d',cShip,pShip);
  pctDelta('m3d',cHold,pHold);
  document.getElementById('m4d').textContent=cPend?'需要追蹤':'目前無積壓';
  document.getElementById('m4d').className='dlt'+(cPend?' down':' up');

  const months=monthsBack(CURRENT_YM,6);
  const counts=months.map(ym=>DB.records.filter(x=>x.stockDate&&x.stockDate.startsWith(ym)).length);
  const mx=Math.max(...counts,1);
  document.getElementById('mgrChart').innerHTML=counts.map((n,i)=>
    `<div class="ch-c"><div class="ch-b ${i===counts.length-1?'now':''}" style="height:${Math.round(n/mx*100)}%"><span class="ch-v">${n}</span></div></div>`).join('');
  document.getElementById('mgrChartX').innerHTML=months.map(ym=>`<span>${+ym.slice(5)}月</span>`).join('');

  const fam={};
  rows.forEach(x=>{if(!x.item)return;const f=familyOf(x.item);
    fam[f.key]=fam[f.key]||{name:f.name,color:f.color,total:0,ship:0};
    fam[f.key].total++; if(stOf(x)==='sh')fam[f.key].ship++;});
  const famList=PRODUCT_FAMILIES.map(f=>fam[f.key]).filter(Boolean);
  const famMax=famList.length?Math.max(...famList.map(f=>f.total)):1;
  document.getElementById('mgrFamily').innerHTML=famList.length?famList.map(f=>`
    <div class="fam-block" style="border-left-color:${f.color}">
      <div class="fam-head"><span class="fam-dot" style="background:${f.color}"></span><span class="fam-name">${esc(f.name)}</span>
        <span class="fam-total">已出貨 <b class="mn" style="color:${f.color};font-size:13px">${f.ship}</b> ／ 本月共 <b class="mn">${f.total}</b> 筆</span></div>
      <div class="stk"><div class="a" style="width:${Math.round(f.total/famMax*100)}%;background:${f.color}"></div><div class="b"></div></div>
    </div>`).join('') : `<div class="emp-s">本月尚無資料</div>`;

  const bySales={};
  ROSTERS.sales.forEach(p=>{bySales[p.name]={stock:0,ship:0,hold:0,pend:0};});
  rows.forEach(x=>{if(!x.sales)return;if(!bySales[x.sales])bySales[x.sales]={stock:0,ship:0,hold:0,pend:0};
    bySales[x.sales].stock++; if(stOf(x)==='sh')bySales[x.sales].ship++; else bySales[x.sales].hold++;});
  DB.records.forEach(x=>{if(!x.sales||x.customer||!(x.invoiceDate||x.invoiceNo||x.loanOut||x.loanReturn))return;
    if(!bySales[x.sales])bySales[x.sales]={stock:0,ship:0,hold:0,pend:0}; bySales[x.sales].pend++;});
  const rankArr=Object.entries(bySales).map(([name,v])=>({name,...v,rate:v.stock?Math.round(v.ship/v.stock*100):0}));
  rankArr.sort((a,b)=>b.stock-a.stock);
  document.getElementById('mgrRankBody').innerHTML=rankArr.map(r=>`
    <tr class="rank-clickable" onclick="selectMgrPerson('${jse(r.name)}')"><td class="pad">${esc(r.name)}</td><td class="pad mn">${r.stock}</td>
    <td class="pad mn" style="color:var(--ok)">${r.ship}</td><td class="pad mn">${r.hold}</td>
    <td class="pad mn" style="color:${r.pend>0?'var(--bad)':'var(--tx-3)'}">${r.pend}</td>
    <td class="pad mn">${r.stock?r.rate+'%':'—'}</td></tr>`).join('');

  const reportedSet=new Set(MGR_STOCK_ALL.filter(r=>r.yearMonth===CURRENT_YM).map(r=>r.sales));
  const totalN=ROSTERS.sales.length, reportedN=reportedSet.size;
  document.getElementById('mgrStockProgN').textContent=reportedN+' / '+totalN+' 人已回報本月期初庫存';
  document.getElementById('mgrStockProgBar').style.width=Math.round(reportedN/totalN*100)+'%';
  renderNameGrid();
  renderMgrStockHealth();
  renderMgrTopHolders();
  if(!MGR_SELECTED && ROSTERS.sales.length){ selectMgrPerson(ROSTERS.sales[0].name); } 
}
// ── 業務庫存健康度：每個業務的 期初－出貨＝剩餘，依週轉率排序，
// 週轉率越低代表這個月實際出貨占身上庫存的比例越小，可能備貨過量 ──
function computePersonStockHealth(ym){
  const openingMap={};
  MGR_STOCK_ALL.filter(r=>r.yearMonth===ym).forEach(r=>{ openingMap[r.sales]=(openingMap[r.sales]||0)+Number(r.qty||0); });
  const shippedMap={};
  DB.records.forEach(r=>{ if(!r.sales||!r.stockDate||r.stockDate.indexOf(ym)!==0)return; shippedMap[r.sales]=(shippedMap[r.sales]||0)+1; });
  const names=new Set([...Object.keys(openingMap),...Object.keys(shippedMap)]);
  return [...names].map(name=>{
    const opening=openingMap[name]||0, shipped=shippedMap[name]||0, remaining=Math.max(0,opening-shipped);
    return {sales:name,opening,shipped,remaining,turnover:opening>0?Math.round(shipped/opening*100):null};
  });
}
function renderMgrStockHealth(){
  const health=computePersonStockHealth(CURRENT_YM).sort((a,b)=>(a.turnover===null?999:a.turnover)-(b.turnover===null?999:b.turnover));
  let totalOpening=0,totalShipped=0,totalRemaining=0;
  health.forEach(h=>{totalOpening+=h.opening;totalShipped+=h.shipped;totalRemaining+=h.remaining;});
  document.getElementById('mgrStockFormula').textContent=`${+CURRENT_YM.slice(5)}月全公司庫存健康度`;
  document.getElementById('mgrStockSummary').innerHTML=
    `<div class="sf-num"><div class="v">${totalOpening}</div><div class="k">總期初庫存</div></div>`+
    `<div class="sf-arrow">－</div>`+
    `<div class="sf-num"><div class="v" style="color:var(--bad)">${totalShipped}</div><div class="k">本月總出貨</div></div>`+
    `<div class="sf-arrow">＝</div>`+
    `<div class="sf-num"><div class="v" style="color:var(--ok)">${totalRemaining}</div><div class="k">目前總庫存</div></div>`;
  const el=document.getElementById('mgrStockRanking');
  if(!health.length){ el.innerHTML=`<div class="emp-s">本月尚無業務設定期初庫存</div>`; return; }
  el.innerHTML=`<div style="font-size:11px;color:var(--tx-3);margin-bottom:14px;line-height:1.7">依「週轉率」由低到高排序——週轉率越低，代表業務身上的庫存這個月實際出貨的比例越小，可能備貨過量，值得了解原因。</div>`+
    health.map(h=>{
      const low=h.turnover!==null&&h.turnover<20;
      const base=Math.max(h.opening,h.shipped,1);
      return `<div class="wf-row" style="cursor:pointer" onclick="selectMgrPerson('${jse(h.sales)}')">
        <div class="wf-top"><span class="wf-name">${esc(h.sales)}</span><span class="wf-nums">${h.opening} － ${h.shipped} ＝ ${h.remaining}　週轉率 <b class="${low?'low':''}">${h.turnover===null?'—':h.turnover+'%'}</b></span></div>
        <div class="wf-bar"><div class="wf-seg wf-remain ${low?'low':''}" style="width:${Math.round(h.remaining/base*100)}%"></div><div class="wf-seg wf-used" style="width:${Math.round(h.shipped/base*100)}%"></div></div>
      </div>`;
    }).join('');
}
// ── 品項庫存留存排行：依「業務＋品項」目前剩餘庫存排名，看誰身上囤了最多哪個品項 ──
function topStockHolders(ym){
  const usedMap={};
  DB.records.forEach(r=>{ if(!r.sales||!r.item||!r.stockDate||r.stockDate.indexOf(ym)!==0)return; const k=r.sales+'||'+r.item; usedMap[k]=(usedMap[k]||0)+1; });
  const list=MGR_STOCK_ALL.filter(r=>r.yearMonth===ym).map(r=>{
    const key=r.sales+'||'+r.item;
    return {sales:r.sales,item:r.item,opening:Number(r.qty||0),remaining:Math.max(0,Number(r.qty||0)-(usedMap[key]||0))};
  }).filter(x=>x.remaining>0);
  list.sort((a,b)=>b.remaining-a.remaining);
  return list;
}
let MGR_TOP_EXPANDED=false;
function renderMgrTopHolders(){
  const list=topStockHolders(CURRENT_YM);
  const show=MGR_TOP_EXPANDED?list:list.slice(0,5);
  const vmax=list.length?list[0].remaining:1;
  document.getElementById('mgrTopHolders').innerHTML=show.length?show.map((x,i)=>
    `<div class="rank-row"><span class="rank-n mn">${String(i+1).padStart(2,'0')}</span><span class="rank-name">${esc(x.sales)} · ${esc(x.item)}</span>
     <div class="rank-bar"><span style="width:${Math.round(x.remaining/vmax*100)}%"></span></div><span class="rank-v mn">${x.remaining}</span></div>`
  ).join(''):`<div class="emp-s">目前沒有任何剩餘庫存資料</div>`;
  document.getElementById('mgrTopHoldersMore').innerHTML=list.length>5?
    `<button class="btn-g" onclick="toggleMgrTopExpand()">${MGR_TOP_EXPANDED?'收合':'查看完整排名（共 '+list.length+' 筆）'}</button>`:'';
}
function toggleMgrTopExpand(){MGR_TOP_EXPANDED=!MGR_TOP_EXPANDED;renderMgrTopHolders();}
function isFilled(v){return v!==undefined&&v!==null&&String(v).trim().length>0;}
function effVal(x,k){const ek=x.recordId+'::'+k;return EDITS[ek]!==undefined?EDITS[ek]:x[k];}
function atab(n,b){document.querySelectorAll('#adminApp .pg').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('#adminApp .nav-b').forEach(x=>x.classList.remove('on'));
  document.getElementById('apg-'+n).classList.add('on');b.classList.add('on');window.scrollTo({top:0,behavior:'smooth'});
  if(n==='alog')ensureAdminLogsLoaded();}
function renderGridHead(stats){
  document.getElementById('gridCol').innerHTML=COLS.map(c=>`<col style="width:${colW(GRID_COL_W,c)}px">`).join('');
  document.getElementById('gridHead').innerHTML=COLS.map(c=>{
    let badge='';
    if(stats){
      if(c.k==='batch')badge=`<span class="hbadge">${stats.batch}</span>`;
      else if(c.k==='shipDate')badge=`<span class="hbadge">${stats.ship}</span>`;
      else if(c.k==='item')badge=`<span class="hbadge">${stats.item}</span>`;
    }
    // 表頭篩選：每一欄都能點表頭篩選（像 Excel 的自動篩選），有篩選中的欄位只用小箭頭變色標示，
    // 不整格反白，看起來才不會很突兀。
    const active=hfActive(HF,c.k);
    const thCls=[c.role==='a'?'g2':'', 'th-f', active?'th-f-on':''].filter(Boolean).join(' ');
    return `<th class="${thCls}" onclick="openHeaderFilter(event,'admin','${c.k}')">${c.n}<span class="th-fico">▾</span>${badge}<span class="col-rs" data-col="${c.k}"></span></th>`;
  }).join('');
  attachColResize('gridHead','gridCol',GRID_COL_W);
  setExactTableWidth('gridTableEl',COLS,GRID_COL_W,undefined,0);
}
function renderAChips(){
  const sc={};DB.records.forEach(x=>{if(x.sales)sc[x.sales]=(sc[x.sales]||0)+1});
  document.getElementById('aSalesChips').innerHTML=
    `<button class="chip ${ASales===''?'on':''}" onclick="ASales='';renderAChips();renderGrid()">全部</button>`+
    SALES_NAMES.filter(s=>sc[s]).map(s=>`<button class="chip ${ASales===s?'on':''}" onclick="ASales='${jse(s)}';renderAChips();renderGrid()">${esc(s)}<span class="n">${sc[s]}</span></button>`).join('');
  const ic={};DB.records.forEach(x=>{if(x.item)ic[x.item]=(ic[x.item]||0)+1});
  document.getElementById('aItemChips').innerHTML=
    `<button class="chip ${AItem===''?'on':''}" onclick="AItem='';renderAChips();renderGrid()">全部</button>`+
    ITEM_CATALOG.filter(i=>ic[i]).map(i=>`<button class="chip ${AItem===i?'on':''}" onclick="AItem='${jse(i)}';renderAChips();renderGrid()">${esc(i)}<span class="n">${ic[i]}</span></button>`).join('');
  document.getElementById('aEmptyChips').innerHTML=EMPTY_F.map(f=>`<button class="chip wo ${AEmpty.has(f.k)?'on':''}" onclick="tglEmpty('${f.k}')">${f.n}</button>`).join('');
  const activeCols=COLS.filter(c=>hfActive(HF,c.k));
  document.getElementById('adminActiveFilterChips').innerHTML=activeCols.map(c=>
    `<span class="af-chip" onclick="openFilterModal('admin','${c.k}')">${c.n}<span class="af-x" onclick="event.stopPropagation();quickClearAdminFilter('${c.k}')">✕</span></span>`).join('');
}
function quickClearAdminFilter(col){ delete HF[col]; renderAChips(); renderGrid(); }

// ── 表頭篩選（Excel 自動篩選風格）：每一欄都能點表頭，勾選要顯示的值 ──
// 行政總表跟業務「我的紀錄」共用同一套彈窗機制，用 HF_CTX 分辨目前是哪一邊：
// HF＝行政總表的篩選狀態，RF＝業務我的紀錄的篩選狀態。[欄位]＝「要排除、不顯示」的值集合，
// 沒有這個 key 或集合是空的＝該欄沒有篩選（全部顯示）
let HF={},RF={};
function hfActive(state,col){return !!(state[col] && state[col].size);}

// ── 篩選 Modal：點表頭（電腦版）或「篩選」按鈕（手機版）都會開同一個視窗，
// 左邊選欄位、右邊勾選值，可以切換好幾個欄位設定條件，最後按「確定套用」才會真的套用。
// 改用置中的 Modal（跟站內其他彈窗共用同一套穩定機制），比原本用 JS 算座標浮動在按鈕旁邊的
// 彈出視窗更可靠：不會有位置算錯、跑出畫面外、或在手機上點不到的問題。
let FCTX=null,FSTAGE=null,FFIELD=null;
function filterRowsFor(ctx){ return ctx==='rec' ? DB.records.filter(x=>x.sales===CUR&&x.stockDate&&x.stockDate.startsWith(FM)) : DB.records; }
function filterStateFor(ctx){ return ctx==='rec' ? RF : HF; }
function filterColValues(col){
  const counts=new Map();
  filterRowsFor(FCTX).forEach(x=>{
    const raw=x[col];
    const v=(raw!==undefined&&raw!==null&&String(raw).trim()!=='')?String(raw):'';
    counts.set(v,(counts.get(v)||0)+1);
  });
  const arr=[...counts.entries()];
  arr.sort((a,b)=>{ if(a[0]==='')return 1; if(b[0]==='')return -1; return b[1]-a[1]; });
  return arr;
}
function openHeaderFilter(e,ctx,col){
  if(e.target && e.target.classList && e.target.classList.contains('col-rs'))return; // 避免拖曳欄寬的把手誤觸篩選
  e.stopPropagation();
  openFilterModal(ctx,col);
}
function openFilterModal(ctx,field){
  FCTX=ctx;
  const src=filterStateFor(ctx);
  FSTAGE={}; Object.keys(src).forEach(k=>{ if(src[k]&&src[k].size) FSTAGE[k]=new Set(src[k]); });
  FFIELD=field||COLS[0].k;
  document.getElementById('filterModalTitle').textContent = ctx==='admin' ? '篩選 · 行政總表' : '篩選 · 我的紀錄';
  document.getElementById('filterValueSearch').value='';
  renderFilterModal();
  document.getElementById('filterMv').classList.add('on');
}
function closeFilterModal(){ document.getElementById('filterMv').classList.remove('on'); FCTX=null;FSTAGE=null;FFIELD=null; }
function renderFilterModal(){
  document.getElementById('filterFieldList').innerHTML=COLS.map(c=>{
    const active=FSTAGE[c.k]&&FSTAGE[c.k].size;
    return `<div class="ff-it ${FFIELD===c.k?'on':''}" onclick="selectFilterField('${c.k}')">${c.n}${active?'<span class="ff-dot"></span>':''}</div>`;
  }).join('');
  renderFilterValueList();
}
function selectFilterField(k){ FFIELD=k; document.getElementById('filterValueSearch').value=''; renderFilterModal(); }
function renderFilterValueList(){
  const col=FFIELD; if(!col)return;
  const q=document.getElementById('filterValueSearch').value.trim();
  const all=filterColValues(col);
  const list=q?all.filter(([v])=>(v===''?'（空白）':v).includes(q)):all;
  const ex=FSTAGE[col]||new Set();
  document.getElementById('filterValueList').innerHTML=list.length? list.map(([v,n])=>{
    const checked=!ex.has(v);
    const label=v===''?'（空白）':esc(v);
    return `<label class="fv-it"><input type="checkbox" ${checked?'checked':''} onchange="toggleFilterVal('${jse(v)}',this.checked)"><span class="fv-lb">${label}</span><span class="n">${n}</span></label>`;
  }).join('') : `<div class="hf-empty">沒有符合的值</div>`;
}
function toggleFilterVal(v,checked){
  if(!FSTAGE[FFIELD])FSTAGE[FFIELD]=new Set();
  if(checked)FSTAGE[FFIELD].delete(v); else FSTAGE[FFIELD].add(v);
  if(FSTAGE[FFIELD].size===0)delete FSTAGE[FFIELD];
  renderFilterModal(); // 順便更新左側欄位小圓點提示
}
function filterSelectAllField(){ delete FSTAGE[FFIELD]; renderFilterModal(); }
function filterClearField(){ FSTAGE[FFIELD]=new Set(filterColValues(FFIELD).map(([v])=>v)); renderFilterModal(); }
function resetAllFilters(){ FSTAGE={}; renderFilterModal(); }
function applyFilterModal(){
  const state=filterStateFor(FCTX);
  Object.keys(state).forEach(k=>delete state[k]);
  Object.keys(FSTAGE).forEach(k=>{ if(FSTAGE[k]&&FSTAGE[k].size) state[k]=new Set(FSTAGE[k]); });
  if(FCTX==='admin'){ renderAChips();renderGrid(); } else { renderMChips();renderRecHead(); renderRec(); }
  closeFilterModal();
}
function clearAdminFilter(which){
  if(which==='sales')ASales=''; else AItem='';
  renderAChips();renderGrid();
}
function tglEmpty(k){AEmpty.has(k)?AEmpty.delete(k):AEmpty.add(k);renderAChips();renderGrid();}
function resetFilters(){ASales='';AItem='';AEmpty.clear();HF={};renderAChips();renderGrid();}
function gridRows(){let rows=DB.records.slice();
  if(ASales)rows=rows.filter(x=>x.sales===ASales);
  if(AItem)rows=rows.filter(x=>x.item===AItem);
  if(AEmpty.size)rows=rows.filter(x=>[...AEmpty].some(k=>!x[k]));
  Object.keys(HF).forEach(col=>{
    const ex=HF[col];
    if(!ex||!ex.size)return;
    rows=rows.filter(x=>{
      const raw=x[col];
      const v=(raw!==undefined&&raw!==null&&String(raw).trim()!=='')?String(raw):'';
      return !ex.has(v);
    });
  });
  return rows;}

// ── 行政總表：分批非同步渲染 ──
// 借出單分區：同一張「借出單」的資料排在一起、底色一致、外框標示，方便行政一眼看出同一單有哪些筆。
// 這裡直接在既有的逐列渲染迴圈裡判斷分組起訖並加上 class（loan-group / loan-group-start / loan-group-end），
// 不用額外寫一支「渲染完再重新掃一次 DOM、比對每一列 textContent」的函式：
// 因為分組所需的資料（借出單欄位值）本來就在 GRID 陣列裡，渲染當下就能順便判斷，
// 不必事後再去讀 DOM（讀 DOM／比對 textContent 屬於「強制回流」的操作，資料量大時比較傷效能）。
// 效果一樣，只是換一個更省力的做法達成。
const LOAN_GROUP_COLS = ['stockDate','batch','loanOut']; // 借出單／備貨日期／批號
const LOAN_COLOR_N = 6; // 底色循環使用幾種顏色
let _gridRenderTimer = null;
function renderGrid(){
  GRID=gridRows();
  // 有填「借出單」的資料，依借出單分組排在一起（組內再依備貨日期/品項/業務排序）；
  // 沒有借出單的資料維持原本排序邏輯，統一排在最後。
  GRID.sort((a,b)=>{
    const la=effVal(a,'loanOut')||'', lb=effVal(b,'loanOut')||'';
    if(la!==lb){
      if(!la)return 1;
      if(!lb)return -1;
      return la.localeCompare(lb);
    }
    return (a.stockDate||'').localeCompare(b.stockDate||'')||(a.item||'').localeCompare(b.item||'')||(a.sales||'').localeCompare(b.sales||'');
  });

  const tbody = document.getElementById('gridBody');
  tbody.innerHTML = ''; 
  if(_gridRenderTimer) clearTimeout(_gridRenderTimer); 

  document.getElementById('aCnt').textContent=GRID.length;
  const ok=GRID.filter(x=>x.customer&&x.item&&x.stockDate).length;
  document.getElementById('aOk').textContent=ok;document.getElementById('aNo').textContent=GRID.length-ok;
  
  const batchN=GRID.filter(x=>isFilled(effVal(x,'batch'))).length;
  const shipN=GRID.filter(x=>isFilled(effVal(x,'shipDate'))).length;
  renderGridHead({batch:batchN,ship:shipN,item:batchN-shipN});
  updEditBar();

  let band=false, lastKey=null, i=0, loanColorIdx=-1;
  const CHUNK_SIZE = 80; 

  function renderChunk() {
    let html = '';
    const end = Math.min(i + CHUNK_SIZE, GRID.length);
    for (; i < end; i++) {
      const x = GRID[i];
      const loanVal = effVal(x,'loanOut');
      const grouped = isFilled(loanVal);
      let trCls='';
      if(grouped){
        const prevVal = i>0 ? effVal(GRID[i-1],'loanOut') : null;
        const nextVal = i<GRID.length-1 ? effVal(GRID[i+1],'loanOut') : null;
        const isFirst = prevVal!==loanVal, isLast = nextVal!==loanVal;
        if(isFirst) loanColorIdx=(loanColorIdx+1)%LOAN_COLOR_N;
        trCls='loan-group'+(isFirst?' loan-group-start':'')+(isLast?' loan-group-end':'');
      }else{
        const key=(x.stockDate||'')+'|'+(x.item||'')+'|'+(x.sales||'');
        if(key!==lastKey){band=!band;lastKey=key;}
        trCls=band?'band':'';
      }
      html += `<tr class="${trCls}">`+COLS.map(c=>{
        const ek=x.recordId+'::'+c.k, ed=EDITS[ek]!==undefined, v=ed?EDITS[ek]:(x[c.k]||'');
        const isDateCol=(c.k==='stockDate'||c.k==='shipDate'||c.k==='invoiceDate');
        const loanBg=(grouped && LOAN_GROUP_COLS.includes(c.k))?(' loan-c'+loanColorIdx):'';
        return `<td><input class="cel ${ed?'ed':''} ${isDateCol?'mn':''}${loanBg}" data-rid="${x.recordId}" data-col="${c.k}" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="" value="${esc(v)}" oninput="cellEdit(this)" onpaste="cellPaste(event,this)"></td>`;
      }).join('')+`</tr>`;
    }
    
    tbody.insertAdjacentHTML('beforeend', html);
    
    if (i < GRID.length) {
      _gridRenderTimer = setTimeout(renderChunk, 12); 
    }
  }
  
  if(GRID.length > 0) renderChunk();
}

function cellEdit(el){const rid=el.dataset.rid,col=el.dataset.col,ek=rid+'::'+col;
  const rec=DB.records.find(x=>x.recordId===rid);
  if(String(el.value||'')===String(rec[col]||'')){delete EDITS[ek];el.classList.remove('ed');}
  else{EDITS[ek]=el.value;el.classList.add('ed');}
  if(col==='batch'||col==='shipDate'){
    const batchN=GRID.filter(x=>isFilled(effVal(x,'batch'))).length;
    const shipN=GRID.filter(x=>isFilled(effVal(x,'shipDate'))).length;
    renderGridHead({batch:batchN,ship:shipN,item:batchN-shipN});
  }
  updEditBar();}
function cellPaste(e,el){const txt=(e.clipboardData||window.clipboardData).getData('text');
  if(!txt||(!txt.includes('\t')&&!txt.includes('\n')))return;
  e.preventDefault();
  const rows=txt.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(r=>r.split('\t'));
  const ri=GRID.findIndex(x=>x.recordId===el.dataset.rid),ci=COLS.findIndex(c=>c.k===el.dataset.col);
  let n=0;
  rows.forEach((cells,dr)=>{const rec=GRID[ri+dr];if(!rec)return;
    cells.forEach((v,dc)=>{const col=COLS[ci+dc];if(!col)return;
      const ek=rec.recordId+'::'+col.k,vv=v.trim();
      if(String(rec[col.k]||'')===vv)delete EDITS[ek];else{EDITS[ek]=vv;n++;}});});
  renderGrid();toast(`已貼上 ${n} 格資料，請確認後送出`);}
function updEditBar(){const n=Object.keys(EDITS).length;
  document.getElementById('aEditN').textContent=n;
  document.getElementById('aEdit').style.display=n?'inline':'none';
  document.getElementById('btnSubmitGrid').disabled=!n;}
function revertGrid(){if(!Object.keys(EDITS).length){toast('目前沒有未送出的變更');return;}
  const n=Object.keys(EDITS).length;EDITS={};renderGrid();toast(`已還原 ${n} 格變更`);}
function buildDiffs(){const by={};
  Object.keys(EDITS).forEach(ek=>{const i=ek.indexOf('::'),rid=ek.slice(0,i),col=ek.slice(i+2);
    const rec=DB.records.find(x=>x.recordId===rid);if(!rec)return;
    (by[rid]=by[rid]||{rec,list:[]}).list.push({key:col,label:LBL[col],before:rec[col]||'',after:EDITS[ek]||''});});
  return by;}
function openDiff(){const by=buildDiffs(),ks=Object.keys(by);if(!ks.length)return;
  let cells=0;ks.forEach(k=>cells+=by[k].list.length);
  document.getElementById('dfCount').textContent=`${ks.length} 筆資料 · ${cells} 個欄位`;
  document.getElementById('dfBody').innerHTML=
    `<div style="font-size:12px;color:var(--tx-2);margin-bottom:14px;line-height:1.75">以下變更將寫入試算表，請確認「舊值 → 新值」無誤後送出。送出結果（成功或失敗）都會完整記錄於操作紀錄。</div>`+
    ks.map(rid=>{const{rec,list}=by[rid];
      return `<div class="df"><div class="df-h"><span>${esc(rec.customer||'（未填客戶）')} ${esc(rec.item||'（未填品項）')}</span><span class="m">${esc(rec.sales||'—')} · ${esc(rid)}</span></div>
      ${list.map(d=>`<div class="df-r"><span class="df-k">${esc(d.label)}</span>
        <span class="df-v"><span class="dl">${esc(d.before||'（空白）')}</span> <span style="color:var(--tx-3)">→</span> <span class="nw">${esc(d.after||'（空白）')}</span></span></div>`).join('')}</div>`;}).join('');
  document.getElementById('dfMv').classList.add('on');}
function closeDiff(){document.getElementById('dfMv').classList.remove('on');}
async function commitGrid(btn){
  if(btn&&btn.disabled)return;
  const by=buildDiffs(),ks=Object.keys(by);
  const updates=ks.map(rid=>{const ch={};by[rid].list.forEach(d=>ch[d.key]=d.after);return{recordId:rid,changes:ch};});
  busy(btn,true,'送出中…');
  const res=await api('batchUpdate',{updates,actor:CUR});
  if(res.status==='success'){
    ks.forEach(rid=>{const ch={};by[rid].list.forEach(d=>ch[d.key]=d.after);const rec=DB.records.find(r=>r.recordId===rid);if(rec)Object.assign(rec,ch);});
    EDITS={};closeDiff();renderGrid();
    toast(`已更新 ${ks.length} 筆資料，操作已記錄`);
    busy(btn,false);
    loadAdminData(); 
  }else{
    ks.forEach(rid=>addLog({act:'修改紀錄',ok:false,rid,diffs:by[rid].list,err:res.message||'未知錯誤',src:'行政端總表'}));
    closeDiff();renderALog();toast('送出失敗：'+(res.message||'未知錯誤'),true);
    busy(btn,false);
  }}
async function adminCreate(btn){
  if(btn&&btn.disabled)return;
  const item=PKV['ac-item'],sales=PKV['ac-sales']||'';
  if(!item){addLog({act:'快速建立',ok:false,desc:'嘗試快速建立備貨資料',err:'未選擇品項',src:'行政端網頁'});
    renderALog();toast('請選擇品項',true);return;}
  busy(btn,true,'建立中…');
  const res=await api('adminQuickCreate',{item,qty:AQ,sales,invoiceDate:val('ac-id'),invoiceNo:val('ac-in'),erp:val('ac-erp'),loanReturn:val('ac-lr'),loanOut:val('ac-lo')});
  const who=sales?`業務「${sales}」`:'（尚未指定業務）';
  if(res.status==='success'){
    ['ac-id','ac-in','ac-erp','ac-lr','ac-lo'].forEach(id=>{const e=document.getElementById(id);e.value='';mk(e);});
    clearPk('ac-item');clearPk('ac-sales');AQ=1;aq(0);
    toast(`已建立 ${res.createdCount} 筆${sales?'，業務「'+sales+'」下次登入／重新整理會看到補齊提醒':'，可於總表指定業務'}`);
    busy(btn,false);
    loadAdminData(); 
  }else{
    addLog({act:'快速建立',ok:false,desc:`嘗試為${who}建立 ${AQ} 筆「${item}」`,err:res.message||'未知錯誤',src:'行政端網頁'});
    renderALog();toast('建立失敗',true);
    busy(btn,false);
  }}
function setLogF(f){LOGF=f;document.getElementById('lgAll').classList.toggle('on',f==='all');
  document.getElementById('lgFail').classList.toggle('on',f==='fail');renderALog();}
