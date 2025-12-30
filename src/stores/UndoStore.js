import { makeAutoObservable, action } from 'mobx';
import { ActionType } from '../types';

/**
 * Store for undo/redo functionality.
 */
class UndoStore {
  /** Undo stack */
  undoStack = [];
  
  /** Redo stack */
  redoStack = [];
  
  /** Maximum history depth */
  maxDepth = 20;
  
  /** Reference to graph store */
  graphStore = null;
  
  /** Reference to UI store */
  uiStore = null;
  
  /** Flag to prevent recording during undo/redo */
  isApplying = false;

  constructor() {
    makeAutoObservable(this, {
      graphStore: false,
      uiStore: false,
      setGraphStore: action,
      setUIStore: action
    });
  }

  setGraphStore(store) {
    this.graphStore = store;
  }

  setUIStore(store) {
    this.uiStore = store;
  }

  /**
   * Push an action to the undo stack.
   * @param {import('../types').UndoAction} undoAction
   */
  push(undoAction) {
    if (this.isApplying) return;
    
    this.undoStack.push(undoAction);
    
    // Clear redo stack on new action
    this.redoStack = [];
    
    // Limit stack size
    while (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
  }

  /**
   * Check if undo is available.
   * @returns {boolean}
   */
  get canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available.
   * @returns {boolean}
   */
  get canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Undo the last action.
   */
  undo() {
    if (!this.canUndo || !this.graphStore) return;
    
    const undoAction = this.undoStack.pop();
    this.isApplying = true;
    
    try {
      this.applyUndo(undoAction);
      this.redoStack.push(undoAction);
      
      if (this.uiStore) {
        this.uiStore.info('Undo applied');
      }
    } catch (e) {
      console.error('Undo failed:', e);
      if (this.uiStore) {
        this.uiStore.error('Undo failed');
      }
    } finally {
      this.isApplying = false;
    }
  }

  /**
   * Redo the last undone action.
   */
  redo() {
    if (!this.canRedo || !this.graphStore) return;
    
    const redoAction = this.redoStack.pop();
    this.isApplying = true;
    
    try {
      this.applyRedo(redoAction);
      this.undoStack.push(redoAction);
      
      if (this.uiStore) {
        this.uiStore.info('Redo applied');
      }
    } catch (e) {
      console.error('Redo failed:', e);
      if (this.uiStore) {
        this.uiStore.error('Redo failed');
      }
    } finally {
      this.isApplying = false;
    }
  }

  /**
   * Apply an undo action.
   * @param {import('../types').UndoAction} undoAction
   */
  applyUndo(undoAction) {
    const { type, data, reverseData } = undoAction;
    
    switch (type) {
      case ActionType.CREATE_NODE:
        // Undo create = delete
        this.graphStore.deleteNode(data.nodeId, false);
        break;
        
      case ActionType.DELETE_NODE:
        // Undo delete = recreate node and edges
        this.graphStore.createNode(data.node, false);
        for (const edge of data.edges) {
          this.graphStore.edges.set(edge.id, { ...edge });
        }
        break;
        
      case ActionType.MOVE_NODE:
        // Undo move = restore old position
        this.graphStore.moveNode(data.nodeId, data.oldX, data.oldY, false);
        break;
        
      case ActionType.EDIT_NODE_TEXT:
        // Undo text edit = restore old text
        this.graphStore.updateNodeText(data.nodeId, data.oldText, false);
        break;
        
      case ActionType.CREATE_EDGE:
        // Undo create edge = delete
        this.graphStore.deleteEdge(data.edgeId, false);
        break;
        
      case ActionType.DELETE_EDGE:
        // Undo delete edge = recreate
        this.graphStore.edges.set(data.edge.id, { ...data.edge });
        break;
        
      case ActionType.EDIT_EDGE_LABEL:
        // Undo label edit = restore old label
        this.graphStore.updateEdgeLabel(data.edgeId, data.oldLabel, false);
        break;
        
      case ActionType.BATCH:
        // Undo batch = undo all actions in reverse order
        for (let i = data.actions.length - 1; i >= 0; i--) {
          this.applyUndo(data.actions[i]);
        }
        break;
    }
  }

  /**
   * Apply a redo action.
   * @param {import('../types').UndoAction} undoAction
   */
  applyRedo(undoAction) {
    const { type, reverseData } = undoAction;
    
    switch (type) {
      case ActionType.CREATE_NODE:
        // Redo create = create again
        this.graphStore.createNode(undoAction.reverseData.node, false);
        break;
        
      case ActionType.DELETE_NODE:
        // Redo delete = delete again
        this.graphStore.deleteNode(reverseData.nodeId, false);
        break;
        
      case ActionType.MOVE_NODE:
        // Redo move = apply new position
        this.graphStore.moveNode(reverseData.nodeId, reverseData.newX, reverseData.newY, false);
        break;
        
      case ActionType.EDIT_NODE_TEXT:
        // Redo text edit = apply new text
        this.graphStore.updateNodeText(reverseData.nodeId, reverseData.newText, false);
        break;
        
      case ActionType.CREATE_EDGE:
        // Redo create edge = create again
        this.graphStore.edges.set(undoAction.reverseData.edge.id, { ...undoAction.reverseData.edge });
        break;
        
      case ActionType.DELETE_EDGE:
        // Redo delete edge = delete again
        this.graphStore.deleteEdge(reverseData.edgeId, false);
        break;
        
      case ActionType.EDIT_EDGE_LABEL:
        // Redo label edit = apply new label
        this.graphStore.updateEdgeLabel(reverseData.edgeId, reverseData.newLabel, false);
        break;
        
      case ActionType.BATCH:
        // Redo batch = redo all actions in order
        for (const action of undoAction.data.actions) {
          this.applyRedo(action);
        }
        break;
    }
  }

  /**
   * Clear all history.
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export const undoStore = new UndoStore();
export default undoStore;
