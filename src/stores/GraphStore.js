import { makeAutoObservable, action, runInAction } from 'mobx';
import { NodeState, ActionType } from '../types';
import { generateId } from '../utils/uuid';
import { measureText } from '../utils/text';

/**
 * Main store for graph data (nodes and edges).
 */
class GraphStore {
  /** @type {Map<string, import('../types').GraphNode>} */
  nodes = new Map();
  
  /** @type {Map<string, import('../types').GraphEdge>} */
  edges = new Map();
  
  /** Reference to undo store (set after initialization) */
  undoStore = null;
  
  /** Reference to UI store (set after initialization) */
  uiStore = null;

  constructor() {
    makeAutoObservable(this, {
      undoStore: false,
      uiStore: false,
      setUndoStore: action,
      setUIStore: action
    });
  }

  setUndoStore(store) {
    this.undoStore = store;
  }

  setUIStore(store) {
    this.uiStore = store;
  }

  // ============== Node Operations ==============

  /**
   * Create a new node.
   * @param {Partial<import('../types').GraphNode>} data
   * @param {boolean} [recordUndo=true]
   * @returns {import('../types').GraphNode}
   */
  createNode(data, recordUndo = true) {
    const id = data.id || generateId();
    const now = Date.now();
    
    // Calculate initial size
    const text = data.text || '';
    const measured = measureText(text, undefined, 200);
    
    const node = {
      id,
      text,
      x: data.x ?? 0,
      y: data.y ?? 0,
      w: Math.max(80, measured.width + 32),
      h: Math.max(40, measured.height + 24),
      state: data.state ?? NodeState.INACTIVE,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
      meta: data.meta ?? {}
    };
    
    this.nodes.set(id, node);
    
    if (recordUndo && this.undoStore) {
      this.undoStore.push({
        type: ActionType.CREATE_NODE,
        data: { nodeId: id },
        reverseData: { node: { ...node } }
      });
    }
    
    return node;
  }

  /**
   * Delete a node and its connected edges.
   * @param {string} nodeId
   * @param {boolean} [recordUndo=true]
   */
  deleteNode(nodeId, recordUndo = true) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // Find connected edges
    const connectedEdges = this.getConnectedEdges(nodeId);
    const edgeSnapshots = connectedEdges.map(e => ({ ...e }));
    
    // Delete edges first
    for (const edge of connectedEdges) {
      this.edges.delete(edge.id);
    }
    
    // Delete node
    this.nodes.delete(nodeId);
    
    if (recordUndo && this.undoStore) {
      this.undoStore.push({
        type: ActionType.DELETE_NODE,
        data: { node: { ...node }, edges: edgeSnapshots },
        reverseData: { nodeId }
      });
    }
  }

  /**
   * Update node position.
   * @param {string} nodeId
   * @param {number} x
   * @param {number} y
   * @param {boolean} [recordUndo=true]
   */
  moveNode(nodeId, x, y, recordUndo = true) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    const oldX = node.x;
    const oldY = node.y;
    
    node.x = x;
    node.y = y;
    node.updatedAt = Date.now();
    
    if (recordUndo && this.undoStore) {
      this.undoStore.push({
        type: ActionType.MOVE_NODE,
        data: { nodeId, oldX, oldY },
        reverseData: { nodeId, newX: x, newY: y }
      });
    }
  }

  /**
   * Update node text.
   * @param {string} nodeId
   * @param {string} text
   * @param {boolean} [recordUndo=true]
   */
  updateNodeText(nodeId, text, recordUndo = true) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    const oldText = node.text;
    node.text = text;
    node.updatedAt = Date.now();
    
    // Recalculate size based on state
    this.recalculateNodeSize(nodeId);
    
    if (recordUndo && this.undoStore && oldText !== text) {
      this.undoStore.push({
        type: ActionType.EDIT_NODE_TEXT,
        data: { nodeId, oldText },
        reverseData: { nodeId, newText: text }
      });
    }
  }

  /**
   * Update node state.
   * @param {string} nodeId
   * @param {NodeState} state
   */
  setNodeState(nodeId, state) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    node.state = state;
    this.recalculateNodeSize(nodeId);
  }

  /**
   * Recalculate node size based on content and state.
   * @param {string} nodeId
   */
  recalculateNodeSize(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    const isExpanded = node.state === NodeState.ACTIVE || node.state === NodeState.EDITABLE;
    const maxWidth = isExpanded ? 400 : 200;
    
    const measured = measureText(node.text, undefined, maxWidth);
    
    // Padding: 16px horizontal, 12px vertical
    node.w = Math.max(80, measured.width + 32);
    node.h = Math.max(40, measured.height + 24);
    
    // For inactive state, limit height to ~3 lines
    if (!isExpanded && measured.lines.length > 3) {
      node.h = 3 * 20 + 24;
    }
  }

  // ============== Edge Operations ==============

  /**
   * Create a new edge.
   * @param {string} sourceId
   * @param {string} targetId
   * @param {string} [label]
   * @param {boolean} [recordUndo=true]
   * @returns {import('../types').GraphEdge | null}
   */
  createEdge(sourceId, targetId, label = '', recordUndo = true) {
    // Don't create self-loops or duplicates
    if (sourceId === targetId) return null;
    if (this.hasEdge(sourceId, targetId)) return null;
    
    const id = generateId();
    const edge = {
      id,
      sourceId,
      targetId,
      label,
      controlPoints: [],
      style: {}
    };
    
    this.edges.set(id, edge);
    
    if (recordUndo && this.undoStore) {
      this.undoStore.push({
        type: ActionType.CREATE_EDGE,
        data: { edgeId: id },
        reverseData: { edge: { ...edge } }
      });
    }
    
    return edge;
  }

  /**
   * Delete an edge.
   * @param {string} edgeId
   * @param {boolean} [recordUndo=true]
   */
  deleteEdge(edgeId, recordUndo = true) {
    const edge = this.edges.get(edgeId);
    if (!edge) return;
    
    this.edges.delete(edgeId);
    
    if (recordUndo && this.undoStore) {
      this.undoStore.push({
        type: ActionType.DELETE_EDGE,
        data: { edge: { ...edge } },
        reverseData: { edgeId }
      });
    }
  }

  /**
   * Update edge label.
   * @param {string} edgeId
   * @param {string} label
   * @param {boolean} [recordUndo=true]
   */
  updateEdgeLabel(edgeId, label, recordUndo = true) {
    const edge = this.edges.get(edgeId);
    if (!edge) return;
    
    const oldLabel = edge.label;
    edge.label = label;
    
    if (recordUndo && this.undoStore && oldLabel !== label) {
      this.undoStore.push({
        type: ActionType.EDIT_EDGE_LABEL,
        data: { edgeId, oldLabel },
        reverseData: { edgeId, newLabel: label }
      });
    }
  }

  // ============== Queries ==============

  /**
   * Check if an edge exists between two nodes.
   * @param {string} sourceId
   * @param {string} targetId
   * @returns {boolean}
   */
  hasEdge(sourceId, targetId) {
    for (const edge of this.edges.values()) {
      if (edge.sourceId === sourceId && edge.targetId === targetId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all edges connected to a node.
   * @param {string} nodeId
   * @returns {import('../types').GraphEdge[]}
   */
  getConnectedEdges(nodeId) {
    const result = [];
    for (const edge of this.edges.values()) {
      if (edge.sourceId === nodeId || edge.targetId === nodeId) {
        result.push(edge);
      }
    }
    return result;
  }

  /**
   * Get all nodes connected to a node (neighbors).
   * @param {string} nodeId
   * @returns {import('../types').GraphNode[]}
   */
  getConnectedNodes(nodeId) {
    const connectedIds = new Set();
    for (const edge of this.edges.values()) {
      if (edge.sourceId === nodeId) {
        connectedIds.add(edge.targetId);
      } else if (edge.targetId === nodeId) {
        connectedIds.add(edge.sourceId);
      }
    }
    return Array.from(connectedIds)
      .map(id => this.nodes.get(id))
      .filter(Boolean);
  }

  /**
   * Get node by ID.
   * @param {string} nodeId
   * @returns {import('../types').GraphNode | undefined}
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  /**
   * Get edge by ID.
   * @param {string} edgeId
   * @returns {import('../types').GraphEdge | undefined}
   */
  getEdge(edgeId) {
    return this.edges.get(edgeId);
  }

  /**
   * Get all nodes as array.
   * @returns {import('../types').GraphNode[]}
   */
  getNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges as array.
   * @returns {import('../types').GraphEdge[]}
   */
  getEdges() {
    return Array.from(this.edges.values());
  }

  // ============== Bulk Operations ==============

  /**
   * Clear the entire graph.
   */
  clear() {
    this.nodes.clear();
    this.edges.clear();
    if (this.undoStore) {
      this.undoStore.clear();
    }
  }

  /**
   * Load graph data from serialized format.
   * @param {Object} data - {nodes: [], edges: []}
   */
  loadFromData(data) {
    this.clear();
    
    if (data.nodes) {
      for (const nodeData of data.nodes) {
        this.createNode(nodeData, false);
      }
    }
    
    if (data.edges) {
      for (const edgeData of data.edges) {
        const edge = {
          id: edgeData.id || generateId(),
          sourceId: edgeData.sourceId,
          targetId: edgeData.targetId,
          label: edgeData.label || '',
          controlPoints: edgeData.controlPoints || [],
          style: edgeData.style || {}
        };
        this.edges.set(edge.id, edge);
      }
    }
  }

  /**
   * Export graph data to serializable format.
   * @param {boolean} [includeLayout=true] - Include position data
   * @returns {Object}
   */
  toJSON(includeLayout = true) {
    const nodes = this.getNodes().map(node => {
      const base = {
        id: node.id,
        text: node.text,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt
      };
      if (includeLayout) {
        base.x = node.x;
        base.y = node.y;
      }
      return base;
    });
    
    const edges = this.getEdges().map(edge => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      label: edge.label || undefined
    }));
    
    return { nodes, edges };
  }
}

export const graphStore = new GraphStore();
export default graphStore;
