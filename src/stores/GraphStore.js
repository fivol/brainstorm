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
  
  /** Graph title */
  title = '';
  
  /** Reference to undo store (set after initialization) */
  undoStore = null;
  
  /** Reference to UI store (set after initialization) */
  uiStore = null;
  
  // Default size for new nodes (used when creating/empty)
  static DEFAULT_NODE_WIDTH = 160;
  static DEFAULT_NODE_HEIGHT = 44;
  // Minimum width for nodes with text (allows compact nodes)
  static MIN_NODE_WIDTH = 60;
  // Max width for nodes before text wraps
  static MAX_NODE_WIDTH = 280;

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

  // ============== Title ==============

  /**
   * Set graph title.
   * @param {string} title
   */
  setTitle(title) {
    this.title = title;
    // Update document title
    document.title = title ? `BrainStorm: ${title}` : 'BrainStorm';
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
    
    const text = data.text || '';
    
    // If text is provided (e.g., from import), calculate size
    // Otherwise use default size for new empty nodes (all new nodes same size)
    let w, h;
    if (text) {
      const measured = measureText(text, undefined, GraphStore.MAX_NODE_WIDTH);
      w = Math.min(GraphStore.MAX_NODE_WIDTH, Math.max(80, measured.width + 32));
      h = Math.max(40, measured.height + 24);
    } else {
      w = GraphStore.DEFAULT_NODE_WIDTH;
      h = GraphStore.DEFAULT_NODE_HEIGHT;
    }
    
    const node = {
      id,
      text,
      x: data.x ?? 0,
      y: data.y ?? 0,
      w,
      h,
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
    
    // Don't auto-set title here - it's set when node is deselected
    
    if (recordUndo && this.undoStore && oldText !== text) {
      this.undoStore.push({
        type: ActionType.EDIT_NODE_TEXT,
        data: { nodeId, oldText },
        reverseData: { nodeId, newText: text }
      });
    }
  }
  
  /**
   * Auto-set title from first 3 words of earliest node if title is empty.
   * Called when node is deselected, not during typing.
   */
  autoSetTitleFromFirstNode() {
    // Only auto-set if title is empty
    if (this.title) return;
    
    // Find the first (earliest) node by createdAt
    const nodes = this.getNodes();
    if (nodes.length === 0) return;
    
    const firstNode = nodes.reduce((earliest, node) => 
      node.createdAt < earliest.createdAt ? node : earliest
    , nodes[0]);
    
    const text = firstNode.text?.trim();
    if (!text) return;
    
    // Get first 3 words max
    const words = text.split(/\s+/).slice(0, 3).join(' ');
    if (words) {
      this.setTitle(words);
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
    
    const prevState = node.state;
    node.state = state;
    
    const wasEditable = prevState === NodeState.EDITABLE;
    const isExpanded = state === NodeState.ACTIVE || state === NodeState.EDITABLE;
    
    // Recalculate when exiting editable mode (to fit node width to text)
    if (wasEditable) {
      this.recalculateNodeSize(nodeId);
    }
    // Or when entering expanded mode with long text (for proper height)
    else if (isExpanded && node.text?.length > 50) {
      this.recalculateNodeSize(nodeId);
    }
  }

  /**
   * Recalculate node size based on content and state.
   * Node grows horizontally up to MAX_NODE_WIDTH (~6 words), then grows vertically.
   * For editable nodes, height caps at 3 lines max (scrollable after).
   * @param {string} nodeId
   */
  recalculateNodeSize(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    const isEditable = node.state === NodeState.EDITABLE;
    const isActive = node.state === NodeState.ACTIVE;
    const isExpanded = isActive || isEditable;
    
    // If text is empty, use default size
    const text = node.text?.trim() || '';
    if (!text) {
      node.w = GraphStore.DEFAULT_NODE_WIDTH;
      node.h = GraphStore.DEFAULT_NODE_HEIGHT;
      return;
    }
    
    // Always use MAX_NODE_WIDTH as the limit - nodes grow horizontally to this width,
    // then grow vertically. This ensures ~6 words per line.
    const maxWidth = GraphStore.MAX_NODE_WIDTH;
    
    const measured = measureText(node.text, undefined, maxWidth);
    const lineHeight = 20;
    const verticalPadding = 24; // 12px top + 12px bottom
    const maxLinesWithoutScroll = 3;
    
    // Padding: 16px horizontal (32px total), 12px vertical
    // Width based on actual text size, with min/max constraints
    node.w = Math.min(maxWidth, Math.max(GraphStore.MIN_NODE_WIDTH, measured.width + 32));
    
    if (isEditable) {
      // For editable state: grow up to 3 lines, then cap height (content scrolls)
      const maxHeight = maxLinesWithoutScroll * lineHeight + verticalPadding;
      node.h = Math.min(maxHeight, Math.max(GraphStore.DEFAULT_NODE_HEIGHT, measured.height + verticalPadding));
    } else if (isActive) {
      // For active state: show full content (no limit)
      node.h = Math.max(GraphStore.DEFAULT_NODE_HEIGHT, measured.height + verticalPadding);
    } else {
      // For inactive state, limit height to ~3 lines (truncated view)
      if (measured.lines.length > 3) {
        node.h = maxLinesWithoutScroll * lineHeight + verticalPadding;
      } else {
        node.h = Math.max(GraphStore.DEFAULT_NODE_HEIGHT, measured.height + verticalPadding);
      }
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
   * Clears nodes, edges, title, and undo history.
   */
  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.setTitle(''); // Clear title when graph is cleared
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
    
    // Load title
    if (data.title !== undefined) {
      this.setTitle(data.title);
    }
    
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
    
    return { 
      title: this.title || undefined,
      nodes, 
      edges 
    };
  }
}

export const graphStore = new GraphStore();
export default graphStore;
