'use client';

import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth';

/**
 * Initiates the Google Sign-In flow using a popup.
 * @param auth - The Firebase Auth instance.
 * @returns A promise that resolves with the user's credentials on successful sign-in.
 */
export async function signInWithGoogle(auth: Auth): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  try {
    const userCredential = await signInWithPopup(auth, provider);
    return userCredential;
  } catch (error) {
    // Handle specific errors or re-throw for the caller to handle.
    console.error('Error during Google Sign-In:', error);
    throw error;
  }
}
