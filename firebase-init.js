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
  setPersistence(auth, browserLocalPersistence).catch(()=>{}); // 常駐登入，關掉分頁下次回來不用重登

  window.__fb = {
    auth, provider: new GoogleAuthProvider(),
    signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged
  };
  window.__fb.redirectResultPromise = getRedirectResult(auth);
  window.dispatchEvent(new Event('firebase-ready'));
