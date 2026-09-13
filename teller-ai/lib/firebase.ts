import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAV2Yhh76p98qUEMpTbhJGNq1aNx7OBnno",
  authDomain: "spacetellerai.firebaseapp.com",
  projectId: "spacetellerai",
  storageBucket: "spacetellerai.firebasestorage.app",
  messagingSenderId: "485273454211",
  appId: "1:485273454211:web:902c1dc0a5d2fb5e1d3db6",
  measurementId: "G-GH1ZBKB6SX",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined" || !(await isSupported())) return null;
  return getAnalytics(firebaseApp);
}
