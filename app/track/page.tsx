"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
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

// ✅ Serviços (NÃO exportar mais)
const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

export default function TrackPage() {
  useEffect(() => {
    console.log("Firebase inicializado:", {
      auth,
      firestore,
      storage,
    });
  }, []);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>Rastreamento de Pedido</h1>
      <p>Página carregada com Firebase inicializado com sucesso.</p>
    </div>
  );
}
