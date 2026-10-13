'use client';

import { onSnapshot, refEqual, type DocumentData, type DocumentReference, type DocumentSnapshot, type FirestoreError } from 'firebase/firestore';

type Subscriber = {
  next: (snapshot: DocumentSnapshot<DocumentData>) => void;
  error: (error: FirestoreError) => void;
};
type Entry = {
  ref: DocumentReference<DocumentData>;
  subscribers: Set<Subscriber>;
  snapshot?: DocumentSnapshot<DocumentData>;
  error?: FirestoreError;
  stop: () => void;
  cleanup?: ReturnType<typeof setTimeout>;
};
const entries = new Set<Entry>();

// Company/profile documents are consumed by several components simultaneously.
// Share their subscription, but release it immediately when no longer used.
export function subscribeToDocument(target: DocumentReference<DocumentData>, next: Subscriber['next'], error: Subscriber['error']) {
  let entry = Array.from(entries).find(candidate => refEqual(candidate.ref, target));
  const subscriber = { next, error };
  if (!entry) {
    entry = { ref: target, subscribers: new Set(), stop: () => {} };
    entries.add(entry);
    const current = entry;
    current.stop = onSnapshot(target, snapshot => {
      current.snapshot = snapshot;
      current.error = undefined;
      current.subscribers.forEach(listener => listener.next(snapshot));
    }, failure => {
      current.error = failure;
      current.snapshot = undefined;
      current.subscribers.forEach(listener => listener.error(failure));
    });
  }
  const current = entry;
  if (current.cleanup !== undefined) clearTimeout(current.cleanup);
  current.subscribers.add(subscriber);
  if (current.snapshot) next(current.snapshot);
  if (current.error) error(current.error);
  return () => {
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      current.cleanup = setTimeout(() => {
        current.stop();
        entries.delete(current);
      }, 0);
    }
  };
}
