'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Define a type for the services object to handle potential nulls
type FirebaseServices = {
  firebaseApp: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
};

// This function now returns the FirebaseServices object
export function initializeFirebase(): FirebaseServices {
  // Check if essential config values are present.
  // This is crucial for environments like Vercel where env vars are needed.
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    // Return nulls if config is missing. The UI will handle this.
    return { firebaseApp: null, auth: null, firestore: null };
  }

  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

// getSdks should also conform to the FirebaseServices type (without nulls)
export function getSdks(firebaseApp: FirebaseApp): Required<FirebaseServices> {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}


export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
