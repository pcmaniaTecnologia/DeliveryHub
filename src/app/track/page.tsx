"use client";

export const dynamic = "force-dynamic";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🔥 Configuração usando variáveis de ambiente
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
};

// ✅ Inicializa apenas se ainda não existir
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Serviços
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

// ✅ Hooks auxiliares (opcional, se você usa useFirestore)
export const useFirestore = () => firestore;
export const useAuth = () => auth;

export default app;
