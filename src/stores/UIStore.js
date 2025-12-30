import { makeAutoObservable, action } from 'mobx';
import { NodeState, ToastType } from '../types';
import { generateId } from '../utils/uuid';

/**
 * Store for UI state: selection, view, toasts, modals.
 */
class UIStore {
  /** Currently active node ID (single selection) */
  activeNodeId = null;
  
  /** Previously selected node ID (for restore on delete) */
  previousNodeId = null;
  
  /** Currently selected edge ID */
  selectedEdgeId = null;
  
  /** Multi-selected node IDs (rectangular selection) */
  multiSelectedIds = new Set();
  
  /** View state (pan/zoom) */
  view = {
    x: 0,
    y: 0,
    scale: 1
  };
  
  /** Toast notifications */
  toasts = [];
  
  /** Maximum visible toasts */
  maxToasts = 3;
  
  /** Help panel visibility */
  helpVisible = false;
  
  /** Edge creation state */
  edgeCreation = {
    active: false,
    sourceId: null,
    cursorX: 0,
    cursorY: 0
  };
  
  /** Rectangular selection state */
  rectSelection = {
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0
  };
  
  /** Node being dragged */
  draggingNodeId = null;
  
  /** Reference to graph store */
  graphStore = null;

  constructor() {
    makeAutoObservable(this, {
      graphStore: false,
      setGraphStore: action
    });
  }

  setGraphStore(store) {
    this.graphStore = store;
  }

  // ============== Node Selection ==============

  /**
   * Set active node.
   * @param {string | null} nodeId
   */
  setActiveNode(nodeId) {
    // Deactivate previous node and check if empty
    if (this.activeNodeId && this.graphStore) {
      const prevNode = this.graphStore.getNode(this.activeNodeId);
      if (prevNode) {
        // Check if node is empty and should be deleted (on deselection)
        if (prevNode.state === NodeState.EDITABLE && !prevNode.text?.trim()) {
          this.graphStore.deleteNode(this.activeNodeId, false);
        } else if (prevNode.state !== NodeState.MULTI_SELECTED) {
          this.graphStore.setNodeState(this.activeNodeId, NodeState.INACTIVE);
        }
      }
    }
    
    // Track previous node for restore on delete
    if (this.activeNodeId && nodeId !== this.activeNodeId) {
      this.previousNodeId = this.activeNodeId;
    }
    
    this.activeNodeId = nodeId;
    this.selectedEdgeId = null;
    this.clearMultiSelection();
    
    // Activate new node
    if (nodeId && this.graphStore) {
      this.graphStore.setNodeState(nodeId, NodeState.ACTIVE);
    }
  }

  /**
   * Set node to editable state.
   * @param {string} nodeId
   */
  setEditableNode(nodeId) {
    if (this.graphStore) {
      this.graphStore.setNodeState(nodeId, NodeState.EDITABLE);
    }
    this.activeNodeId = nodeId;
  }

  /**
   * Exit editable mode, return to active.
   * @param {string} nodeId
   */
  exitEditable(nodeId) {
    if (this.graphStore) {
      this.graphStore.setNodeState(nodeId, NodeState.ACTIVE);
    }
  }

  /**
   * Clear all selection.
   */
  clearSelection() {
    if (this.activeNodeId && this.graphStore) {
      const node = this.graphStore.getNode(this.activeNodeId);
      // Check if node is empty and should be deleted (on deselection)
      if (node && node.state === NodeState.EDITABLE && !node.text?.trim()) {
        this.graphStore.deleteNode(this.activeNodeId, false);
      } else if (node) {
        this.graphStore.setNodeState(this.activeNodeId, NodeState.INACTIVE);
      }
    }
    this.activeNodeId = null;
    this.selectedEdgeId = null;
    this.clearMultiSelection();
  }
  
  /**
   * Get previous node ID for restore on delete.
   * @returns {string | null}
   */
  getPreviousNodeId() {
    return this.previousNodeId;
  }
  
  /**
   * Clear previous node tracking.
   */
  clearPreviousNode() {
    this.previousNodeId = null;
  }

  // ============== Multi Selection ==============

  /**
   * Add node to multi-selection.
   * @param {string} nodeId
   */
  addToMultiSelection(nodeId) {
    this.multiSelectedIds.add(nodeId);
    if (this.graphStore) {
      this.graphStore.setNodeState(nodeId, NodeState.MULTI_SELECTED);
    }
  }

  /**
   * Set multi-selection from array.
   * @param {string[]} nodeIds
   */
  setMultiSelection(nodeIds) {
    this.clearMultiSelection();
    for (const id of nodeIds) {
      this.addToMultiSelection(id);
    }
  }

  /**
   * Clear multi-selection.
   */
  clearMultiSelection() {
    for (const id of this.multiSelectedIds) {
      if (this.graphStore) {
        const node = this.graphStore.getNode(id);
        if (node && node.state === NodeState.MULTI_SELECTED) {
          this.graphStore.setNodeState(id, NodeState.INACTIVE);
        }
      }
    }
    this.multiSelectedIds.clear();
  }

  /**
   * Get all selected node IDs (active + multi).
   * @returns {string[]}
   */
  getSelectedNodeIds() {
    const ids = Array.from(this.multiSelectedIds);
    if (this.activeNodeId && !ids.includes(this.activeNodeId)) {
      ids.push(this.activeNodeId);
    }
    return ids;
  }

  // ============== Edge Selection ==============

  /**
   * Set selected edge.
   * @param {string | null} edgeId
   */
  setSelectedEdge(edgeId) {
    this.selectedEdgeId = edgeId;
    if (edgeId) {
      this.clearSelection();
      this.selectedEdgeId = edgeId;
    }
  }

  // ============== View State ==============

  /**
   * Set view position (pan).
   * @param {number} x
   * @param {number} y
   */
  setViewPosition(x, y) {
    this.view.x = x;
    this.view.y = y;
  }

  /**
   * Set zoom scale.
   * @param {number} scale
   */
  setViewScale(scale) {
    this.view.scale = Math.max(0.1, Math.min(4, scale));
  }

  /**
   * Update view transform.
   * @param {Object} transform
   */
  setViewTransform(transform) {
    if (transform.x !== undefined) this.view.x = transform.x;
    if (transform.y !== undefined) this.view.y = transform.y;
    if (transform.scale !== undefined) {
      this.view.scale = Math.max(0.1, Math.min(4, transform.scale));
    }
  }

  // ============== Edge Creation ==============

  /**
   * Start edge creation from a node.
   * @param {string} sourceId
   */
  startEdgeCreation(sourceId) {
    this.edgeCreation.active = true;
    this.edgeCreation.sourceId = sourceId;
  }

  /**
   * Update edge creation cursor position.
   * @param {number} x
   * @param {number} y
   */
  updateEdgeCreation(x, y) {
    this.edgeCreation.cursorX = x;
    this.edgeCreation.cursorY = y;
  }

  /**
   * Cancel edge creation.
   */
  cancelEdgeCreation() {
    this.edgeCreation.active = false;
    this.edgeCreation.sourceId = null;
  }

  // ============== Rectangular Selection ==============

  /**
   * Start rectangular selection.
   * @param {number} x
   * @param {number} y
   */
  startRectSelection(x, y) {
    this.rectSelection.active = true;
    this.rectSelection.startX = x;
    this.rectSelection.startY = y;
    this.rectSelection.endX = x;
    this.rectSelection.endY = y;
  }

  /**
   * Update rectangular selection.
   * @param {number} x
   * @param {number} y
   */
  updateRectSelection(x, y) {
    this.rectSelection.endX = x;
    this.rectSelection.endY = y;
  }

  /**
   * End rectangular selection.
   */
  endRectSelection() {
    this.rectSelection.active = false;
  }

  /**
   * Get rectangle bounds.
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  getRectSelectionBounds() {
    const { startX, startY, endX, endY } = this.rectSelection;
    return {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY)
    };
  }

  // ============== Drag State ==============

  /**
   * Set dragging node.
   * @param {string | null} nodeId
   */
  setDraggingNode(nodeId) {
    this.draggingNodeId = nodeId;
  }

  // ============== Toasts ==============

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {ToastType} [type='info']
   * @param {number} [duration=3000]
   */
  showToast(message, type = ToastType.INFO, duration = 3000) {
    const toast = {
      id: generateId(),
      message,
      type,
      timestamp: Date.now()
    };
    
    this.toasts.push(toast);
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(toast.id);
      }, duration);
    }
  }

  /**
   * Remove a toast.
   * @param {string} toastId
   */
  removeToast(toastId) {
    const index = this.toasts.findIndex(t => t.id === toastId);
    if (index !== -1) {
      this.toasts.splice(index, 1);
    }
  }

  /**
   * Show info toast.
   * @param {string} message
   */
  info(message) {
    this.showToast(message, ToastType.INFO);
  }

  /**
   * Show warning toast.
   * @param {string} message
   */
  warn(message) {
    this.showToast(message, ToastType.WARNING, 5000);
  }

  /**
   * Show error toast.
   * @param {string} message
   */
  error(message) {
    this.showToast(message, ToastType.ERROR, 7000);
  }

  // ============== Help Panel ==============

  toggleHelp() {
    this.helpVisible = !this.helpVisible;
  }

  showHelp() {
    this.helpVisible = true;
  }

  hideHelp() {
    this.helpVisible = false;
  }
}

export const uiStore = new UIStore();
export default uiStore;
