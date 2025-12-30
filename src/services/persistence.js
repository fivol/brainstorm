import { reaction, toJS } from 'mobx';

const STORAGE_KEY = 'brainstorm-graph';
const VIEW_KEY = 'brainstorm-view';

/**
 * Persistence service for auto-saving and restoring graph state.
 */
export class PersistenceService {
  graphStore = null;
  uiStore = null;
  disposeReaction = null;
  saveTimeout = null;
  
  constructor(graphStore, uiStore) {
    this.graphStore = graphStore;
    this.uiStore = uiStore;
  }

  /**
   * Start auto-persistence.
   */
  start() {
    // Load saved state
    this.load();
    
    // Set up auto-save on changes
    this.disposeReaction = reaction(
      () => ({
        nodes: Array.from(this.graphStore.nodes.values()).map(n => ({
          id: n.id,
          text: n.text,
          x: n.x,
          y: n.y,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt
        })),
        edges: Array.from(this.graphStore.edges.values()).map(e => ({
          id: e.id,
          sourceId: e.sourceId,
          targetId: e.targetId,
          label: e.label
        }))
      }),
      () => this.debouncedSave(),
      { delay: 500 }
    );
    
    // Also save view state changes
    reaction(
      () => ({ ...this.uiStore.view }),
      () => this.saveViewState(),
      { delay: 1000 }
    );
  }

  /**
   * Stop auto-persistence.
   */
  stop() {
    if (this.disposeReaction) {
      this.disposeReaction();
      this.disposeReaction = null;
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }

  /**
   * Debounced save to localStorage.
   */
  debouncedSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => this.save(), 300);
  }

  /**
   * Save graph state to localStorage.
   */
  save() {
    try {
      const data = this.graphStore.toJSON(true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save graph state:', e);
    }
  }

  /**
   * Save view state to localStorage.
   */
  saveViewState() {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(this.uiStore.view));
    } catch (e) {
      console.warn('Failed to save view state:', e);
    }
  }

  /**
   * Load graph state from localStorage.
   */
  load() {
    try {
      // Load graph data
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const data = JSON.parse(savedData);
        this.graphStore.loadFromData(data);
      }
      
      // Load view state
      const savedView = localStorage.getItem(VIEW_KEY);
      if (savedView) {
        const view = JSON.parse(savedView);
        this.uiStore.setViewTransform(view);
      }
    } catch (e) {
      console.warn('Failed to load saved state:', e);
    }
  }

  /**
   * Clear all saved state.
   */
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(VIEW_KEY);
    } catch (e) {
      console.warn('Failed to clear saved state:', e);
    }
  }
}

export default PersistenceService;
