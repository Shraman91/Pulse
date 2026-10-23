import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";

function cleanEnv(val: string | undefined): string | undefined {
  if (!val) return undefined;
  return val.replace(/^["']|["']$/g, "").trim();
}

const firebaseConfig = {
  apiKey: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) || "AIzaSyMockKeyForDevOnly12345",
  authDomain: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) || "pulse-dev.firebaseapp.com",
  projectId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || "pulse-dev",
  storageBucket: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) || "pulse-dev.appspot.com",
  messagingSenderId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) || "1234567890",
  appId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) || "1:1234567890:web:abcdef123456",
};

// Initialize Firebase only on client or if not already initialized
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = typeof window !== "undefined" ? getAuth(app) : (null as unknown as ReturnType<typeof getAuth>);

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export { app, auth, googleProvider, githubProvider };
