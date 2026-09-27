import { useSyncExternalStore } from 'react';

/**
 * Minimal external store used by the service layer.
 *
 * Services own their state, the UI subscribes through hooks/context.
 * The Firebase adapter feeds the store from Firestore reads and snapshots,
 * without touching any page component.
 */
export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => state,
    set(next) {
      const value =
        typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      listeners.forEach(listener => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

/** React binding for a service store. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/**
 * Lifecycle of a data subscription.
 * Stores start in `loading` and move to `ready` once their first read
 * resolves (or `error` when the adapter rejects).
 */
export type LoadStatus = 'loading' | 'ready' | 'error';
