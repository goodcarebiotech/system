/* ══ CONFIG：GAS 部署網址 ══ */
const CFG={GAS_URL:'https://script.google.com/macros/s/AKfycbxXefWE9-VOwblzVVaZGmRBgvrvcrS_4qw7P07UhedF6AzNZMQv_b4ZQH-BA_HleTaS/exec'};

/* 完美對齊您最新更新的精確寬度 */
const COLS=[
  {k:'stockDate',n:'備貨日期',w:95,role:'s'},
  {k:'item',n:'品項',w:158,role:'s'},
  {k:'batch',n:'批號',w:95,role:'s'},
  {k:'shipDate',n:'送貨日期',w:105,role:'s'},
  {k:'customer',n:'客戶',w:158,role:'s'},
  {k:'category',n:'科別',w:80,role:'s'},
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

let DB={records:[],logs:[],stock:{items:[]}};
// ── 品項的「全系統唯一顯示順序」──────────────────────────────
// 速原 10 → 5 → 2.5 → 樂業 10 → 5 → 薇基因 → 修復霜 → 歐儷芙。
// 所有跟品項有關的清單（登記選單、篩選膠囊、庫存報表、報表切換鈕…）一律套用這個順序，
// 不再各自用注音／筆劃或出現次數排序，避免同一個品項在不同畫面出現在不同位置。
const ITEM_ORDER=['速原10ml-2級','速原5ml-2級','速原2.5ml-2級','樂業10ml','樂業5ml','薇基因(盒裝)','妙癒修復霜-20ml(盒裝)','妙癒修復霜-5ml(軟管)','歐儷芙舒口噴劑'];
function itemRank(n){ const i=ITEM_ORDER.indexOf(n); return i<0?999:i; }
function byItemOrder(a,b){ return itemRank(a)-itemRank(b)||String(a).localeCompare(String(b),'zh-TW'); }
let ITEM_CATALOG=ITEM_ORDER.slice();
let SALES_NAMES=['王大明','李小美','陳建志'];

const PRODUCT_FAMILIES=[
  {key:'newepi',name:'NEW EPI',color:'#1B4E8C',g1:'#7FB3E0',g2:'#3D7FC4',items:['速原10ml-2級','速原5ml-2級','速原2.5ml-2級','樂業10ml','樂業5ml']},
  {key:'vaginne',name:'薇基因',color:'#9B5FB5',g1:'#D2A0DC',g2:'#9B5FB5',items:['薇基因(盒裝)']},
  {key:'wonder',name:'妙癒修復霜',color:'#1F6B45',g1:'#A9D6AE',g2:'#5B9F68',items:['妙癒修復霜-20ml(盒裝)','妙癒修復霜-5ml(軟管)']},
  {key:'orelief',name:'歐儷芙',color:'#1A8A8A',g1:'#7FD9D9',g2:'#22A6A6',items:['歐儷芙舒口噴劑']}
];
function familyOf(item){ return PRODUCT_FAMILIES.find(f=>f.items.includes(item)) || {key:'other',name:'其他',color:'var(--tx-3)',g1:'#ccc',g2:'#999',items:[]}; }
// 業務庫存統計卡片用的短名稱：NEW EPI 系列不用顯示 ml／級數，
// 「速原2.5ml-2級」顯示成「速原2.5」、「樂業10ml」顯示成「樂業10」就好。
// 只有符合「數字+ml（可選-數字級）結尾」的品項名稱才會被縮短，其他系列的品項名稱不受影響。
// ── 品項名稱的「顯示用」轉換 ─────────────────────────────────
// 【重要】試算表裡的品項字串是 '速原10ml-2級' 這種寫法，而且「庫存資料」表、
// 「備貨紀錄」表都是靠這個字串完全相符來對應資料。所以絕對不能把資料裡的 ml 改成 mL——
// 一改，所有既有資料就對不上了。
// 因此改成「只在畫面上顯示時」把 ml 換成標準寫法 mL，存進去的值一律維持原樣。
function dispItem(item){
  return String(item||'').replace(/ml\b/gi,'mL');
}
function shortItemName(item){
  return dispItem(String(item||'').replace(/(\d+(?:\.\d+)?)ml(?:-\d+級)?$/i,'$1'));
}
// 長條圖旁邊的標籤空間很窄，修復霜那兩個品項全名放不下會被截掉，
// 所以另外給一組「更短的標籤名」。找不到對應時退回 dispItem 全名。
const TAG_NAME={
  '速原10ml-2級':'速原10mL','速原5ml-2級':'速原5mL','速原2.5ml-2級':'速原2.5mL',
  '樂業10ml':'樂業10mL','樂業5ml':'樂業5mL','薇基因(盒裝)':'薇基因',
  '妙癒修復霜-20ml(盒裝)':'修復霜20mL(盒)','妙癒修復霜-5ml(軟管)':'修復霜5mL(管)',
  '歐儷芙舒口噴劑':'歐儷芙噴劑'
};
function tagItemName(item){ return TAG_NAME[item]||dispItem(item); }

// ── 取得 Firebase ID Token ────────────────────────────────
// 這張 token 是「我是誰」的證明：Google 簽章、一小時到期、無法偽造。
// getIdToken() 本身有內建快取，只有在快到期時才會真的去跟 Google 換新的，
// 所以每次呼叫的成本幾乎是零（讀記憶體），不會增加網路負擔。
// 帶 true 代表強制換發，用在「後端說 token 過期」時重試。
async function getIdToken(forceRefresh){
  try{
    const u=window.__fb&&window.__fb.auth&&window.__fb.auth.currentUser;
    if(!u)return '';
    return await u.getIdToken(forceRefresh===true);
  }catch(e){ return ''; }
}
// 每一次 API 呼叫都把 token 一起送出，由後端驗證身分並決定能看／能改哪些資料。
// 後端回 code:'AUTH' 時（token 剛好在這一秒過期是最常見的情況），
// 自動強制換發一張新的再重試一次；還是不行才請使用者重新登入。
async function api(a,p,_retried){
  try{
    const idToken=await getIdToken(_retried===true);
    const res=await fetch(CFG.GAS_URL,{method:'POST',body:JSON.stringify({action:a,...p,idToken})});
    const text=await res.text();
    let json;
    try{ json=JSON.parse(text); }
    catch(parseErr){ return{status:'error',message:'伺服器回傳了非預期的內容，請檢查 GAS 部署設定。'}; }
    if(json&&json.code==='AUTH'){
      if(!_retried) return api(a,p,true);
      toast('登入已失效，請重新登入',true);
      setTimeout(()=>{ if(typeof logout==='function') logout(); },1200);
    }
    return json;
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

let ROLE='sales',CUR='王大明',CUR_EMAIL='',VIEW='group',BQ=1,AQ=1,PKT=null,PKV={},EDID=null,GROUPS=[],GEDI=null;

function renderModeBadges(){
  // ↻ 用獨立的 span 包起來，忙碌時直接讓這個字轉圈（見 .is-busy .ico-glyph），
  // 不再另外插入一顆白色的 loading 圈——手機上按鈕小，多一顆圈看起來就是「旁邊多一塊白白的」。
  const html = `<div class="bar-out ico" id="__REFRESH__" title="重新整理" aria-label="重新整理"><span class="ico-glyph">↻</span></div><div class="bar-out" onclick="logout()">登出</div>`;
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

// ── 名冊：正本在 gas.js，這裡只是「連不上後端時的備援」──────────────
// 登入後前端會呼叫 whoami，由後端回傳權威版本並覆寫這份資料（applyRoster）。
// 所以新增／異動人員請改 gas.js 的 ROSTERS；這份不更新也不影響權限，
// 因為所有資料權限都是後端依驗證後的信箱決定的，前端名冊只用來決定要顯示哪個畫面。
let ROSTERS={
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
function applyRoster(r){
  if(!r||!r.sales||!r.sales.length)return;
  ROSTERS={sales:r.sales||[],admin:r.admin||[],manager:r.manager||[]};
}
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
// SIGNIN_BUSY：登入流程進行中（含清理殘留狀態、等彈窗）。防止使用者連點兩下按鈕
// 讓兩個 OAuth 請求同時進行——這是另一個會讓 Google 回 400 的常見原因。
// LOGGING_OUT：登出流程進行中，這段期間 onAuthStateChanged 不要做任何事。
// AUTH_HANDLING：避免 signInWithPopup 的回傳值與 onAuthStateChanged 同時觸發、
// 導致 handleAuthedUser 被跑兩次（會出現畫面閃兩下、角色選單彈兩次）。
let SIGNIN_BUSY=false, LOGGING_OUT=false, AUTH_HANDLING=false;

window.addEventListener('firebase-ready', ()=>{
  FIREBASE_READY=true;
  // 已改為純彈窗登入，不再有 getRedirectResult 這一段（見 firebase-init.js 的說明）。
  // onAuthStateChanged 會在頁面重新載入、且先前登入狀態仍有效時自動觸發，
  // 使用者不用每次開網頁都重新登入一次。
  window.__fb.onAuthStateChanged(window.__fb.auth, (user)=>{
    FIREBASE_USER=user;
    if(LOGGING_OUT||SIGNIN_BUSY||AUTH_HANDLING) return;
    if(user && document.getElementById('login').style.display!=='none'){ handleAuthedUser(user); }
  });
});

function isInAppBrowser(){ return /Line\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent||''); }
function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'') || window.innerWidth<900; }

function setGoogleBtnText(t){ const e=document.getElementById('googleBtnText'); if(e)e.textContent=t; }

// ───────────────────────────────────────────────────────────
// 【登出後再登入會出現 400 malformed 的修正重點，共三件事】
//
// (1) 每次登入都用「全新的 provider」（window.__fb.makeProvider()），不再共用一個被前一次
//     登入用過、身上還留著參數的單例物件。詳細原因寫在 firebase-init.js。
//
// (2) 登入前先確定「上一個 session 真的清乾淨了」：舊版的 logout() 呼叫 signOut() 之後
//     沒有 await 就直接把登入畫面秀出來，使用者在手機上動作快一點，等於在 signOut 還沒
//     跑完的狀態下就按了登入 —— Firebase 這時的內部狀態是半舊半新，組出來的 OAuth 請求
//     就可能帶著殘留的 state/login_hint，Google 收到後直接回 400。
//     現在 logout() 會 await signOut() 並清掉瀏覽器裡的殘留鍵，登入按鈕在清乾淨之前是
//     停用的；googleSignIn() 進來時也會再確認一次 currentUser 已經是空的。
//
// (3) 整個登入流程加上 SIGNIN_BUSY 鎖，避免連點造成兩個 OAuth 請求互相覆蓋。
//
// 如果做完這三件事之後，某些裝置上仍偶發 400，請依序檢查 Firebase 主控台設定
// （這部分是後台設定、程式無法代勞）：
//   ・Authentication → Settings → 授權網域，要包含實際開啟網站的網域。
//   ・Google Cloud → API 和服務 → 憑證 → OAuth 2.0 用戶端，「已授權的重新導向 URI」
//     必須包含 https://goodcare-c4cd3.firebaseapp.com/__/auth/handler。
// ───────────────────────────────────────────────────────────
async function googleSignIn(btn){
  if(SIGNIN_BUSY) return;
  if(btn && btn.disabled) return;
  if(!FIREBASE_READY){toast('Google 登入服務準備中，請稍後再試',true);return;}
  if(isInAppBrowser()){ document.getElementById('inAppWarn').style.display='block'; return; }

  SIGNIN_BUSY=true;
  hideLoginDiag();
  if(btn)btn.disabled=true;
  setGoogleBtnText('登入中…');
  try{
    await window.__fb.persistenceReady;
    // 保險：如果因為任何原因上一個帳號還掛在 auth 上，先徹底登出再開始，
    // 確保這次 OAuth 請求是從乾淨狀態組起來的。
    if(window.__fb.auth.currentUser){
      // 只做正規的 signOut，不再去刪瀏覽器裡的登入狀態——
      // 硬刪 IndexedDB 會讓 Firebase 內部狀態半毀，反而導致
      // "Unable to process request due to missing initial state"。
      try{ await window.__fb.signOut(window.__fb.auth); }catch(e){}
    }
    const provider = window.__fb.makeProvider(); // 每次都是全新的 provider
    const result = await window.__fb.signInWithPopup(window.__fb.auth, provider);
    await handleAuthedUser(result.user);
  }catch(err){
    const code=(err&&err.code)||'';
    const msg=(err&&err.message)||'';
    if(code==='auth/popup-closed-by-user' || code==='auth/cancelled-popup-request'){
      // 使用者自己關掉彈窗，不算錯誤，安靜結束就好
    }else if(code==='auth/popup-blocked'){
      toast('瀏覽器擋住了登入視窗，請允許此網站顯示彈出式視窗後再試一次',true);
    }else if(code==='auth/unauthorized-domain'){
      toast('這個網域尚未加入 Firebase 授權清單，請聯絡系統管理員',true);
    }else if(code==='auth/network-request-failed'){
      toast('網路連線不穩，請確認網路後再試一次',true);
    }else if(/missing initial state/i.test(msg)){
      // 瀏覽器把彈窗與主頁的儲存空間隔離了（iOS Safari 的防追蹤、無痕模式、
      // 或從 LINE／FB 的內建瀏覽器開啟時最常見）。這種情況不是程式能修的，
      // 要請使用者換一個環境開啟。
      showLoginDiag('瀏覽器阻擋了登入視窗存取本機儲存空間。\n請改用以下任一方式：\n'+
        '1. 用 Safari 或 Chrome 直接開啟（不要從 LINE、Facebook 等 App 內建瀏覽器點連結）\n'+
        '2. 關閉無痕／私密瀏覽模式\n'+
        '3. iPhone：設定 → Safari → 關閉「阻擋所有 Cookie」\n'+
        '4. 若剛才更新過網站，請先清除本網站資料再試一次');
      toast('瀏覽器阻擋了登入視窗，請見下方說明',true);
    }else if(code==='auth/internal-error' || /malformed|400/i.test(msg)){
      await window.__fb.clearAuthResidue();
      toast('登入連線異常，請再按一次登入',true);
      showLoginDiag('登入連線異常（'+(code||'internal-error')+'）\n'+(msg||''));
    }else{
      toast('Google 登入失敗：'+(msg||code||'未知錯誤'),true);
    }
  }finally{
    SIGNIN_BUSY=false;
    if(btn)btn.disabled=false;
    setGoogleBtnText('使用 Google 帳號登入');
  }
}
async function handleAuthedUser(user){
  if(AUTH_HANDLING) return;
  AUTH_HANDLING=true;
  try{
    const email=user.email||'';
    // 角色改由後端認定：前端把 token 送過去，後端驗證信箱後回傳這個人真正的角色與名冊。
    // 前端自己算的角色只在後端連不上時當備援用（那種情況下也拿不到任何資料，所以沒有風險）。
    let roles=null;
    const who=await api('whoami',{});
    if(who&&who.status==='success'){
      applyRoster(who.roster);
      roles=who.roles||[];
      CUR_EMAIL=who.email||email;
      CUR=who.name||nameForEmail(email);
    }else if(who&&who.code==='AUTH'){
      // 這裡有兩種完全不同的狀況，訊息要分開講，否則會一直往名冊去找但問題根本不在那裡：
      //   NOT_IN_ROSTER → 真的不在 gas.js 的名冊上
      //   其他（FETCH_FAILED / TOKEN_REJECTED…）→ 伺服器端的設定或授權問題
      try{ await window.__fb.signOut(window.__fb.auth); }catch(e){}
      if(who.reason==='NOT_IN_ROSTER'){
        toast('此帳號尚未開通使用權限：'+email, true);
        showLoginDiag('此帳號（'+email+'）通過了 Google 驗證，但不在 gas.js 的 ROSTERS 名冊中。');
      }else{
        toast('伺服器無法驗證登入身分',true);
        console.error('[登入驗證失敗]', who);
        // 把完整原因直接留在登入畫面上，不要用會自動消失的提示——
        // 這種設定類的錯誤需要照著訊息去改設定，訊息不能一閃就不見。
        showLoginDiag('伺服器無法驗證登入身分\n代碼：'+(who.reason||'未知')+'\n'+(who.message||''));
      }
      return;
    }else{
      // 後端暫時連不上（網路問題／GAS 部署中）：用本機名冊先讓畫面出來，
      // 但任何資料請求仍然會被後端擋下，不會造成權限外洩。
      roles=rolesForEmail(email);
      CUR_EMAIL=email; CUR=nameForEmail(email);
      if(roles.length) toast('目前無法連線到伺服器，資料可能無法載入',true);
    }
    if(!roles||!roles.length){
      try{ await window.__fb.signOut(window.__fb.auth); }catch(e){}
      toast('此帳號尚未開通使用權限：'+email, true); return;
    }
    if(roles.length===1){ proceedLogin(roles[0]); return; }
    const remembered=localStorage.getItem('lastRole:'+email);
    if(remembered && roles.includes(remembered)){ proceedLogin(remembered); return; }
    showRoleChooser(roles);
  }finally{ AUTH_HANDLING=false; }
}
// 在登入畫面上顯示一段可以複製的診斷訊息（不會自動消失）
function showLoginDiag(msg){
  let el=document.getElementById('loginDiag');
  if(!el){
    el=document.createElement('div');
    el.id='loginDiag';
    el.className='login-diag';
    const step=document.getElementById('googleStep');
    if(step)step.appendChild(el); else return;
  }
  el.textContent=msg;
  el.style.display='block';
}
function hideLoginDiag(){ const el=document.getElementById('loginDiag'); if(el)el.style.display='none'; }
function showRoleChooser(roles){
  const box=document.getElementById('roleChooserOptions');
  box.innerHTML=roles.map(r=>`<button class="btn-role-choice" onclick="proceedLogin('${r}')">${ROLE_LABEL[r]}</button>`).join('');
  document.getElementById('googleStep').style.display='none';
  document.getElementById('roleChooser').style.display='block';
}
function proceedLogin(role){
  // 資料隔離的最後一道前端防線：只允許進入「這個信箱在名冊上真的擁有」的角色。
  // 業務端的資料本來就由後端依 salesName 過濾（salesInit／getLogs／getStockReport），
  // 但如果有人在瀏覽器主控台直接呼叫 proceedLogin('admin')，舊版會直接把行政總表畫面打開
  // 並呼叫 adminInit（後端沒有身分驗證）。這裡先擋掉這條路。
  const allowed=rolesForEmail(CUR_EMAIL);
  if(!allowed.includes(role)){ toast('您的帳號沒有這個角色的權限',true); return; }
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
    initManagerScreen();
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
// 登出改為非同步，而且「登入按鈕在殘留狀態清乾淨之前是停用的」。
// 舊版沒有等 signOut 完成就把登入畫面秀出來，使用者馬上按登入 → Firebase 內部狀態
// 半舊半新 → OAuth 請求格式錯誤 → Google 回 400 malformed，正是手機上遇到的情況。
async function logout(){
  LOGGING_OUT=true;
  document.getElementById('login').style.display='flex';
  document.getElementById('googleStep').style.display='block';
  document.getElementById('roleChooser').style.display='none';
  document.getElementById('salesApp').style.display='none';
  document.getElementById('adminApp').style.display='none';
  document.getElementById('managerApp').style.display='none';
  const gb=document.getElementById('googleBtn');
  if(gb){ gb.disabled=true; }
  setGoogleBtnText('登出中…');
  try{
    if(window.__fb && window.__fb.auth) await window.__fb.signOut(window.__fb.auth);
  }catch(e){}
  try{ await window.__fb.clearAuthResidue(); }catch(e){} // 現在只清 redirect 殘留，不碰登入狀態
  // 清掉本機快取的資料，避免下一個人登入時短暫看到上一個人的畫面
  DB={records:[],logs:[],stock:{items:[]}};
  CUR_EMAIL=''; EDITS={}; RF={}; HF={}; RSORT=null; ASORT=null;
  SALES_LOGS_LOADED=false; ADMIN_LOGS_LOADED=false;
  Object.keys(STOCK_RPT_CACHE).forEach(k=>delete STOCK_RPT_CACHE[k]);
  LOGGING_OUT=false;
  if(gb){ gb.disabled=false; }
  setGoogleBtnText('使用 Google 帳號登入');
}

// ── 資料讀取 ──
async function loadSalesData(silent){
  if(!silent)showLoad('讀取您的備貨紀錄中…');
  try{
    const res=await api('salesInit', {salesName:CUR, yearMonth:CURRENT_YM});
    if(res.status==='success'){
      DB.records = res.records||[];
      DB.logs = res.logs||[];
      DB.stock = res.stock||{items:[]};
      SALES_LOGS_LOADED=false;
    }else if(!silent) toast('讀取資料失敗：'+(res.message||'未知錯誤'), true);
    initSales();
  }catch(err){
    if(!silent) toast('連線失敗，暫時顯示上次的資料：'+err.message, true);
    initSales();
  }finally{ if(!silent) hideLoad(); }
}
// ── 寫入成功之後的資料同步策略 ───────────────────────────────
// 舊版：每次新增／修改／刪除成功後，本機資料其實已經同步更新過了，卻又立刻呼叫
// loadSalesData()（沒有帶 silent），於是又跳一次全螢幕的「讀取資料中…」遮罩、
// 再把整份備貨紀錄重抓一次。使用者的感受就是「明明只改一個欄位，卻要等兩次」。
//
// 新版：畫面用本機資料立刻更新（使用者馬上就看到結果），真正的重抓改成背景靜默進行，
// 而且做 debounce ——連續操作好幾筆時只會在最後同步一次，不會每筆都打一次 API。
// 靜默同步不顯示遮罩、不擋操作，完成後只把庫存等衍生數字補正。
let _salesSyncTimer=null, _salesSyncing=false;
function queueSalesSync(delay){
  clearTimeout(_salesSyncTimer);
  _salesSyncTimer=setTimeout(async()=>{
    if(_salesSyncing)return;
    _salesSyncing=true;
    try{ await loadSalesData(true); }catch(e){}
    _salesSyncing=false;
  }, delay||1200);
}
async function refreshSales(){
  const btn=document.getElementById('salesRefreshBtn');busy(btn,true);
  await loadSalesData(false);
  busy(btn,false);toast('已更新為最新資料');
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
// ── 行政端寫入後的同步策略（與業務端相同的做法）──────────────────
// 舊版每次送出成功都會 loadAdminData()：跳全螢幕遮罩、把整張總表重新抓一次再整表重繪。
// 但本機資料在送出成功時已經同步更新過了，所以改成畫面立即更新、真正的重抓在背景靜默進行，
// 並做 debounce（連續操作只在最後同步一次）。
let _adminSyncTimer=null,_adminSyncing=false;
function queueAdminSync(delay){
  clearTimeout(_adminSyncTimer);
  _adminSyncTimer=setTimeout(async()=>{
    if(_adminSyncing)return;
    _adminSyncing=true;
    try{
      const res=await api('adminInit',{});
      if(res.status==='success'){
        DB.records=res.data||[];
        if(res.options&&res.options.salesNames&&res.options.salesNames.length) SALES_NAMES=res.options.salesNames;
        renderAChips();renderGrid();
      }
    }catch(e){}
    _adminSyncing=false;
  }, delay||1500);
}
// 篩選膠囊連點時，總表不必每一下都整表重建（資料多時每次重建都是明顯的頓卡），
// 用 60ms 的去抖動把連續點擊合併成一次重繪。
let _gridPaintTimer=null;
function renderGridDebounced(){ clearTimeout(_gridPaintTimer); _gridPaintTimer=setTimeout(renderGrid,60); }
async function refreshAdmin(){
  const btn=document.getElementById('adminRefreshBtn');busy(btn,true);
  await loadAdminData();
  busy(btn,false);toast('已更新為最新資料');
}

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function jse(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
// 處理中的按鈕：只在文字前面加一個轉圈圖示並停用點擊，
// 不再改寫 textContent。舊版是把整段文字換成「送出中…」再換回來，
// 在視窗同時關閉或重繪時就會出現「文字整個不見」的狀況。
// label 參數保留只是為了不用改所有呼叫點，實際上已經不會用到。
function busy(btn,on,label){
  if(!btn)return;
  if(on){
    btn.disabled=true; btn.classList.add('is-busy');
    if(!btn.querySelector('.btn-spin')){
      const sp=document.createElement('span'); sp.className='btn-spin';
      btn.insertBefore(sp, btn.firstChild);
    }
  }else{
    btn.disabled=false; btn.classList.remove('is-busy');
    const sp=btn.querySelector('.btn-spin'); if(sp)sp.remove();
  }
}
function toast(m,bad){const t=document.getElementById('tst');t.textContent=m;t.classList.toggle('bad',!!bad);t.classList.add('on');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),2800);}
// ── 欄位狀態與清除鈕 ────────────────────────────────────────
// mk()：欄位有值就標記已填（左側細線變色）並顯示清除鈕。
function mk(el){
  const w=el.closest('.fw');
  const v=!!(el.value&&el.value.trim()!=='');
  el.classList.toggle('on',v);
  if(w){ w.classList.toggle('ok',v); w.classList.toggle('has-val',v); ensureClearBtn(w,el); }
  fillCount();
}
// 清除鈕做成 iOS 輸入框裡那種小圓叉：貼齊欄位內緣、垂直置中、灰底白叉，
// 不畫外框、不加陰影。之前那版掛在欄位右上角、又跟原生日曆圖示疊在一起，
// 點下去會先觸發日曆而不是清除——現在按鈕是欄位的兄弟節點且蓋在最上層（z-index），
// 點擊完全不會傳到輸入框，日期欄按下去就是純粹清空。
function ensureClearBtn(w,el){
  if(!w||el.tagName!=='INPUT')return;
  if(w.querySelector(':scope > .fw-clear'))return;
  const b=document.createElement('button');
  b.type='button'; b.className='fw-clear'; b.setAttribute('aria-label','清除欄位'); b.tabIndex=-1;
  b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 6.4l7.2 7.2M13.6 6.4l-7.2 7.2"/></svg>';
  const clear=function(ev){
    ev.preventDefault(); ev.stopPropagation();
    el.value=''; mk(el);
  };
  // pointerdown 先攔一次：日期欄在某些瀏覽器上按下去（還沒放開）就會叫出日曆，
  // 等到 click 才處理已經來不及了。
  b.addEventListener('pointerdown',clear);
  b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();});
  w.appendChild(b);
}
// 下拉選擇欄位（客戶／品項／科別／賣備樣／批號）的清除鈕，樣式與行為完全一致
function ensurePkClearBtn(fw,k){
  if(!fw||fw.querySelector(':scope > .fw-clear'))return;
  const b=document.createElement('button');
  b.type='button'; b.className='fw-clear'; b.setAttribute('aria-label','清除欄位'); b.tabIndex=-1;
  b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 6.4l7.2 7.2M13.6 6.4l-7.2 7.2"/></svg>';
  const clear=function(ev){ ev.preventDefault(); ev.stopPropagation(); clearPk(k); };
  b.addEventListener('pointerdown',clear);
  b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();});
  fw.appendChild(b);
}
// 頁面載入後先幫所有既有欄位備好清除鈕（預設隱藏，有值才出現），
// 並讓日期欄位「點欄位本身就開日曆」——因為原生的日曆小圖示已經在 CSS 裡拿掉了
// （它跟清除鈕搶同一塊位置，而且各家瀏覽器長得都不一樣，是畫面最不一致的來源之一）。
window.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.fw > input.fb').forEach(el=>ensureClearBtn(el.closest('.fw'),el));
  document.querySelectorAll('input[type="date"].fb').forEach(el=>{
    el.addEventListener('click',()=>{ try{ el.showPicker&&el.showPicker(); }catch(e){} });
  });
  document.querySelectorAll('.fw > button.pkb').forEach(b=>{
    const m=b.id&&b.id.replace(/^pk-/,''); if(m) ensurePkClearBtn(b.closest('.fw'),m);
  });
});
function val(id){return document.getElementById(id).value.trim();}

function myHistory(field){const s=new Set();DB.records.forEach(x=>{if(x.sales===CUR&&x[field])s.add(x[field]);});return[...s].sort((a,b)=>a.localeCompare(b,'zh-TW'));}
const PK={customer:{t:'選擇客戶名稱',ph:'請選擇或輸入客戶名稱',l:()=>myHistory('customer')},
  item:{t:'選擇品項',ph:'請選擇品項',l:()=>ITEM_CATALOG},
  category:{t:'選擇科別',ph:'選擇或輸入',l:()=>myHistory('category')},
  type:{t:'選擇賣/備/樣',ph:'選擇或輸入',l:()=>myHistory('type')},
  batch:{t:'選擇批號',ph:'請選擇或輸入批號',l:()=>myHistory('batch')},
  'e-ba':{t:'選擇批號',ph:'請選擇或輸入批號',l:()=>myHistory('batch')},
  'g-ba':{t:'選擇批號',ph:'請選擇或輸入批號',l:()=>myHistory('batch')},
  'e-cu':{t:'選擇客戶名稱',ph:'請選擇或輸入客戶名稱',l:()=>myHistory('customer')},
  'e-it':{t:'選擇品項',ph:'請選擇品項',l:()=>ITEM_CATALOG},
  'e-ca':{t:'選擇科別',ph:'選擇或輸入',l:()=>myHistory('category')},
  'e-ty':{t:'選擇賣/備/樣',ph:'選擇或輸入',l:()=>myHistory('type')},
  'g-cu':{t:'選擇客戶名稱',ph:'請選擇或輸入客戶名稱',l:()=>myHistory('customer')},
  'g-it':{t:'選擇品項',ph:'請選擇品項',l:()=>ITEM_CATALOG},
  'g-ca':{t:'選擇科別',ph:'選擇或輸入',l:()=>myHistory('category')},
  'g-ty':{t:'選擇賣/備/樣',ph:'選擇或輸入',l:()=>myHistory('type')},
  'ac-item':{t:'選擇品項',ph:'請選擇品項',l:()=>ITEM_CATALOG},
  'ac-sales':{t:'選擇業務',ph:'請選擇業務',l:()=>SALES_NAMES},
  'admin-sales-filter':{t:'篩選業務',ph:'',l:()=>SALES_NAMES},
  'admin-item-filter':{t:'篩選品項',ph:'',l:()=>ITEM_CATALOG}};
function openPk(k){PKT=k;document.getElementById('pkT').textContent=PK[k].t;document.getElementById('pkS').value='';
  document.getElementById('pkBg').classList.add('on');renderPk();setTimeout(()=>document.getElementById('pkS').focus(),80);}
function closePk(){document.getElementById('pkBg').classList.remove('on');}
// ── 選擇器的即時篩選 ─────────────────────────────────────────
// 舊版：輸入的字如果一個都沒對到，清單會整個變成空的，選單高度瞬間縮到 0，
// 手機上鍵盤跟著重新定位，欄位就從畫面中間跳到最下面被鍵盤擋住。
// 新版三個修正：
//   1) 清單容器有固定的最小高度（CSS .pk-l），永遠不會塌掉，版面不會跳。
//   2) 一輸入就把「使用你打的這個字」放在第一列，隨時可以直接按下去建立新值。
//   3) 比對改成不分大小寫、且優先顯示「開頭符合」的項目，打第一個字就會帶出關鍵字。
function renderPk(){
  const all=PK[PKT].l(), q=document.getElementById('pkS').value.trim(), cur=PKV[PKT]||'';
  const lq=q.toLowerCase();
  let f=all;
  if(q){
    f=all.filter(v=>String(v).toLowerCase().includes(lq));
    f.sort((a,b)=>{
      const as=String(a).toLowerCase().indexOf(lq), bs=String(b).toLowerCase().indexOf(lq);
      return as-bs || String(a).localeCompare(String(b),'zh-TW');
    });
  }
  let h='';
  if(q && !all.some(v=>String(v)===q)){
    h+=`<div class="pk-it pk-new" onclick="pickV('${jse(q)}')"><span>使用「<b>${esc(q)}</b>」</span><span class="pk-new-tag">新增</span></div>`;
  }
  h+=f.map(v=>{
    // 把符合的片段標亮，一眼看得出來為什麼這一列被留下來
    let label=esc(v);
    if(q){
      const i=String(v).toLowerCase().indexOf(lq);
      if(i>=0) label=esc(String(v).slice(0,i))+'<mark>'+esc(String(v).slice(i,i+q.length))+'</mark>'+esc(String(v).slice(i+q.length));
    }
    return `<div class="pk-it ${v===cur?'on':''}" onclick="pickV('${jse(v)}')">${label.replace(/ml/gi,'mL')}${v===cur?'<span>✓</span>':''}</div>`;
  }).join('');
  if(!f.length && !q) h+=`<div class="pk-e">尚無歷史紀錄，請直接輸入後按右上角「確認」</div>`;
  if(!f.length && q)  h+=`<div class="pk-e">沒有符合「${esc(q)}」的既有紀錄，可直接使用上方新增</div>`;
  document.getElementById('pkL').innerHTML=h;
}
function confirmCustomPk(){
  const v=document.getElementById('pkS').value.trim();
  if(!v){toast('請先輸入內容',true);return;}
  pickV(v);
}
function pickV(v){
  if(PKT==='admin-sales-filter'){closePk();ASales=v;renderAChips();renderGrid();return;}
  if(PKT==='admin-item-filter'){closePk();AItem=v;renderAChips();renderGrid();return;}
  PKV[PKT]=v;const b=document.getElementById('pk-'+PKT),s=b.querySelector('.v');
  s.textContent=dispItem(v);s.classList.remove('ph');b.classList.add('on');
  const fw=b.closest('.fw'); fw.classList.add('ok'); fw.classList.add('has-val');
  ensurePkClearBtn(fw,PKT);
  closePk();fillCount();}
// 已選好的下拉欄位，右側一樣給一顆清除鈕
function ensurePkClearBtn(fw,k){
  if(!fw)return;
  const host=fw.closest('.fg')||fw;
  if(host.querySelector('.fw-clear'))return;
  const b=document.createElement('button');
  b.type='button'; b.className='fw-clear'; b.setAttribute('aria-label','清除'); b.textContent='✕';
  b.addEventListener('click',function(ev){ ev.preventDefault(); ev.stopPropagation(); clearPk(k); });
  host.appendChild(b);
}
function clearPk(k){PKV[k]='';const b=document.getElementById('pk-'+k);if(!b)return;const s=b.querySelector('.v');
  s.textContent=PK[k].ph;s.classList.add('ph');b.classList.remove('on');
  const fw=b.closest('.fw'); fw.classList.remove('ok'); fw.classList.remove('has-val');
  fillCount();}
// 開啟編輯／批次編輯視窗時，把既有值塞回下拉按鈕上
function setPk(k,v){
  const b=document.getElementById('pk-'+k); if(!b)return;
  const fw=b.closest('.fw');
  if(fw){ fw.classList.toggle('has-val',!!v); ensurePkClearBtn(fw,k); }
  PKV[k]=v||'';
  const sp=b.querySelector('.v');
  if(v){ sp.textContent=dispItem(v); sp.classList.remove('ph'); b.classList.add('on'); b.closest('.fw').classList.add('ok'); }
  else { sp.textContent=PK[k].ph; sp.classList.add('ph'); b.classList.remove('on'); b.closest('.fw').classList.remove('ok'); }
}

/* ── SALES ── */
function initSales(){
  qd('f-sd', 0);
  renderRecHead();renderMChips();renderIChips();renderRec();renderStats();renderPend();renderLogs();fillCount();
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
  document.getElementById('activeFilterChips').innerHTML=sortChipHtml(RSORT,'rec')+activeCols.map(c=>
    `<span class="af-chip" onclick="openFilterModal('rec','${c.k}')">${c.n}<span class="af-x" onclick="event.stopPropagation();quickClearFilter('${c.k}')">✕</span></span>`).join('');
}
function quickClearFilter(col){ delete RF[col]; renderMChips(); renderRecHead(); renderRec(); }
function filterIconSvg(){return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="4 4 20 4 14 13 14 19 10 21 10 13 4 4"></polygon></svg>`;}
function pickYm(v){if(!v)return;FM=v;renderMChips();renderRec();}
function toggleShipFilter(v){FShip=(FShip===v)?'':v;renderMChips();renderRec();}
function renderIChips(){const cnt={};DB.records.filter(x=>x.sales===CUR&&x.item).forEach(x=>cnt[x.item]=(cnt[x.item]||0)+1);
  document.getElementById('iChips').innerHTML=`<button class="chip ${FI===''?'on':''}" onclick="FI='';renderIChips();renderRec()">全部</button>`+
    Object.keys(cnt).sort(byItemOrder).map(i=>`<button class="chip ${FI===i?'on':''}" onclick="FI='${jse(i)}';renderIChips();renderRec()">${esc(i)}<span class="n">${cnt[i]}</span></button>`).join('');}
// 建立時間新到舊；createdAt 一樣或缺漏時，再依備貨日期、最後依 recordId 保持穩定順序
function byNewestFirst(a,b){
  const ac=a.createdAt||'', bc=b.createdAt||'';
  if(ac&&bc&&ac!==bc) return bc.localeCompare(ac);
  const ad=a.stockDate||'', bd=b.stockDate||'';
  if(ad!==bd) return bd.localeCompare(ad);
  return String(b.recordId||'').localeCompare(String(a.recordId||''));
}
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
// ── 出貨判斷（全系統唯一標準）──
// 「送貨日期」和「客戶」兩欄都有填，才算已出貨。
// 原本系統裡並存兩套定義：這裡用發票（發票日期或發票號碼有填就算出貨）、我的紀錄用送貨日期，
// 導致同一個人在不同畫面看到不一樣的「已出貨」數字。現在一律以送貨日期為準，
// 發票判斷停用；後端 gas.js 的 computeShipmentCounts_ 也是同一套定義，前後端完全一致。
function shipStatus(x){return (x.shipDate&&x.customer)?'sh':'hd';}
// stOf 保留為別名，避免任何漏改的呼叫點跑回舊的發票邏輯造成數字不一致
function stOf(x){return shipStatus(x);}
function fmtDateShort(d){
  if(!d)return'未填日期';
  const p=d.split('-');if(p.length<3)return d;
  const wd=['日','一','二','三','四','五','六'][new Date(d).getDay()];
  return `${+p[1]}/${+p[2]}（週${wd}）`;
}
// 依備貨日期分段，新到舊；同一天內的資料維持原本順序。
// 但只要使用者自己設了排序（RSORT），就不再依日期分段——否則日期分段會把使用者
// 指定的順序整個打散，看起來像排序沒生效。這時回傳單一區段、不顯示日期標題。
function dateSections(rows){
  if(RSORT) return [{date:null,rows:rows}];
  rows=rows.slice().sort(byNewestFirst);
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
    return `<th class="${thCls}" onclick="openHeaderFilter(event,'rec','${c.k}')">${c.n}${sortIcon(RSORT,c.k)}<span class="th-fico">▾</span><span class="col-rs" data-col="${c.k}"></span></th>`;
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
// ── 電腦版清單：可直接編輯儲存格、可從 Excel 整塊貼上 ─────────────
// 跟行政總表同一套操作邏輯（REDITS 暫存未送出的變更，送出前跳確認視窗）。
// 只有業務可以填的欄位（role='s'）是輸入框，發票／ERP／借出單等行政欄位維持唯讀，
// 避免業務誤改行政的資料。分組檢視的表格維持唯讀（點列開編輯視窗）。
let REDITS={}, REC_LIST_ROWS=[];
const MONO_COLS=['stockDate','shipDate','invoiceDate','orderNo','invoiceNo','batch'];
function recRowHtml(x,editable){
  const cells=COLS.map(c=>{
    const hide=(c.role==='a'&&!RECFULL)?'colhide':'';
    const mono=MONO_COLS.includes(c.k)?'mn':'';
    if(editable&&c.role==='s'){
      const ek=x.recordId+'::'+c.k, ed=REDITS[ek]!==undefined, v=ed?REDITS[ek]:(x[c.k]||'');
      return `<td class="${hide}"><input class="cel ${ed?'ed':''} ${mono}" data-rid="${esc(x.recordId)}" data-col="${c.k}" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(v)}" oninput="recCellEdit(this)" onpaste="recCellPaste(event,this)"></td>`;
    }
    return `<td class="pad ${mono} ${hide}">${esc(x[c.k]||'—')}</td>`;
  }).join('');
  const open=editable?'<tr>':`<tr onclick="openEd('${x.recordId}')" style="cursor:pointer">`;
  return open+cells+`<td class="pad"><span class="sm ${shipStatus(x)==='sh'?'g':'h'}">${shipStatus(x)==='sh'?'已送貨':'未送貨'}</span></td></tr>`;
}
function recEffVal(x,k){const ek=x.recordId+'::'+k;return REDITS[ek]!==undefined?REDITS[ek]:x[k];}
function recCellEdit(el){
  const rid=el.dataset.rid,col=el.dataset.col,ek=rid+'::'+col;
  const rec=DB.records.find(x=>x.recordId===rid); if(!rec)return;
  if(String(el.value||'')===String(rec[col]||'')){delete REDITS[ek];el.classList.remove('ed');}
  else{REDITS[ek]=el.value;el.classList.add('ed');}
  updRecEditBar();
}
function recCellPaste(e,el){
  const txt=(e.clipboardData||window.clipboardData).getData('text');
  if(!txt||(!txt.includes('\t')&&!txt.includes('\n')))return; // 單格貼上交給瀏覽器預設行為
  e.preventDefault();
  const rows=txt.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(r=>r.split('\t'));
  const ri=REC_LIST_ROWS.findIndex(x=>x.recordId===el.dataset.rid), ci=COLS.findIndex(c=>c.k===el.dataset.col);
  let n=0;
  rows.forEach((cells,dr)=>{
    const rec=REC_LIST_ROWS[ri+dr]; if(!rec)return;
    cells.forEach((v,dc)=>{
      const col=COLS[ci+dc]; if(!col||col.role!=='s')return; // 行政欄位不接受貼上
      const ek=rec.recordId+'::'+col.k, vv=v.trim();
      if(String(rec[col.k]||'')===vv)delete REDITS[ek];else{REDITS[ek]=vv;n++;}
    });
  });
  renderRec();toast(`已貼上 ${n} 格資料，請確認後送出`);
}
function updRecEditBar(){
  const n=Object.keys(REDITS).length;
  const el=document.getElementById('rEditN'); if(el)el.textContent=n;
  const box=document.getElementById('rEdit'); if(box)box.style.display=n?'inline':'none';
  const btn=document.getElementById('btnSubmitRec'); if(btn)btn.disabled=!n;
}
function revertRecGrid(){
  const n=Object.keys(REDITS).length;
  if(!n){toast('目前沒有未送出的變更');return;}
  REDITS={};renderRec();toast(`已還原 ${n} 格變更`);
}
function buildRecDiffs(){
  const by={};
  Object.keys(REDITS).forEach(ek=>{
    const i=ek.indexOf('::'),rid=ek.slice(0,i),col=ek.slice(i+2);
    const rec=DB.records.find(x=>x.recordId===rid);if(!rec)return;
    (by[rid]=by[rid]||{rec,list:[]}).list.push({key:col,label:LBL[col],before:rec[col]||'',after:REDITS[ek]||''});
  });
  return by;
}
function openRecDiff(){
  const by=buildRecDiffs(),ks=Object.keys(by);if(!ks.length)return;
  DIFF_CTX='rec';
  let cells=0;ks.forEach(k=>cells+=by[k].list.length);
  document.getElementById('dfCount').textContent=`${ks.length} 筆資料 · ${cells} 個欄位`;
  document.getElementById('dfBody').innerHTML=
    `<div style="font-size:12px;color:var(--tx-2);margin-bottom:14px;line-height:1.75">以下變更將寫入試算表，請確認「舊值 → 新值」無誤後送出。送出結果都會完整記錄於操作紀錄。</div>`+
    ks.map(rid=>{const{rec,list}=by[rid];
      return `<div class="df"><div class="df-h"><span>${esc(rec.customer||'（未填客戶）')} ${esc(rec.item||'（未填品項）')}</span><span class="m">${esc(rid)}</span></div>
      ${list.map(d=>`<div class="df-r"><span class="df-k">${esc(d.label)}</span>
        <span class="df-v"><span class="dl">${esc(d.before||'（空白）')}</span> <span style="color:var(--tx-3)">→</span> <span class="nw">${esc(d.after||'（空白）')}</span></span></div>`).join('')}</div>`;}).join('');
  document.getElementById('dfMv').classList.add('on');
}
// 送出前確認視窗由行政總表與業務清單共用，用 DIFF_CTX 決定要送出哪一份變更
let DIFF_CTX='admin';
function commitDiff(btn){ return DIFF_CTX==='rec'?commitRecGrid(btn):commitGrid(btn); }
async function commitRecGrid(btn){
  if(btn&&btn.disabled)return;
  const by=buildRecDiffs(),ks=Object.keys(by);
  if(!ks.length){closeDiff();return;}
  const updates=ks.map(rid=>{const ch={};by[rid].list.forEach(d=>ch[d.key]=d.after);return{recordId:rid,changes:ch};});
  busy(btn,true);
  // 樂觀更新：先套用到本機並關閉視窗，網路在背景完成
  const before=ks.map(rid=>{const o={};by[rid].list.forEach(d=>o[d.key]=by[rid].rec[d.key]);return{rec:by[rid].rec,o};});
  updates.forEach((u,i)=>Object.assign(by[ks[i]].rec,u.changes));
  REDITS={};closeDiff();renderRec();renderStats();renderPend();
  const res=await api('batchUpdate',{updates,actor:CUR,source:'業務端網頁（清單批次）'});
  busy(btn,false);
  if(res.status==='success'){
    toast(`已更新 ${ks.length} 筆資料，操作已記錄`);
    queueSalesSync();
  }else{
    before.forEach(b=>Object.assign(b.rec,b.o));
    renderRec();renderStats();renderPend();
    ks.forEach(rid=>addLog({act:'修改紀錄',ok:false,rid,diffs:by[rid].list,err:res.message||'未知錯誤',src:'業務端網頁（清單批次）'}));
    renderLogs();toast('送出失敗，已還原：'+(res.message||'未知錯誤'),true);
  }
}
// 一筆紀錄是否「資料齊全」：業務端該填的八個欄位都有值。
// 分組展開後每一筆的「編輯」按鈕會依此顯示綠色（齊全）或紅色（有缺），
// 一眼就能看出哪一筆還沒補完，不用逐筆點進去看。
const REC_REQUIRED=['customer','item','category','type','batch','stockDate','shipDate','orderNo'];
function recMissing(x){ return REC_REQUIRED.filter(k=>!(x[k]&&String(x[k]).trim())); }
function recComplete(x){ return recMissing(x).length===0; }
// 分組展開後的單筆列：把科別／批號／送貨日期／賣備樣／單號全部列出來，
// 舊版只顯示單號與出貨狀態，編輯完根本看不出改了什麼。
// 展開後的單筆列排版：
//   第一行＝賣／備／樣圓標籤 + 科別 + 出貨狀態（一眼可辨識的識別資訊）
//   第二行＝批號／送貨日期／訂購單號，固定三欄對齊，不會因為字數不同而擠成一團
//   第三行＝備註（有填才出現）
// 編輯按鈕文字一律是「編輯」，只用綠／紅框線表示這筆資料是否齊全。
function srCell(x,k,mono){
  const has=x[k]&&String(x[k]).trim();
  return `<span class="srf${has?'':' srf-miss'}"><span class="srk">${esc(LBL[k])}</span><span class="srv${mono?' mn':''}">${esc(x[k]||'—')}</span></span>`;
}
function srEditBtn(x){
  const okAll=recComplete(x);
  return `<button type="button" class="sr-ed ${okAll?'ok':'bad'}" data-editrid="${esc(x.recordId)}" title="${okAll?'資料已齊全':'尚有欄位未填'}">編輯 ›</button>`;
}
function recSubRow(x){
  const sh=shipStatus(x)==='sh';
  return `<div class="rc-sr" data-editrid="${esc(x.recordId)}">
    <div class="sr-main">
      <div class="sr-head">
        ${typeBadge(x.type)||'<span class="tbadge o">—</span>'}
        <span class="sr-cat">${esc(x.category||'未填科別')}</span>
        <span class="sr-st ${sh?'g':'h'}">${sh?'已送貨':'未送貨'}</span>
      </div>
      <div class="sr-grid">${srCell(x,'batch',1)}${srCell(x,'shipDate',1)}${srCell(x,'orderNo',1)}</div>
      ${x.remark?`<div class="sr-remark">備註 ${esc(x.remark)}</div>`:''}
    </div>
    ${srEditBtn(x)}
  </div>`;
}
function renderRec(){
  const rows=myRecs(),el=document.getElementById('recCards'),showItem=!FI;
  GROUPS=[];
  // 預設順序＝「最新建立的排最前面」。舊版是用備貨日期排，但同一天建立好幾筆時
  // 備貨日期完全相同，順序就變成試算表的原始列序（看起來就是沒有規則）。
  // 改成先比 createdAt（建立時間），沒有 createdAt 的舊資料才退回備貨日期。
  if(RSORT) rows.sort(sortCompare(RSORT.col,RSORT.dir));
  else rows.sort(byNewestFirst);
  if(!rows.length)el.innerHTML=`<div class="emp"><div class="emp-t">本月尚無備貨紀錄</div><div class="emp-s">前往「備貨登記」新增第一筆</div></div>`;
  else if(VIEW==='list'){
    el.innerHTML=dateSections(rows).map(sec=>(sec.date===null?'':`<div class="rc-date-sec">${fmtDateShort(sec.date)}</div>`)+
      sec.rows.map(x=>{const fam=familyOf(x.item);
        return `<div class="rc" onclick="openEd('${x.recordId}')"><div class="rc-s" style="background:${fam.color}"></div>
        <div class="rc-b"><div class="rc-t"><span class="rc-c">${esc(x.customer||'（未填）')}<span class="rc-cat">${esc(x.category||'—')}</span></span><span class="bg ${shipStatus(x)}">${shipStatus(x)==='sh'?'已送貨':'未送貨'}</span></div>
        <div class="rc-m">${showItem?`<span style="color:${fam.color};font-weight:500">${esc(x.item||'（未填）')}</span>`:''}${typeBadge(x.type)}<span>單號 <b>${esc(x.orderNo||'—')}</b></span></div>
        </div><div class="rc-a">›</div></div>`;}).join('')
    ).join('');
  }else{
    el.innerHTML=dateSections(rows).map(sec=>{
      const g={};sec.rows.forEach(x=>{const k=x.customer+'|'+x.item;(g[k]=g[k]||[]).push(x)});
      const cards=Object.values(g).map(its=>{const i=GROUPS.push(its)-1,f=its[0],fam=familyOf(f.item);
        return `<div class="rc" onclick="tg(${i})"><div class="rc-s" style="background:${fam.color}"></div><div class="rc-b">
        <div class="rc-t"><span class="rc-c">${esc(f.customer||'（未填）')}<span class="rc-cat">${esc(f.category||'—')}</span><span class="rc-q">×${its.length}</span></span><span class="bg ${shipStatus(f)}">${shipStatus(f)==='sh'?'已送貨':'未送貨'}</span></div>
        <div class="rc-m">${showItem?`<span style="color:${fam.color};font-weight:500">${esc(f.item||'（未填）')}</span>`:''}</div>
        <div class="rc-sub" id="g${i}">${its.map(recSubRow).join('')}</div>
        </div><div class="rc-a rc-a-edit" onclick="event.stopPropagation();openGroupEdit(${i})" title="批次編輯">✎</div></div>`;
      }).join('');
      return (sec.date===null?'':`<div class="rc-date-sec">${fmtDateShort(sec.date)}</div>`)+cards;
    }).join('');
  }

  if(VIEW==='list'){
    REC_LIST_ROWS=rows;
    document.getElementById('recTB').innerHTML=rows.map(x=>recRowHtml(x,true)).join('');
    const rc=document.getElementById('rCnt'); if(rc)rc.textContent=rows.length;
    updRecEditBar();
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
function tg(i){const el=document.getElementById('g'+i);if(el)el.classList.toggle('o');}
// ── 展開後單筆列的「編輯」：改用事件委派 ──────────────────────────
// 舊版把 openEd 寫在 inline onclick 上，但這些列是巢狀在「整張卡片可點擊展開」的
// 容器裡，一旦外層有其他 click 監聽或內容被重繪，inline 的 stopPropagation 就可能
// 失效（電腦版待補齊頁點編輯沒反應就是這個情況）。
// 改成在 document 上統一攔截帶有 data-editrid 的元素：不管列是什麼時候被重繪出來的、
// 巢狀幾層，都保證點得到，而且只需要一個監聽器。
document.addEventListener('click', function(e){
  const t=e.target.closest&&e.target.closest('[data-editrid]');
  if(!t)return;
  e.stopPropagation(); e.preventDefault();
  openEd(t.getAttribute('data-editrid'));
}, true);
const ITEM_PALETTE=['#16304C','#166B47','#8C6E32','#7A3B69','#2C6B6B','#8A5D0B','#5A4FA0','#B5342C'];
function itemColor(name){if(!name)return'var(--tx)';let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))>>>0;
  return ITEM_PALETTE[h%ITEM_PALETTE.length];}
const TYPE_COLOR={'賣':'sell','備':'prep','樣':'sample'};
function typeBadge(t){if(!t)return'';const cls=TYPE_COLOR[t];const label=cls?t:'其它';
  return `<span class="tbadge${cls?' '+cls:' o'}" title="${esc(t)}">${label}</span>`;}
function tgT(i){document.querySelectorAll(`#tgt-${i}`).forEach(r=>{r.style.display=r.style.display==='none'?'table-row':'none';});}
function keyHtml(){return `<div class="key"><span><i style="background:var(--ok)"></i>已送貨</span><span><i style="background:var(--nav-3)"></i>未送貨</span></div>`;}
function renderIB(){const m={};myRecs().forEach(x=>{if(!x.item)return;m[x.item]=m[x.item]||{sh:0,hd:0};m[x.item][shipStatus(x)]++});
  const e=Object.entries(m).sort((a,b)=>byItemOrder(a[0],b[0]));
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

  // 近六個月備貨量：原本這裡是寫死的假資料 [39,52,33,62,47,實際值]，只有最後一根是真的，
  // 前五根是憑空捏造的數字——這種東西出現在報表上會直接摧毀整份資料的可信度，已改成
  // 全部用這位業務真實的備貨紀錄逐月統計。
  const myMonths=monthsBack(CURRENT_YM,6);
  const v=myMonths.map(ym=>DB.records.filter(x=>x.sales===CUR&&x.stockDate&&x.stockDate.startsWith(ym)).length);
  const mx=Math.max(...v,1);
  document.getElementById('chW').innerHTML=v.map((n,i)=>`<div class="ch-c"><div class="ch-b ${i===v.length-1?'now':''}" style="height:${Math.round(n/mx*100)}%"><span class="ch-v">${n}</span></div></div>`).join('');
  const chX=document.getElementById('chX');
  if(chX) chX.innerHTML=myMonths.map(ym=>`<span>${+ym.slice(5)}月</span>`).join('');

  // 品項庫存明細：改成真正的「目前庫存」，不是本月備貨紀錄的筆數。
  // 資料來自登入時 salesInit 已經一次帶回的 DB.stock（見 gas.js getStockReport_），
  // 本月如果還沒跑月結算，後端會用「上月月底庫存－即時出貨＋本月庫存增加」即時試算一個
  // 目前參考值（estimated:true），所以這裡看到的永遠是最新狀態，不用等到月底才有數字。
  const stockByItem={};
  ((DB.stock&&DB.stock.items)||[]).forEach(it=>{ stockByItem[it.item]=it; });
  const fam={};
  PRODUCT_FAMILIES.forEach(f=>{
    fam[f.key]={name:f.name,color:f.color,items:{}};
    f.items.forEach(itemName=>{fam[f.key].items[itemName]=stockByItem[itemName]||null;});
  });
  const famList=PRODUCT_FAMILIES.map(f=>fam[f.key]);
  document.getElementById('ibStat').innerHTML=`<div class="fam-page-grid">`+famList.map((f,i)=>{
    const entries=Object.entries(f.items);
    let famTotal=0;entries.forEach(([,it])=>{ if(it&&it.thisEnding!==null)famTotal+=Math.max(0,it.thisEnding); });
    const specCells=entries.map(([n,it])=>{
      const val=(it&&it.thisEnding!==null)?Math.max(0,it.thisEnding):null;
      return `<div class="fam-spec-cell"><div class="fsn">${esc(shortItemName(n))}</div><div class="fsv">${val===null?'—':val}</div></div>`;
    }).join('');
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
// ── 待補齊：改成跟「我的紀錄 · 依日期分組」相同的呈現方式 ──────────────
// 舊版每一筆都是一張只有品項與發票日期的小卡，資訊太少、也不能批次處理。
// 現在依「備貨日期」分段，同一天內再依「批號＋品項」分組：
//   ・整張卡點一下就展開，看到組內每一筆的完整欄位
//   ・右側 ✎ 可以整組批次補齊（科別／賣備樣／批號／送貨日期／客戶／品項）
//   ・展開後每一筆都能單獨編輯，按鈕上直接寫還缺幾欄
// 分組沿用 GROUPS 陣列（renderRec 會先清空、renderPend 再往後接），
// 因此批次編輯視窗完全共用同一套邏輯，不需要第二份程式。
function pendSubRow(x){
  return `<div class="rc-sr" data-editrid="${esc(x.recordId)}">
    <div class="sr-main">
      <div class="sr-head">
        ${typeBadge(x.type)||'<span class="tbadge o">—</span>'}
        <span class="sr-cat">${esc(x.customer||'未填客戶')}</span>
        <span class="sr-st h">待補齊</span>
      </div>
      <div class="sr-grid">${srCell(x,'batch',1)}${srCell(x,'shipDate',1)}${srCell(x,'orderNo',1)}</div>
      <div class="sr-grid">${srCell(x,'category')}${srCell(x,'invoiceDate',1)}${srCell(x,'invoiceNo',1)}</div>
      ${(x.loanOut||x.loanReturn)?`<div class="sr-grid">${srCell(x,'loanOut',1)}${srCell(x,'loanReturn',1)}<span></span></div>`:''}
    </div>
    ${srEditBtn(x)}
  </div>`;
}
// 待補齊頁的品項篩選（跟「我的紀錄」上方的品項膠囊同一套操作方式）
let PFI='';
function setPendItem(v){ PFI=v; renderPend(); }
function renderPendItemChips(){
  const el=document.getElementById('pendItemChips'); if(!el)return;
  const cnt={};
  pendRecs().forEach(x=>{ const k=x.item||''; cnt[k]=(cnt[k]||0)+1; });
  const keys=Object.keys(cnt).filter(k=>k).sort(byItemOrder);
  const noItem=cnt['']||0;
  el.innerHTML=`<button class="chip ${PFI===''?'on':''}" onclick="setPendItem('')">全部<span class="n">${pendRecs().length}</span></button>`+
    keys.map(k=>`<button class="chip ${PFI===k?'on':''}" onclick="setPendItem('${jse(k)}')">${esc(tagItemName(k))}<span class="n">${cnt[k]}</span></button>`).join('')+
    (noItem?`<button class="chip ${PFI==='__none__'?'on':''}" onclick="setPendItem('__none__')">未指定品項<span class="n">${noItem}</span></button>`:'');
}
function renderPend(){
  const all=pendRecs();
  renderPendItemChips();
  const rows=PFI?(PFI==='__none__'?all.filter(x=>!x.item):all.filter(x=>x.item===PFI)):all.slice();
  const n=all.length;
  document.getElementById('pCnt').textContent=n;document.getElementById('pCnt2').textContent=n;
  document.getElementById('pAlert').style.display=n?'flex':'none';
  document.getElementById('pDot').style.display=n?'inline-block':'none';
  const el=document.getElementById('pendList');
  if(!n){el.innerHTML=`<div class="pn"><div class="emp"><div class="emp-t">目前沒有待補齊項目</div><div class="emp-s">所有資料都已完整</div></div></div>`;return;}
  if(!rows.length){el.innerHTML=`<div class="pn"><div class="emp"><div class="emp-t">這個品項目前沒有待補齊項目</div><div class="emp-s">請切換上方的品項篩選</div></div></div>`;return;}

  rows.sort((a,b)=>(b.stockDate||'').localeCompare(a.stockDate||'')
    ||byItemOrder(a.item||'',b.item||'')||String(a.batch||'').localeCompare(String(b.batch||'')));

  // 依備貨日期分段（沒填備貨日期的集中在「未填日期」）
  const order=[],by={};
  rows.forEach(x=>{const d=x.stockDate||'';if(!by[d]){by[d]=[];order.push(d);}by[d].push(x);});
  order.sort((a,b)=>{ if(!a)return 1; if(!b)return -1; return b.localeCompare(a); });

  el.innerHTML=order.map(d=>{
    // 同一天內，備貨日期＋批號＋品項相同的視為同一組，可以一次補齊
    const g={},gk=[];
    by[d].forEach(x=>{const k=(x.batch||'')+'|'+(x.item||'');if(!g[k]){g[k]=[];gk.push(k);}g[k].push(x);});
    const cards=gk.map(k=>{
      const its=g[k], i=GROUPS.push(its)-1, f=its[0], fam=familyOf(f.item);
      const missTotal=its.reduce((sum,x)=>sum+recMissing(x).length,0);
      return `<div class="rc rc-pend" onclick="tg(${i})"><div class="rc-s" style="background:${fam.color}"></div><div class="rc-b">
        <div class="rc-t"><span class="rc-c">${esc(dispItem(f.item)||'（未指定品項）')}${its.length>1?`<span class="rc-q">×${its.length}</span>`:''}</span>
          <span class="bg hd">待補齊</span></div>
        <div class="rc-m">
          <span>批號 <b class="mn">${esc(f.batch||'—')}</b></span>
          <span>發票 <b class="mn">${esc(f.invoiceNo||'—')}</b></span>
          <span>借出單 <b class="mn">${esc(f.loanOut||'—')}</b></span>
          <span style="color:var(--bad)">共缺 <b style="color:var(--bad)">${missTotal}</b> 個欄位</span>
        </div>
        <div class="rc-sub" id="g${i}">${its.map(pendSubRow).join('')}</div>
      </div><div class="rc-a rc-a-edit" onclick="event.stopPropagation();openGroupEdit(${i})" title="整組批次補齊">✎</div></div>`;
    }).join('');
    return `<div class="rc-date-sec">${fmtDateShort(d)}</div>`+cards;
  }).join('');
}

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
  const detailBtn = hasDiffs ? `<button type="button" class="log-detail-link" onclick="openLogDetail(${i})">查看前後對照明細</button>` : '';

  return `<div class="timeline-item">
    <div class="timeline-time">${esc(l.t.replace(' ','<br>'))}</div>
    <div class="timeline-node"><div class="timeline-dot ${dotClass}"></div></div>
    <div class="timeline-content">
      <div class="log-top">
        <span class="log-act ${l.ok?'':'fail'}">${esc(l.act)}${l.ok?'':'（失敗）'}</span>
        ${ROLE==='admin' ? `<span class="log-actor">${esc(l.actor)}</span>` : `<span class="log-actor">${l.rid ? '#'+l.rid.slice(-5).toUpperCase() : ''}</span>`}
      </div>
      <div class="log-summary">${summary}</div>
      ${errHtml}
      <div class="log-foot">
        <span class="log-src">${esc(l.src||'')}</span>
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
      <thead><tr><th width="30%">異動欄位</th><th>變更內容　舊 → 新</th></tr></thead>
      <tbody>` + l.diffs.map(d=>
        `<tr>
          <td style="font-weight:600;color:var(--tx-2);">${esc(d.label)}</td>
          <td>
            ${d.before ? `<span class="diff-del">${esc(d.before)}</span> <span class="diff-arrow">→</span> ` : `<span class="diff-arrow" style="margin-left:0">→</span> `}
            ${d.after ? `<span class="diff-add">${esc(d.after)}</span>` : `<span class="diff-add" style="color:var(--tx-3);font-style:italic">（清除）</span>`}
          </td>
        </tr>`
      ).join('') + `</tbody></table>`;
  } else {
    body = `<div class="detail-pre">${esc(l.desc||'（無其他說明）')}</div>`;
  }
  if(!l.ok && l.err) body += `<div class="detail-err">失敗原因：${esc(l.err)}</div>`;
  
  document.getElementById('logDetailBody').innerHTML = body;
  document.getElementById('logDetailMv').classList.add('on');
}

function copyLogDetails() {
    const el = document.getElementById('logDetailBody');
    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text).then(()=>{
        toast('內容已複製到剪貼簿');
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
    batch:PKV.batch||'',stockDate:val('f-sd'),shipDate:val('f-hd'),orderNo:val('f-on'),remark:val('f-rm')};
  if(!item.customer||!item.item){
    addLog({act:'新增紀錄',ok:false,desc:'嘗試新增備貨紀錄',err:'必填欄位未完成（客戶名稱／品項）'});
    renderLogs();toast('請填寫客戶名稱與品項',true);return;}
  // ── 樂觀更新（optimistic update）─────────────────────────────
  // 舊版是「按下送出 → 等 Apps Script 回應 → 才清空表單、才跳到我的紀錄」。
  // Apps Script 本身就有冷啟動＋讀寫試算表的延遲，手機網路又慢，使用者就是盯著
  // 轉圈等好幾秒，完全不知道到底成功了沒。
  //
  // 現在改成：先用暫時編號把資料放進畫面（立刻看得到、可以繼續下一筆），
  // 網路請求在背景進行；成功後把暫時編號換成伺服器回傳的正式編號，
  // 失敗則把這幾筆從畫面收回並提示。暫時編號的紀錄會標記 _tmp，
  // 在正式編號回來之前不允許編輯（openEd 會擋下並提示），避免改到不存在的資料。
  const n=BQ;
  const tmpIds=[];
  for(let k=0;k<n;k++){
    const tid='TMP-'+Date.now()+'-'+k;
    tmpIds.push(tid);
    DB.records.push({recordId:tid,...item,invoiceDate:'',invoiceNo:'',erp:'',loanReturn:'',loanOut:'',note:'',sales:CUR,updatedAt:new Date().toISOString(),_tmp:true});
  }
  ['f-hd','f-on','f-rm'].forEach(id=>{const e=document.getElementById(id);e.value='';mk(e);});
  ['customer','item','category','type','batch'].forEach(clearPk);BQ=1;bq(0);
  renderMChips();renderIChips();renderRec();renderStats();renderPend();
  tab('rec',document.querySelectorAll('#salesApp .nav-b')[1]);
  busy(btn,false);
  toast(`已送出 ${n} 筆，儲存中…`);

  const res=await api('createRecords',{item,qty:n,actor:CUR});
  if(res.status==='success'){
    (res.ids||[]).forEach((realId,k)=>{
      const rec=DB.records.find(r=>r.recordId===tmpIds[k]);
      if(rec){ rec.recordId=realId; delete rec._tmp; }
    });
    // 伺服器回傳的筆數若比暫存少（極少見），把多出來的暫存收回
    DB.records=DB.records.filter(r=>!(r._tmp&&tmpIds.includes(r.recordId)));
    renderRec();renderStats();renderPend();
    toast(`已建立 ${res.createdCount} 筆備貨紀錄`);
    queueSalesSync();
  }else{
    DB.records=DB.records.filter(r=>!tmpIds.includes(r.recordId));
    renderMChips();renderIChips();renderRec();renderStats();renderPend();
    addLog({act:'新增紀錄',ok:false,desc:`嘗試新增客戶「${item.customer}」備貨紀錄`,err:res.message||'未知錯誤'});
    renderLogs();toast('送出失敗，資料已收回：'+(res.message||'未知錯誤'),true);
  }
}
function fillDatalist(dlId,values){const dl=document.getElementById(dlId);if(dl)dl.innerHTML=values.map(v=>`<option value="${esc(v)}">`).join('');}
function openEd(id){const x=DB.records.find(v=>v.recordId===id);if(!x)return;
  if(x._tmp){toast('這筆資料還在儲存中，請稍候幾秒再編輯');return;}
  EDID=id;
  document.getElementById('edRef').textContent='REC / '+id;
  // 客戶／品項／科別／賣備樣改用跟「備貨登記」同一套的下拉選擇器（可搜尋、可直接輸入新值），
  // 不再是看起來像純文字框的 datalist——手機上根本看不出來可以點開選單。
  setPk('e-cu',x.customer);setPk('e-it',x.item);setPk('e-ca',x.category);setPk('e-ty',x.type);setPk('e-ba',x.batch);
  set('e-sd',x.stockDate);set('e-hd',x.shipDate);set('e-on',x.orderNo);
  set('e-rm',x.remark);
  const miss=recMissing(x);
  const tip=document.getElementById('edMiss');
  if(tip) tip.innerHTML=miss.length?`<div class="ed-miss">尚缺 <b>${miss.length}</b> 個欄位：${miss.map(k=>esc(LBL[k])).join('、')}</div>`:`<div class="ed-ok">此筆資料已填寫完整</div>`;
  document.getElementById('edMv').classList.add('on');}
function set(id,v){const e=document.getElementById(id);e.value=v||'';mk(e);}
function closeEd(){document.getElementById('edMv').classList.remove('on');}
// ── 批次編輯 ──────────────────────────────────────────────
// 「組內目前完整資料」改成不需要左右拖曳的三排式排版（原本是一張要橫向捲動的表格，
// 手機上根本看不完）：
//   第一排：備貨日期／品項／批號／送貨日期
//   第二排：客戶名稱／科別／賣備樣／訂購單號
//   第三排：備註（整排）
// 排版緊湊，一次就能檢閱完整組資料。
const GED_ROW1=['stockDate','item','batch','shipDate'];
const GED_ROW2=['customer','category','type','orderNo'];
function gedCell(x,k){
  const v=x[k];
  const mono=(k==='stockDate'||k==='shipDate'||k==='batch'||k==='orderNo')?' mn':'';
  return `<div class="gsum-f"><span class="gsum-k">${esc(LBL[k])}</span><span class="gsum-v${mono}${(v===undefined||v===null||v==='')?' empty':''}">${esc(v||'—')}</span></div>`;
}
function openGroupEdit(i){GEDI=i;const its=GROUPS[i];if(!its)return;
  document.getElementById('gEdRef').textContent=its.length+' 筆';
  ['g-hd'].forEach(id=>{const e=document.getElementById(id);e.value='';mk(e);});
  ['g-cu','g-it','g-ca','g-ty','g-ba'].forEach(k=>setPk(k,''));

  document.getElementById('gEdPreview').innerHTML=its.map((x,ri)=>
    `<div class="gsum-it">
       <div class="gsum-no mn">#${ri+1}</div>
       <div class="gsum-grid">
         ${GED_ROW1.map(k=>gedCell(x,k)).join('')}
         ${GED_ROW2.map(k=>gedCell(x,k)).join('')}
         <div class="gsum-f gsum-wide"><span class="gsum-k">備註</span><span class="gsum-v${x.remark?'':' empty'}">${esc(x.remark||'—')}</span></div>
       </div>
     </div>`).join('');

  const fields=[['customer','客戶名稱'],['item','品項'],['category','科別'],['type','賣/備/樣'],['batch','批號'],['shipDate','送貨日期']];
  let warn='';
  fields.forEach(([k,label])=>{
    const cnt={};its.forEach(x=>{const v=x[k]&&x[k].trim()?x[k]:'（空白）';cnt[v]=(cnt[v]||0)+1;});
    const keys=Object.keys(cnt);
    if(keys.length>1)warn+=`<div class="gwarn"><b>${label}</b> 組內原本不一致：${keys.map(v=>`${esc(v)}×${cnt[v]}`).join('、')}</div>`;
  });
  document.getElementById('gEdWarn').innerHTML=warn?`<div class="gwarn-box">此組別部分欄位原本就填得不一樣，套用後將全部覆蓋為您輸入的新值：${warn}</div>`:'';
  document.getElementById('gEdMv').classList.add('on');}
function closeGroupEdit(){document.getElementById('gEdMv').classList.remove('on');}

function collectGroupChanges(){
  const changes={};
  const cu=PKV['g-cu']||'', it=PKV['g-it']||'', ca=PKV['g-ca']||'', ty=PKV['g-ty']||'';
  const ba=PKV['g-ba']||'', hd=val('g-hd');
  if(cu)changes.customer=cu;if(it)changes.item=it;
  if(ca)changes.category=ca;if(ty)changes.type=ty;
  if(ba)changes.batch=ba;if(hd)changes.shipDate=hd;
  return changes;
}
// 按「套用」不再直接寫入，而是先跳出確認視窗說明會變更哪些欄位、會影響幾筆，
// 由使用者按「確認套用」或「取消」。原本按下去按鈕文字會整個不見，是因為
// busy() 在關閉視窗的同時改了按鈕文字、視窗又被關掉，看起來就像文字消失了。
let GED_PENDING=null;
function openGroupConfirm(){
  const its=GROUPS[GEDI];if(!its)return;
  const changes=collectGroupChanges();
  if(!Object.keys(changes).length){toast('請至少填寫一個要套用的欄位',true);return;}
  const targets=its.filter(x=>Object.keys(changes).some(k=>String(x[k]||'')!==String(changes[k])));
  if(!targets.length){toast('組內資料已與輸入值相同，沒有需要變更的紀錄');return;}
  GED_PENDING={changes:changes,targets:targets,total:its.length};
  document.getElementById('gCfRef').textContent=`本組共 ${its.length} 筆`;
  document.getElementById('gCfBody').innerHTML=
    `<div class="gcf-lead">以下欄位將被覆寫為新值：</div>`+
    Object.keys(changes).map(k=>
      `<div class="gcf-row"><span class="gcf-k">${esc(LBL[k])}</span><span class="gcf-arrow">→</span><span class="gcf-v mn">${esc(changes[k])}</span></div>`).join('')+
    `<div class="gcf-note">將會更新 <b>${targets.length}</b> 筆資料`+
      (targets.length<its.length?`（其餘 ${its.length-targets.length} 筆內容已相同，不會變更）`:'')+`。</div>`;
  document.getElementById('gCfMv').classList.add('on');
}
function closeGroupConfirm(){document.getElementById('gCfMv').classList.remove('on');GED_PENDING=null;}

// ── 送出效能 ────────────────────────────────────────────────
// 舊版是 for 迴圈「一筆一筆」呼叫 updateRecord：一組 8 筆就是 8 次來回的網路請求，
// 而且是排隊逐一等待，每次 Apps Script 都要重新讀一遍整張試算表 —— 這就是「明明只是
// 很簡單的欄位卻卡很久」的原因。改成呼叫既有的 batchUpdate，不論幾筆都只送一次請求，
// 後端也只讀一次試算表、LOG 一次寫入。送出後直接更新本機資料重繪，背景再靜默同步。
async function doGroupEdit(btn){
  if(btn&&btn.disabled)return;
  if(!GED_PENDING)return;
  const changes=GED_PENDING.changes, targets=GED_PENDING.targets;
  busy(btn,true,'套用中…');
  const updates=targets.map(x=>({recordId:x.recordId,changes:changes}));
  // 樂觀更新：先套用到畫面並關閉視窗，網路在背景送出，失敗再還原
  const before=targets.map(x=>{const o={};Object.keys(changes).forEach(k=>o[k]=x[k]);return o;});
  targets.forEach(x=>Object.assign(x,changes));
  const n=targets.length;
  closeGroupConfirm();closeGroupEdit();
  renderRec();renderStats();renderPend();
  const res=await api('batchUpdate',{updates:updates,actor:CUR,source:'業務端網頁（整組批次）'});
  busy(btn,false);
  if(res.status==='success'){
    toast(`已套用到 ${n} 筆紀錄`);
    queueSalesSync();
  }else{
    targets.forEach((x,i)=>Object.assign(x,before[i]));
    renderRec();renderStats();renderPend();
    targets.forEach(x=>{
      const diffs=Object.keys(changes).map(k=>({label:LBL[k],before:x[k]||'',after:changes[k]}));
      addLog({act:'批次修改',ok:false,rid:x.recordId,diffs:diffs,err:res.message||'未知錯誤',src:'業務端網頁（整組批次）'});
    });
    toast('套用失敗：'+(res.message||'未知錯誤'),true);
  }
}
async function saveEd(btn){
  if(btn&&btn.disabled)return;
  const x=DB.records.find(v=>v.recordId===EDID);if(!x)return;
  const nv={customer:PKV['e-cu']||'',item:PKV['e-it']||'',category:PKV['e-ca']||'',type:PKV['e-ty']||'',
    stockDate:val('e-sd'),shipDate:val('e-hd'),batch:PKV['e-ba']||'',orderNo:val('e-on'),remark:val('e-rm')};
  const diffs=[];Object.keys(nv).forEach(k=>{if(String(x[k]||'')!==String(nv[k]||''))diffs.push({label:LBL[k],before:x[k],after:nv[k]});});
  if(!diffs.length){toast('沒有任何變更');closeEd();return;}

  // 樂觀更新：視窗立刻關閉、畫面立刻套用新值，網路請求在背景送出。
  // 失敗（含版本衝突）時再把畫面改回原值並提示，不讓使用者對著轉圈乾等。
  const before={}; Object.keys(nv).forEach(k=>before[k]=x[k]);
  const rid=EDID, prevUpdatedAt=x.updatedAt;
  Object.assign(x,nv);
  closeEd();
  if(ROLE==='admin'){renderGrid();}else{renderIChips();renderRec();renderStats();renderPend();}
  toast('已儲存修改');

  const res=await api('updateRecord',{recordId:rid,changes:nv,actor:CUR,expectedUpdatedAt:prevUpdatedAt});
  if(res.status==='success'){
    if(res.updatedAt) x.updatedAt=res.updatedAt;
    if(ROLE==='admin')queueAdminSync();else queueSalesSync();
  }else{
    Object.assign(x,before); // 還原
    if(ROLE==='admin'){renderGrid();renderALog();}else{renderIChips();renderRec();renderStats();renderPend();}
    if(res.status==='conflict'){
      addLog({act:'修改紀錄',ok:false,rid:rid,diffs,err:'版本衝突：這筆資料已被他人修改'});
      toast('這筆資料剛剛被其他人改過，您的修改未儲存，已載入最新版本，請重新確認',true);
      if(ROLE==='admin')loadAdminData();else loadSalesData(true);
    }else{
      addLog({act:'修改紀錄',ok:false,rid:rid,diffs,err:res.message||'未知錯誤'});
      toast('儲存失敗，已還原：'+(res.message||'未知錯誤'),true);
    }
    renderLogs();
  }
}
async function delRec(btn){
  if(btn&&btn.disabled)return;
  const x=DB.records.find(v=>v.recordId===EDID);if(!x)return;
  // 同樣採樂觀更新：先從畫面移除，失敗再放回去
  const rid=EDID, idx=DB.records.indexOf(x);
  DB.records.splice(idx,1);
  closeEd();
  if(ROLE==='admin'){renderGrid();}else{renderIChips();renderRec();renderStats();renderPend();}
  toast('已刪除此筆紀錄');
  const res=await api('deleteRecord',{recordId:rid,actor:CUR});
  if(res.status==='success'){
    if(ROLE==='admin')queueAdminSync();else queueSalesSync();
  }else{
    DB.records.splice(idx,0,x);
    if(ROLE==='admin'){renderGrid();renderALog();}else{renderIChips();renderRec();renderStats();renderPend();}
    addLog({act:'刪除紀錄',ok:false,rid:rid,err:res.message||'未知錯誤'});renderLogs();
    toast('刪除失敗，資料已還原',true);
  }
}

/* ── ADMIN ── */
function initAdmin(){renderAChips();renderGrid();renderALog();}

/* ══════════════ MANAGER (主管儀表板) ══════════════ */
// MGR_REPORT：主管庫存報表快取，結構為 { yearMonth, prevYearMonth, items:[{sales,item,prevEnding,increase,shipment,thisEnding,settled}] }
// 三個欄位都可能是 null：settled=false 代表這個月系統還沒結算（要等下個月 1 號），
// prevEnding=null 代表上個月沒有月底庫存基準（尚未在庫存資料試算表填過起算基準）。
let MGR_REPORT={yearMonth:'',prevYearMonth:'',items:[]};
let MGR_LOADED=false; // 尚未載入完成時，各面板顯示「讀取中」而不是「本月尚無資料」，避免看起來像壞掉

// ── 庫存報表快取 ───────────────────────────────────────────
// 主管畫面的每一塊資料（產品備貨數量、品牌家族出貨量、業務庫存明細、留存排行）
// 全部來自同一支 getStockReport（＝「庫存資料」試算表）。同一個月份只會真的去抓一次，
// 之後切來切去都是瞬間切換，不會每按一次月份就重打一次 API。
const STOCK_RPT_CACHE={};
async function fetchStockReport(ym){
  if(STOCK_RPT_CACHE[ym]) return STOCK_RPT_CACHE[ym];
  const res=await api('getStockReport',{yearMonth:ym});
  if(res.status!=='success') throw new Error(res.message||'讀取失敗');
  STOCK_RPT_CACHE[ym]=res;
  return res;
}
function monthLabel(ym){ return ym?ym.slice(0,4)+'年'+(+ym.slice(5))+'月':''; }
function shiftYM(ym,delta){
  let[y,m]=ym.split('-').map(Number); m+=delta;
  while(m<1){m+=12;y--;} while(m>12){m-=12;y++;}
  return y+'-'+String(m).padStart(2,'0');
}

/* ══════════ 一、本月備貨概況 ══════════
   資料來源：「庫存資料」試算表。
   ・產品備貨數量 → 該月份／該品項的「月底庫存」，依業務列出，最上方是全業務加總。
   ・品牌家族本月出貨量 → 該月份的「月出貨」，依品牌家族加總。
   兩塊共用同一份 getStockReport 結果，所以切月份只會有一次讀取。            */
const MGR_OV_ITEMS=ITEM_ORDER.slice();
let MGR_OV_YM='', MGR_OV_ITEM=MGR_OV_ITEMS[0], MGR_OV_RPT=null, MGR_OV_BUSY=false;
// 業務清單預設「固定位置」＝依名冊順序，切品項／切月份時每個人都待在原地，
// 眼睛不用重新找人。想看排名時按一下「依數量排序」才會重排。
let MGR_OV_SORT='roster';
function toggleMgrOvSort(){ MGR_OV_SORT=(MGR_OV_SORT==='roster')?'qty':'roster'; renderMgrOverview(); }

async function changeMgrOvMonth(delta){
  if(MGR_OV_BUSY)return;
  MGR_OV_YM=shiftYM(MGR_OV_YM,delta);
  await loadMgrOverview();
}
async function loadMgrOverview(){
  MGR_OV_BUSY=true;
  document.getElementById('mgrOvMonthLabel').textContent=monthLabel(MGR_OV_YM);
  if(!STOCK_RPT_CACHE[MGR_OV_YM]) document.getElementById('mgrOvList').innerHTML=`<div class="emp-s">讀取 ${monthLabel(MGR_OV_YM)} 庫存資料中…</div>`;
  try{
    MGR_OV_RPT=await fetchStockReport(MGR_OV_YM);
  }catch(err){
    MGR_OV_RPT=null;
    toast('讀取失敗：'+err.message,true);
  }
  MGR_OV_BUSY=false;
  renderMgrOverview();
}
function setMgrOvItem(it){ MGR_OV_ITEM=it; renderMgrOverview(); }
function renderMgrOverview(){
  // 品項切換按鈕（速原10ml-2級 固定排第一個）
  document.getElementById('mgrOvItems').innerHTML=MGR_OV_ITEMS.map(it=>
    `<button type="button" class="ov-item-btn ${MGR_OV_ITEM===it?'on':''}" onclick="setMgrOvItem('${jse(it)}')">${esc(tagItemName(it))}</button>`).join('');

  const by={};
  ((MGR_OV_RPT&&MGR_OV_RPT.items)||[]).forEach(it=>{
    if(it.item!==MGR_OV_ITEM)return;
    if(it.thisEnding===null)return;
    by[it.sales]=(by[it.sales]||0)+Math.max(0,it.thisEnding);
  });
  const list=ROSTERS.sales.map(p=>({name:p.name,qty:(by[p.name]!==undefined?by[p.name]:null)}));
  // 名冊以外、但試算表裡有資料的業務也一併列出，避免資料被默默漏掉
  Object.keys(by).forEach(n=>{ if(!ROSTERS.sales.some(p=>p.name===n)) list.push({name:n,qty:by[n]}); });
  if(MGR_OV_SORT==='qty') list.sort((x,y)=>(y.qty||0)-(x.qty||0)||x.name.localeCompare(y.name,'zh-TW'));
  const sb=document.getElementById('mgrOvSortBtn');
  if(sb){ sb.textContent=MGR_OV_SORT==='qty'?'✓ 依數量排序':'依數量排序';
          sb.classList.toggle('on',MGR_OV_SORT==='qty'); }

  const total=list.reduce((sum,x)=>sum+(x.qty||0),0);
  document.getElementById('mgrOvTotalV').textContent=nf(total);
  document.getElementById('mgrOvTotalK').textContent=`${monthLabel(MGR_OV_YM)}　${dispItem(MGR_OV_ITEM)}　全業務月底庫存加總`;

  const rows=Math.max(1,Math.ceil(list.length/2)); // 左右各一欄，一欄約十位業務
  document.getElementById('mgrOvList').innerHTML=list.length
    ? `<div class="ov-grid" style="grid-template-rows:repeat(${rows},auto)">`+list.map(x=>
        `<div class="ov-row ${x.qty===null?'nodata':''}"><span class="ov-name">${esc(x.name)}</span><span class="ov-qty mn">${x.qty===null?'—':nf(x.qty)}</span></div>`).join('')+`</div>`
    : `<div class="emp-s">${MGR_LOADED?'這個月份的「庫存資料」表裡找不到這個品項的月底庫存':'讀取中…'}</div>`;

  renderMgrFamilyShipment();
}
// 品牌家族本月出貨量：直接讀「庫存資料」表的「月出貨」，依所選月份加總，
// 不再從備貨紀錄逐筆統計（原本的做法要掃整張備貨紀錄表，是主管畫面最慢的一段）。
function renderMgrFamilyShipment(){
  const byItem={};
  ((MGR_OV_RPT&&MGR_OV_RPT.items)||[]).forEach(it=>{
    if(it.shipment===null||it.shipment===undefined)return;
    byItem[it.item]=(byItem[it.item]||0)+Math.max(0,it.shipment);
  });
  const fam={};
  Object.keys(byItem).forEach(item=>{
    const f=familyOf(item);
    fam[f.key]=fam[f.key]||{name:f.name,color:f.color,ship:0};
    fam[f.key].ship+=byItem[item];
  });
  const famList=PRODUCT_FAMILIES.map(f=>fam[f.key]).filter(Boolean);
  const famMax=famList.length?Math.max(...famList.map(f=>f.ship),1):1;
  document.getElementById('mgrFamilyNote').textContent=monthLabel(MGR_OV_YM)+'（來源：庫存資料表 · 月出貨）';
  document.getElementById('mgrFamily').innerHTML=famList.length?famList.map(f=>`
    <div class="fam-block" style="border-left-color:${f.color}">
      <div class="fam-head"><span class="fam-dot" style="background:${f.color}"></span><span class="fam-name">${esc(f.name)}</span>
        <span class="fam-total">出貨 <b class="mn" style="color:${f.color};font-size:14px">${nf(f.ship)}</b></span></div>
      <div class="stk"><div class="a" style="width:${Math.round(f.ship/famMax*100)}%;background:${f.color}"></div><div class="b"></div></div>
    </div>`).join('') : `<div class="emp-s">${MGR_LOADED?'這個月份尚無月出貨資料':'讀取中…'}</div>`;
}

/* ══════════ 二、庫存結算報表 ══════════ */
// 主管報表看的月份：預設是「上個月」（系統每月 1 號才會把上個月的月出貨／月底庫存結算
// 寫進「庫存資料」表），但可以用上一月／下一月按鈕自由往前後翻，單純讀表、不做即時試算。
let MGR_STOCK_YM='';
async function changeMgrStockMonth(delta){
  MGR_STOCK_YM=shiftYM(MGR_STOCK_YM,delta);
  document.getElementById('mgrStockMonthLabel').textContent=monthLabel(MGR_STOCK_YM);
  try{
    MGR_REPORT=await fetchStockReport(MGR_STOCK_YM);
  }catch(err){ toast('讀取失敗：'+err.message,true); return; }
  renderNameGrid(); renderMgrStockProgress();
  if(MGR_SELECTED) selectMgrPerson(MGR_SELECTED);
  else document.getElementById('mgrDetailArea').innerHTML=`<div class="emp"><div class="emp-t">請從上方點選一位業務</div><div class="emp-s">點下去才會讀取該業務在 ${monthLabel(MGR_STOCK_YM)} 的庫存明細</div></div>`;
}
function renderMgrStockProgress(){
  const settledSet=new Set(MGR_REPORT.items.filter(it=>it.thisEnding!==null).map(it=>it.sales));
  const totalN=ROSTERS.sales.length, settledN=settledSet.size;
  document.getElementById('mgrStockProgN').textContent=MGR_LOADED
    ?(monthLabel(MGR_REPORT.yearMonth)+'份　'+settledN+' / '+totalN+' 人已有庫存資料')
    :'讀取庫存資料中…';
  document.getElementById('mgrStockProgBar').style.width=(MGR_LOADED&&totalN?Math.round(settledN/totalN*100):0)+'%';
}

// 一進主管畫面就先把骨架畫出來，再去抓資料。
// 兩個區塊預設都看「上個月」，因為系統每月 1 號才結算上個月的月出貨／月底庫存，
// 看當月會全部是空的。兩區共用同一份快取，所以開場只需要一次讀取。
function initManagerScreen(){
  MGR_STOCK_YM=shiftYM(CURRENT_YM,-1);
  MGR_OV_YM=MGR_STOCK_YM;
  MGR_OV_ITEM=MGR_OV_ITEMS[0];
  document.getElementById('mgrStockMonthLabel').textContent=monthLabel(MGR_STOCK_YM);
  document.getElementById('mgrOvMonthLabel').textContent=monthLabel(MGR_OV_YM);
  MGR_LOADED=false; MGR_SELECTED=null;
  renderMgrOverview();
  renderNameGrid();
  renderMgrStockProgress();
  document.getElementById('mgrDetailArea').innerHTML=`<div class="emp"><div class="emp-t">請從上方點選一位業務</div><div class="emp-s">點下去才會開始讀取該業務的庫存明細</div></div>`;
  loadManagerData();
}
// 【效能】原本這裡呼叫 managerInit：後端會把整張「備貨紀錄」表讀進來，
// 逐筆統計四個大數字、六個月趨勢、各業務績效排行。現在這些區塊都已移除，
// 需要的資料全部來自「庫存資料」表，所以改成只打一次 getStockReport ——
// 讀取量從整張備貨紀錄縮到只剩庫存表，主管畫面開啟速度差很多。
async function loadManagerData(){
  try{
    MGR_REPORT=await fetchStockReport(MGR_STOCK_YM);
    MGR_OV_RPT=(MGR_OV_YM===MGR_STOCK_YM)?MGR_REPORT:await fetchStockReport(MGR_OV_YM);
  }catch(err){
    toast('讀取資料失敗：'+err.message, true);
  }finally{
    MGR_LOADED=true;
    renderMgrOverview();
    renderNameGrid();
    renderMgrStockProgress();
    if(MGR_SELECTED) selectMgrPerson(MGR_SELECTED);
  }
}
async function refreshManager(){
  const btn=document.getElementById('mgrRefreshBtn');busy(btn,true);
  MGR_LOADED=false;
  Object.keys(STOCK_RPT_CACHE).forEach(k=>delete STOCK_RPT_CACHE[k]); // 手動重新整理才清快取
  MGR_DETAIL_CACHE={};
  await loadManagerData();
  busy(btn,false);toast('已更新為最新資料');
}
function monthsBack(ym,n){
  const arr=[];let[y,m]=ym.split('-').map(Number);
  for(let i=n-1;i>=0;i--){let mm=m-i,yy=y;while(mm<1){mm+=12;yy--;}arr.push(yy+'-'+String(mm).padStart(2,'0'));}
  return arr;
}
let MGR_SELECTED=null, MGR_SELECT_TOKEN=0, MGR_DETAIL_CACHE={};
function renderNameGrid(){
  // 灰點／亮點代表這位業務在目前檢視的月份是否已經有月結算資料（純讀表，不即時試算）
  const settledSet=new Set(MGR_REPORT.items.filter(it=>it.thisEnding!==null).map(it=>it.sales));
  document.getElementById('mgrNameGrid').innerHTML=ROSTERS.sales.map(p=>
    `<button type="button" class="mgr-name-btn ${MGR_SELECTED===p.name?'on':''}" onclick="selectMgrPerson('${jse(p.name)}')">
      <span class="rpt-dot ${settledSet.has(p.name)?'reported':''}"></span>${esc(p.name)}
    </button>`).join('');
}
// 點選業務姓名：整份月份報表其實已經在 MGR_REPORT 裡了，直接就地篩出這個人的資料即可，
// 不必再為了「看一個人」多打一次 API（舊版每點一個人就是一次網路來回，點得越快等越久）。
async function selectMgrPerson(salesName){
  MGR_SELECTED=salesName;
  renderNameGrid();
  const area=document.getElementById('mgrDetailArea');
  area.scrollIntoView({behavior:'smooth',block:'nearest'});
  const token=++MGR_SELECT_TOKEN;
  let rpt=MGR_REPORT;
  if(!rpt || rpt.yearMonth!==MGR_STOCK_YM){
    area.innerHTML=`<div class="emp-s">讀取 ${esc(salesName)} 的庫存資料中…</div>`;
    try{ rpt=await fetchStockReport(MGR_STOCK_YM); }
    catch(err){ area.innerHTML=`<div class="emp-s">讀取失敗：${esc(err.message)}</div>`; return; }
    if(token!==MGR_SELECT_TOKEN) return;
    MGR_REPORT=rpt;
  }
  renderMgrDetail(salesName, {
    yearMonth:rpt.yearMonth, prevYearMonth:rpt.prevYearMonth,
    items:rpt.items.filter(it=>it.sales===salesName)
  });
}
let MGR_DETAIL_SALES='', MGR_DETAIL_ITEMS=[], MGR_DETAIL_ML='', MGR_DETAIL_PML='';
// 色條一律用「實際數量」呈現（原本還有一個「出貨比例」切換，實務上沒人用，
// 反而讓每一列的長度基準不一致、更難互相比較，因此整個移除）。
let MGR_DETAIL_GROUP='ALL';
const MGR_DETAIL_VIEW='absolute';
function nf(n){ return Number(n||0).toLocaleString('zh-TW'); }
function niceCeil_(v){
  if(v<=5)return 5;
  const mag=Math.pow(10,Math.floor(Math.log10(v)));
  const norm=v/mag;
  const nice=norm<=1?1:norm<=2?2:norm<=5?5:10;
  return nice*mag;
}
function renderMgrDetail(salesName, res){
  MGR_DETAIL_SALES=salesName;
  MGR_DETAIL_ITEMS=(res.items||[]).slice().sort((a,b)=>byItemOrder(a.item,b.item));
  MGR_DETAIL_ML=monthLabel(res.yearMonth);
  MGR_DETAIL_PML=monthLabel(res.prevYearMonth);
  MGR_DETAIL_GROUP='ALL';
  renderMgrDetailBody();
}
function setMgrDetailGroup(g){ MGR_DETAIL_GROUP=g; renderMgrDetailBody(); }
function renderMgrDetailBody(){
  const area=document.getElementById('mgrDetailArea');
  const items=MGR_DETAIL_ITEMS;
  if(!items.length){
    area.innerHTML=`<div class="emp"><div class="emp-t">${esc(MGR_DETAIL_SALES)} 在 ${MGR_DETAIL_ML} 沒有任何庫存資料</div><div class="emp-s">「庫存資料」試算表裡找不到這個人這個月份的任何一列</div></div>`;
    return;
  }
  // 品項分群 chips：全部品項 + 各品牌家族，點下去只篩選下方表格，數字是各分類的本月庫存小計
  const groupTotal=gid=>items.filter(it=>gid==='ALL'||familyOf(it.item).key===gid).reduce((s,it)=>s+Math.max(0,it.thisEnding||0),0);
  const groups=[{key:'ALL',name:'全部品項',color:'var(--nav)'}].concat(PRODUCT_FAMILIES);
  const stripHtml=groups.map(g=>`<button type="button" class="grp-chip ${MGR_DETAIL_GROUP===g.key?'on':''}" style="--chip-color:${g.color}" onclick="setMgrDetailGroup('${g.key}')">
      <span class="grp-chip-dot"></span>${esc(g.name)}<b>${nf(groupTotal(g.key))}</b>
    </button>`).join('');

  const filtered=MGR_DETAIL_GROUP==='ALL'?items:items.filter(it=>familyOf(it.item).key===MGR_DETAIL_GROUP);
  // 尺度必須涵蓋「庫存＋出貨」整根堆疊長條，不能只看上月庫存
  const scaleMax=niceCeil_(Math.max(1,...filtered.map(it=>
    Math.max(it.prevEnding||0, Math.max(0,it.thisEnding||0)+Math.max(0,it.shipment||0)))));

  const rowsHtml=filtered.length?filtered.map(it=>{
    const ending=Math.max(0,it.thisEnding||0);
    const shipment=Math.max(0,it.shipment||0);
    const rate=(it.prevEnding&&it.thisEnding!==null)?Math.round(shipment/it.prevEnding*1000)/10:null;
    let stockPct=Math.min(100,ending/scaleMax*100);
    let shipPct=Math.min(100-stockPct,shipment/scaleMax*100);
    stockPct=Math.max(0,Math.min(100,stockPct));
    shipPct=Math.max(0,Math.min(100-stockPct,shipPct));
    const axisMax=nf(scaleMax);
    const axisHalf=nf(Math.round(scaleMax/2));
    const noData=it.thisEnding===null;
    // 欄位順序調整為：本月庫存 → 庫存結構 → 本月出貨 → 出貨率 → 上月庫存，
    // 讓「出貨率」緊接在「本月出貨」後面（手機版更直覺）。
    // 手機版會隱藏刻度軸（0／250／500）與左側大數字，改把本月庫存數放在長條的尾巴。
    // 品名改成最左側的彩色標籤（顏色＝品牌家族色），少佔一行、也更容易分辨系列
    const fam=familyOf(it.item);
    return `<div class="stkr-row">
      <div class="stkr-name"><span class="stkr-tag" style="--tag:${fam.color}" title="${esc(dispItem(it.item))}">${esc(tagItemName(it.item))}</span></div>
      <div class="stkr-num stkr-main">${noData?'—':nf(ending)}</div>
      <div class="stkr-bar">
        <div class="stkr-axis"><span>0</span><span>${axisHalf}</span><span>${axisMax}</span></div>
        <div class="stkr-trackline">
          <div class="stkr-track">
            <span class="stkr-seg stock" style="width:${noData?0:stockPct}%"></span>
            <span class="stkr-seg ship" style="width:${noData?0:shipPct}%;left:${noData?0:stockPct}%"></span>
          </div>
          <span class="stkr-endv mn">${noData?'—':nf(ending)}</span>
        </div>
      </div>
      <div class="stkr-num c-ship" data-label="本月出貨">${it.shipment===null?'—':nf(it.shipment)}<span class="rate-in">${rate===null?'':' ('+rate+'%)'}</span></div>
      <div class="stkr-num c-rate" data-label="出貨率">${rate===null?'—':rate+'%'}</div>
      <div class="stkr-num c-prev" data-label="上月庫存">${it.prevEnding===null?'—':nf(it.prevEnding)}</div>
    </div>`;
  }).join(''):`<div class="empty-state">這個分類目前沒有品項資料。</div>`;

  area.innerHTML=`<div class="mgr-detail-head"><span class="mgr-detail-name">${esc(MGR_DETAIL_SALES)}</span></div>
    <div class="grp-strip">${stripHtml}</div>
    <div class="stkr-legend">
      <span><i class="stock"></i>本月庫存</span><span><i class="ship"></i>本月出貨</span>
      <span class="stkr-scale-note">共同數量尺度：0–${nf(scaleMax)}</span>
    </div>
    <div class="stkr-table">
      <div class="stkr-head"><span>品項</span><span>本月庫存</span><span class="h-bar">庫存結構</span><span>本月出貨</span><span class="h-rate">出貨率</span><span>上月庫存</span></div>
      ${rowsHtml}
    </div>`;
}
// 「品項庫存留存排行」面板已移除（跟業務庫存明細報表的資訊重複，主管實際上只看明細）。
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
    return `<th class="${thCls}" onclick="openHeaderFilter(event,'admin','${c.k}')">${c.n}${sortIcon(ASORT,c.k)}<span class="th-fico">▾</span>${badge}<span class="col-rs" data-col="${c.k}"></span></th>`;
  }).join('');
  attachColResize('gridHead','gridCol',GRID_COL_W);
  setExactTableWidth('gridTableEl',COLS,GRID_COL_W,undefined,0);
}
function renderAChips(){
  const sc={};DB.records.forEach(x=>{if(x.sales)sc[x.sales]=(sc[x.sales]||0)+1});
  document.getElementById('aSalesChips').innerHTML=
    `<button class="chip ${ASales===''?'on':''}" onclick="ASales='';renderAChips();renderGridDebounced()">全部</button>`+
    SALES_NAMES.filter(s=>sc[s]).map(s=>`<button class="chip ${ASales===s?'on':''}" onclick="ASales='${jse(s)}';renderAChips();renderGridDebounced()">${esc(s)}<span class="n">${sc[s]}</span></button>`).join('');
  const ic={};DB.records.forEach(x=>{if(x.item)ic[x.item]=(ic[x.item]||0)+1});
  document.getElementById('aItemChips').innerHTML=
    `<button class="chip ${AItem===''?'on':''}" onclick="AItem='';renderAChips();renderGridDebounced()">全部</button>`+
    ITEM_CATALOG.filter(i=>ic[i]).sort(byItemOrder).map(i=>`<button class="chip ${AItem===i?'on':''}" onclick="AItem='${jse(i)}';renderAChips();renderGridDebounced()">${esc(dispItem(i))}<span class="n">${ic[i]}</span></button>`).join('');
  document.getElementById('aEmptyChips').innerHTML=EMPTY_F.map(f=>`<button class="chip wo ${AEmpty.has(f.k)?'on':''}" onclick="tglEmpty('${f.k}')">${f.n}</button>`).join('');
  const activeCols=COLS.filter(c=>hfActive(HF,c.k));
  document.getElementById('adminActiveFilterChips').innerHTML=sortChipHtml(ASORT,'admin')+activeCols.map(c=>
    `<span class="af-chip" onclick="openFilterModal('admin','${c.k}')">${c.n}<span class="af-x" onclick="event.stopPropagation();quickClearAdminFilter('${c.k}')">✕</span></span>`).join('');
}
function quickClearAdminFilter(col){ delete HF[col]; renderAChips(); renderGrid(); }

// ── 表頭篩選（Excel 自動篩選風格）：每一欄都能點表頭，勾選要顯示的值 ──
// 行政總表跟業務「我的紀錄」共用同一套彈窗機制，用 HF_CTX 分辨目前是哪一邊：
// HF＝行政總表的篩選狀態，RF＝業務我的紀錄的篩選狀態。[欄位]＝「要排除、不顯示」的值集合，
// 沒有這個 key 或集合是空的＝該欄沒有篩選（全部顯示）
let HF={},RF={};
function hfActive(state,col){return !!(state[col] && state[col].size);}

// ── 排序狀態（Excel 自動篩選裡的「排序」）──────────────────────────
// RSORT＝業務「我的紀錄」的排序，ASORT＝行政總表的排序，格式 {col:'stockDate',dir:'asc'|'desc'}。
// null＝沒有排序，維持各畫面原本的預設順序。
let RSORT=null, ASORT=null;
function sortStateFor(ctx){ return ctx==='rec'?RSORT:ASORT; }
function setSortState(ctx,v){ if(ctx==='rec')RSORT=v; else ASORT=v; }
const DATE_RE=/^\d{4}-\d{1,2}-\d{1,2}$/;
// 一個欄位裡可能混著日期、數字、文字，所以比較函式要自己判斷型別：
// 日期（yyyy-mm-dd）與純數字用真正的大小比，其餘用中文語系比較（localeCompare 帶 numeric，
// 讓「批號2」排在「批號10」前面）。空白值一律排在最後，不管升冪降冪，
// 因為「沒填」排在最前面通常不是使用者要的結果。
function sortCompare(col,dir){
  const s=dir==='desc'?-1:1;
  return (a,b)=>{
    const av=(a[col]==null?'':String(a[col]).trim());
    const bv=(b[col]==null?'':String(b[col]).trim());
    if(av===''&&bv==='')return 0;
    if(av==='')return 1;
    if(bv==='')return -1;
    if(!DATE_RE.test(av)&&!DATE_RE.test(bv)){
      const an=Number(av.replace(/,/g,'')), bn=Number(bv.replace(/,/g,''));
      if(av!==''&&bv!==''&&isFinite(an)&&isFinite(bn)&&/^-?[\d,.]+$/.test(av)&&/^-?[\d,.]+$/.test(bv)) return (an-bn)*s;
    }
    return av.localeCompare(bv,'zh-TW',{numeric:true})*s;
  };
}
function sortLabels(col){
  return /Date$/.test(col) ? {asc:'舊 → 新',desc:'新 → 舊'} : {asc:'小 → 大 / A → Z',desc:'大 → 小 / Z → A'};
}
function sortIcon(state,col){
  if(!state||state.col!==col)return '';
  return `<span class="th-sico">${state.dir==='asc'?'▲':'▼'}</span>`;
}
function sortChipHtml(state,ctx){
  if(!state)return '';
  const clear = ctx==='rec' ? 'clearRecSort()' : 'clearAdminSort()';
  return `<span class="af-chip af-sort" onclick="openFilterModal('${ctx}','${state.col}')">排序：${esc(LBL[state.col]||state.col)} ${state.dir==='asc'?'↑':'↓'}<span class="af-x" onclick="event.stopPropagation();${clear}">✕</span></span>`;
}
function clearRecSort(){ RSORT=null; renderMChips(); renderRecHead(); renderRec(); }
function clearAdminSort(){ ASORT=null; renderAChips(); renderGrid(); }

// ── 篩選 Modal：點表頭（電腦版）或「篩選」按鈕（手機版）都會開同一個視窗，
// 左邊選欄位、右邊勾選值，可以切換好幾個欄位設定條件，最後按「確定套用」才會真的套用。
// 改用置中的 Modal（跟站內其他彈窗共用同一套穩定機制），比原本用 JS 算座標浮動在按鈕旁邊的
// 彈出視窗更可靠：不會有位置算錯、跑出畫面外、或在手機上點不到的問題。
let FCTX=null,FSTAGE=null,FFIELD=null,FSORT=null;
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
  // 品項欄依全系統固定順序，其他欄位仍依出現次數多寡排序
  if(col==='item') arr.sort((a,b)=>{ if(a[0]==='')return 1; if(b[0]==='')return -1; return byItemOrder(a[0],b[0]); });
  else arr.sort((a,b)=>{ if(a[0]==='')return 1; if(b[0]==='')return -1; return b[1]-a[1]; });
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
  const curSort=sortStateFor(ctx);
  FSORT=curSort?{col:curSort.col,dir:curSort.dir}:null;
  FFIELD=field||COLS[0].k;
  document.getElementById('filterModalTitle').textContent = ctx==='admin' ? '篩選 · 行政總表' : '篩選 · 我的紀錄';
  document.getElementById('filterValueSearch').value='';
  renderFilterModal();
  document.getElementById('filterMv').classList.add('on');
}
function closeFilterModal(){ document.getElementById('filterMv').classList.remove('on'); FCTX=null;FSTAGE=null;FFIELD=null;FSORT=null; }
function renderFilterModal(){
  document.getElementById('filterFieldList').innerHTML=COLS.map(c=>{
    const active=FSTAGE[c.k]&&FSTAGE[c.k].size;
    return `<div class="ff-it ${FFIELD===c.k?'on':''}" onclick="selectFilterField('${c.k}')">${c.n}${active?'<span class="ff-dot"></span>':''}</div>`;
  }).join('');
  renderFilterSortBar();
  renderFilterValueList();
}
// 排序區塊：跟 Excel 的自動篩選一樣，點欄位後上方就能直接選由小到大／由大到小。
// 整份清單同時只會有一個排序欄位（跟 Excel 一致），選了新的就會取代舊的。
function renderFilterSortBar(){
  const bar=document.getElementById('filterSortBar'); if(!bar)return;
  const col=FFIELD; const c=COLS.find(x=>x.k===col)||{n:''};
  const cur=(FSORT&&FSORT.col===col)?FSORT.dir:'';
  const lb=sortLabels(col);
  bar.innerHTML=`<span class="fs-lb">排序 · ${esc(c.n)}</span>`+
    `<button type="button" class="${cur==='asc'?'on':''}" onclick="setFilterSort('asc')">↑ ${lb.asc}</button>`+
    `<button type="button" class="${cur==='desc'?'on':''}" onclick="setFilterSort('desc')">↓ ${lb.desc}</button>`+
    (FSORT?`<button type="button" class="fs-clear" onclick="setFilterSort('')">清除排序${FSORT.col!==col?`（目前：${esc(LBL[FSORT.col]||'')}）`:''}</button>`:'');
}
function setFilterSort(dir){ FSORT=dir?{col:FFIELD,dir:dir}:null; renderFilterModal(); }
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
function resetAllFilters(){ FSTAGE={}; FSORT=null; renderFilterModal(); }
function applyFilterModal(){
  const state=filterStateFor(FCTX);
  Object.keys(state).forEach(k=>delete state[k]);
  Object.keys(FSTAGE).forEach(k=>{ if(FSTAGE[k]&&FSTAGE[k].size) state[k]=new Set(FSTAGE[k]); });
  setSortState(FCTX, FSORT?{col:FSORT.col,dir:FSORT.dir}:null);
  if(FCTX==='admin'){ renderAChips();renderGridAsync(); } else { renderMChips();renderRecHead(); renderRec(); }
  closeFilterModal();
}
function clearAdminFilter(which){
  if(which==='sales')ASales=''; else AItem='';
  renderAChips();renderGrid();
}
function tglEmpty(k){AEmpty.has(k)?AEmpty.delete(k):AEmpty.add(k);renderAChips();renderGridDebounced();}
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
function renderGridAsync(){ renderGridDebounced(); }
function renderGrid(){
  GRID=gridRows();
  // 有填「借出單」的資料，依借出單分組排在一起（組內再依備貨日期/品項/業務排序）；
  // 沒有借出單的資料維持原本排序邏輯，統一排在最後。
  if(ASORT){
    GRID.sort(sortCompare(ASORT.col,ASORT.dir));
  }else
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
  DIFF_CTX='admin';
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
    queueAdminSync(); 
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
    queueAdminSync(); 
  }else{
    addLog({act:'快速建立',ok:false,desc:`嘗試為${who}建立 ${AQ} 筆「${item}」`,err:res.message||'未知錯誤',src:'行政端網頁'});
    renderALog();toast('建立失敗',true);
    busy(btn,false);
  }}
function setLogF(f){LOGF=f;document.getElementById('lgAll').classList.toggle('on',f==='all');
  document.getElementById('lgFail').classList.toggle('on',f==='fail');renderALog();}
