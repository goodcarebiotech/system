// Firebase Google 登入 — 只負責「驗證身分」，實際角色（業務／行政／主管）由 ROSTERS 名冊
// 依登入信箱自動判斷，詳見主程式區塊的 rolesForEmail() / handleAuthedUser()。
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, indexedDBLocalPersistence }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGxj07Uk6fYC1rTxeeOA8Eu0wuo2uLKWc",
  authDomain: "goodcare-c4cd3.firebaseapp.com",
  projectId: "goodcare-c4cd3",
  storageBucket: "goodcare-c4cd3.firebasestorage.app",
  messagingSenderId: "724074270065",
  appId: "1:724074270065:web:c92ef0b92eb940cda2fad0",
  measurementId: "G-VLFVY59B5M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ───────────────────────────────────────────────────────────────
// 【手機「登出後再登入會跳 400 malformed」的修正】
//
// 原本這裡是在模組載入時建立「一個」GoogleAuthProvider，然後整個網頁生命週期重複使用它：
//
//     const provider = new GoogleAuthProvider();
//     provider.setCustomParameters({ prompt: 'select_account' });
//
// 這個 provider 物件是有狀態的。第一次登入時 Firebase 會在它身上留下這次登入用的參數
// （scope、customParameters、以及內部組 OAuth 請求用的欄位）。登出之後再按一次登入，
// Firebase 會拿「同一個已經被用過的 provider」再組一次 OAuth 請求網址，
// 於是 prompt / login_hint / state 這些參數有機會被重複附加、或帶著殘留的舊值，
// 送到 Google 之後就是一個格式不合法的網址 —— Google 不會說明哪裡錯，只會回一頁
// 「400. That's an error. The server cannot process the request because it is malformed.」
// 正是手機上「選好帳號之後」看到的那一頁。
//
// 修法：不再共用單例，改成每次要登入時「現做一個全新的 provider」（makeProvider()），
// 每次 OAuth 請求都從乾淨狀態組起來，不會累積上一次的殘留參數。
//
// 另外提供 clearAuthResidue()：登出時把 Firebase 留在瀏覽器裡的登入狀態
// （IndexedDB 的 firebaseLocalStorageDb、以及 localStorage / sessionStorage 內
// firebase:authUser 開頭的鍵）一併清乾淨。手機瀏覽器常見狀況是 signOut() 已經回來了、
// 但底層 IndexedDB 還留著半份舊 session，下一次登入就會拿著這份殘骸去組請求。
// ───────────────────────────────────────────────────────────────
function makeProvider() {
  const p = new GoogleAuthProvider();
  // 每次都要求 Google 顯示帳號選擇畫面，避免手機上被靜默沿用舊帳號、想換帳號卻換不掉。
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

// 【重要修正】這支函式原本會刪掉 IndexedDB 的 firebaseLocalStorageDb，
// 以及 localStorage 裡 firebase:authUser 開頭的鍵。實測發現這是個錯誤的做法：
// Firebase Auth 在執行期間一直握著那個資料庫的連線，從外面把它砍掉會讓 SDK 的
// 內部狀態變成半毀，下一次 signInWithPopup 就會丟出
//   "Unable to process request due to missing initial state..."
// 也就是登出後再登入完全登不進去。
//
// 400 malformed 的真正解法是另外兩件事：每次登入都用全新的 provider（makeProvider），
// 以及登出時確實 await signOut()。清資料庫原本只是多餘的保險，結果保險本身變成故障點。
//
// 現在這支函式只清除「redirect 流程留下來的孤兒鍵」——那是舊版用 signInWithRedirect
// 時代的殘骸，現行的彈窗流程根本不會用到，刪掉不會影響任何進行中的登入狀態。
// 登入狀態本身一律交給 signOut() 依 SDK 正規流程處理。
async function clearAuthResidue() {
  try {
    [localStorage, sessionStorage].forEach(store => {
      if (!store) return;
      const kill = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        // 只動 redirect 的殘留，絕不碰 firebase:authUser 與 IndexedDB
        if (k && (k.indexOf('firebase:redirectEvent') === 0 || k.indexOf('firebase:pendingRedirect') === 0)) kill.push(k);
      }
      kill.forEach(k => store.removeItem(k));
    });
  } catch (e) { /* 隱私模式下 storage 可能整個被停用，忽略即可 */ }
}

window.__fb = { auth, makeProvider, clearAuthResidue, signInWithPopup, signOut, onAuthStateChanged };

// ───────────────────────────────────────────────────────────────
// 【為什麼不用 signInWithRedirect】
// redirect 流程會先把「登入中繼狀態」寫進 sessionStorage，整頁跳去 Google 再跳回來。
// iOS Safari／Android 無痕模式會清掉或隔離 sessionStorage，現代瀏覽器的 storage
// partitioning 也會讓跳轉回來後讀不到那份狀態，Firebase 就丟出
// "Unable to process request due to missing initial state..."。
// 彈窗登入全程都在同一個分頁、同一個 session 裡完成，不受這個限制影響，故一律使用彈窗。
//
// 登入狀態的保存優先用 indexedDB（手機瀏覽器上比 localStorage 穩定，
// 在部分隱私設定下 localStorage 會被停用），失敗才退回 localStorage。
// ───────────────────────────────────────────────────────────────
window.__fb.persistenceReady = setPersistence(auth, indexedDBLocalPersistence)
  .catch(() => setPersistence(auth, browserLocalPersistence))
  .catch(() => {});

window.__fb.persistenceReady.then(() => {
  window.dispatchEvent(new Event('firebase-ready'));
});
