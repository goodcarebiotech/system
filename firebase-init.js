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

// 每次登入都強制跳出帳號選擇畫面，避免手機上「已經登入過某個 Google 帳號」時
// 直接靜默用舊帳號登入，使用者想換帳號卻換不掉。
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

window.__fb = { auth, provider, signInWithPopup, signOut, onAuthStateChanged };

// ───────────────────────────────────────────────────────────────
// 【手機登入問題的修正】
// 原本這裡用的是 signInWithRedirect + getRedirectResult：按下登入後整頁導去 Google，
// 登入完再整頁導回來，回來後呼叫 getRedirectResult() 讀「剛剛登入的結果」。
// 這個流程依賴 sessionStorage 保存一份「登入中繼狀態」，但是：
//   ・iOS Safari／Android 無痕模式會清掉或隔離 sessionStorage
//   ・現代瀏覽器的 storage partitioning（儲存空間分區）會讓跳轉回來後讀不到原本那份狀態
// 只要讀不到，Firebase 就會丟出：
//   "Unable to process request due to missing initial state..."
// 也就是你在手機上看到的那個錯誤。
//
// 修法：完全不使用 redirect 流程，改為一律使用 signInWithPopup（見 app.js googleSignIn）。
// 彈窗登入全程都在同一個分頁、同一個 session 裡完成，不需要任何跨頁跳轉的中繼狀態，
// 因此不受上述限制影響。這裡也連帶把 getRedirectResult 整個拿掉，
// 因為只要頁面載入時呼叫它，就有可能在儲存空間被隔離的環境下拋出同一個錯誤。
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
