// Firebase Google 登入 — 只負責「驗證身分」，實際角色（業務／行政／主管）由 ROSTERS 名冊
  // 依登入信箱自動判斷，詳見主程式區塊的 rolesForEmail() / handleAuthedUser()。
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
  import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence }
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

  window.__fb = {
    auth, provider: new GoogleAuthProvider(),
    signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged
  };
  // 手機版走的是 signInWithRedirect，流程是：按登入 → 整頁導去 Google → 登入完再整頁導回來，
  // 導回來後這支檔案會「重新」從頭載入一次，這時候一定要先確定 browserLocalPersistence
  // 設定完成，才能呼叫 getRedirectResult() 去讀「剛剛登入的結果」。
  // 原本 setPersistence(...) 沒有 await，跟 getRedirectResult(auth) 是同時（race）執行，
  // 手機瀏覽器讀取 IndexedDB／localStorage 通常比電腦慢，很容易發生
  // getRedirectResult() 搶先跑完、卻還讀不到登入結果的情況——使用者看起來就是
  // 「登入完又跳回登入畫面，怎麼按都登不進去」，這正是手機版完全登入不了的根因。
  // 修法很單純：等 setPersistence 完成後，再呼叫 getRedirectResult()。
  window.__fb.redirectResultPromise = setPersistence(auth, browserLocalPersistence)
    .catch(()=>{})
    .then(()=>getRedirectResult(auth));
  window.dispatchEvent(new Event('firebase-ready'));
