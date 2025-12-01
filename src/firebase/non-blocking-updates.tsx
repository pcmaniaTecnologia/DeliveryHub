'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

/**
 * Performs a setDoc operation. Can be awaited or not.
 * Emits a contextual permission error on failure.
 */
export function setDocument(docRef: DocumentReference, data: any, options?: SetOptions) {
  const promise = setDoc(docRef, data, options || {}).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: options && 'merge' in options ? 'update' : 'create',
        requestResourceData: data,
      })
    );
    // Re-throw the error so that awaiting this function catches the failure
    throw error;
  });
  return promise;
}


/**
 * Performs an addDoc operation. Can be awaited or not.
 * Emits a contextual permission error on failure.
 */
export function addDocument(colRef: CollectionReference, data: any) {
  const promise = addDoc(colRef, data)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: data,
        })
      );
      throw error;
    });
  return promise;
}


/**
 * Performs an updateDoc operation. Can be awaited or not.
 * Emits a contextual permission error on failure.
 */
export function updateDocument(docRef: DocumentReference, data: any) {
  const promise = updateDoc(docRef, data)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: data,
        })
      );
      throw error;
    });
  return promise;
}


/**
 * Performs a deleteDoc operation. Can be awaited or not.
 * Emits a contextual permission error on failure.
 */
export function deleteDocument(docRef: DocumentReference) {
  const promise = deleteDoc(docRef)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      );
      throw error;
    });
  return promise;
}

// Keep aliases for backward compatibility if needed, but new code should use the new names.
/** @deprecated Use `setDocument` instead. */
export const setDocumentNonBlocking = setDocument;
/** @deprecated Use `addDocument` instead. */
export const addDocumentNonBlocking = addDocument;
/** @deprecated Use `updateDocument` instead. */
export const updateDocumentNonBlocking = updateDocument;
/** @deprecated Use `deleteDocument` instead. */
export const deleteDocumentNonBlocking = deleteDocument;
