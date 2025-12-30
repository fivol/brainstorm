import { graphStore } from './GraphStore';
import { uiStore } from './UIStore';
import { undoStore } from './UndoStore';

// Wire up store references
graphStore.setUndoStore(undoStore);
graphStore.setUIStore(uiStore);
uiStore.setGraphStore(graphStore);
undoStore.setGraphStore(graphStore);
undoStore.setUIStore(uiStore);

export { graphStore, uiStore, undoStore };

// Export store context for React
import { createContext, useContext } from 'react';

export const StoreContext = createContext({
  graphStore,
  uiStore,
  undoStore
});

export function useStores() {
  return useContext(StoreContext);
}

export function useGraphStore() {
  return useContext(StoreContext).graphStore;
}

export function useUIStore() {
  return useContext(StoreContext).uiStore;
}

export function useUndoStore() {
  return useContext(StoreContext).undoStore;
}
