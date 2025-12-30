/**
 * Core type definitions for the graph canvas application.
 * Using JSDoc for type documentation in JavaScript.
 */

/**
 * Node states enum
 * @readonly
 * @enum {string}
 */
export const NodeState = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  EDITABLE: 'editable',
  MULTI_SELECTED: 'multi_selected'
};

/**
 * Toast notification types
 * @readonly
 * @enum {string}
 */
export const ToastType = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
};

/**
 * Action types for undo/redo
 * @readonly
 * @enum {string}
 */
export const ActionType = {
  CREATE_NODE: 'create_node',
  DELETE_NODE: 'delete_node',
  MOVE_NODE: 'move_node',
  EDIT_NODE_TEXT: 'edit_node_text',
  CREATE_EDGE: 'create_edge',
  DELETE_EDGE: 'delete_edge',
  EDIT_EDGE_LABEL: 'edit_edge_label',
  BATCH: 'batch'
};

/**
 * @typedef {Object} GraphNode
 * @property {string} id - Unique identifier
 * @property {string} text - Node text content (multiline)
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} w - Width
 * @property {number} h - Height
 * @property {NodeState} state - Current node state
 * @property {number} [createdAt] - Creation timestamp
 * @property {number} [updatedAt] - Last update timestamp
 * @property {Object} [meta] - Optional metadata
 */

/**
 * @typedef {Object} GraphEdge
 * @property {string} id - Unique identifier
 * @property {string} sourceId - Source node ID
 * @property {string} targetId - Target node ID
 * @property {string} [label] - Optional edge label
 * @property {Array<{x: number, y: number}>} [controlPoints] - Routing control points
 * @property {Object} [style] - Optional styling
 */

/**
 * @typedef {Object} UndoAction
 * @property {ActionType} type - Action type
 * @property {Object} data - Action data for undo
 * @property {Object} [reverseData] - Data needed to redo
 */

/**
 * @typedef {Object} Toast
 * @property {string} id - Unique identifier
 * @property {ToastType} type - Toast type
 * @property {string} message - Toast message
 * @property {number} timestamp - Creation timestamp
 */

/**
 * @typedef {Object} ViewState
 * @property {number} x - Pan X offset
 * @property {number} y - Pan Y offset
 * @property {number} scale - Zoom scale
 */
