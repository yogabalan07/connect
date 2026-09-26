import { createStore, useStore } from './store';

export interface ToastItem {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

/**
 * Toast queue lives outside React so services and auth flows can announce
 * results without depending on the app context.
 */
const store = createStore<ToastItem[]>([]);

let counter = 0;

export const toastStore = {
  store,

  add(message: string, type: ToastItem['type'] = 'success'): string {
    counter += 1;
    const id = `toast-${Date.now()}-${counter}`;
    store.set(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      store.set(prev => prev.filter(t => t.id !== id));
    }, 4000);
    return id;
  },

  remove(id: string): void {
    store.set(prev => prev.filter(t => t.id !== id));
  }
};
