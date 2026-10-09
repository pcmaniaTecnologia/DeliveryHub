'use client';

import { onSnapshot, queryEqual, type DocumentData, type FirestoreError, type Query, type QuerySnapshot } from 'firebase/firestore';

type Subscriber = {
  next: (snapshot: QuerySnapshot<DocumentData>) => void;
  error: (error: FirestoreError) => void;
};
type Entry = {
  query: Query<DocumentData>;
  subscribers: Set<Subscriber>;
  snapshot?: QuerySnapshot<DocumentData>;
  error?: FirestoreError;
  stop: () => void;
  cleanup?: ReturnType<typeof setTimeout>;
};
const entries = new Set<Entry>();

// Share equivalent queries in this tab, including across a route transition.
// Remove unused listeners on the next tick; never keep idle listeners running.
export function subscribeToQuery(target: Query<DocumentData>, next: Subscriber['next'], error: Subscriber['error']) {
  let entry = Array.from(entries).find(candidate => queryEqual(candidate.query, target));
  const subscriber = { next, error };
  if (!entry) {
    entry = { query: target, subscribers: new Set(), stop: () => {} };
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
