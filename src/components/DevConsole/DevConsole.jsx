import { useState, useRef, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { NodeState } from '../../types';
import './DevConsole.css';

/**
 * Command definitions mapping command names to their handlers.
 */
const COMMANDS = {
  'new-node': {
    description: 'Create a new node at center (like Enter with no selection)',
    execute: (ctx) => {
      const { graphStore, uiStore, focusNodeTextInput, updateSimulation, centerOnNode } = ctx;
      
      // Get canvas center from view transform
      const { x, y, scale } = uiStore.view;
      // Approximate window center, adjust for view transform
      const centerX = (window.innerWidth / 2 - x) / scale;
      const centerY = (window.innerHeight / 2 - y) / scale;
      
      const node = graphStore.createNode({ x: centerX, y: centerY, text: '' });
      uiStore.setActiveNode(node.id);
      uiStore.setEditableNode(node.id);
      
      updateSimulation();
      centerOnNode(node.id);
      setTimeout(() => focusNodeTextInput(node.id), 100);
      
      return `Created node ${node.id}`;
    }
  },
  'new-up': {
    description: 'Create connected node above (like Cmd+ArrowUp)',
    execute: (ctx) => createConnectedNode(ctx, 'up')
  },
  'new-down': {
    description: 'Create connected node below (like Cmd+ArrowDown)',
    execute: (ctx) => createConnectedNode(ctx, 'down')
  },
  'new-left': {
    description: 'Create connected node to the left (like Cmd+ArrowLeft)',
    execute: (ctx) => createConnectedNode(ctx, 'left')
  },
  'new-right': {
    description: 'Create connected node to the right (like Cmd+ArrowRight)',
    execute: (ctx) => createConnectedNode(ctx, 'right')
  },
  'nav-up': {
    description: 'Navigate to connected node above (like ArrowUp)',
    execute: (ctx) => navigateToNode(ctx, 'up')
  },
  'nav-down': {
    description: 'Navigate to connected node below (like ArrowDown)',
    execute: (ctx) => navigateToNode(ctx, 'down')
  },
  'nav-left': {
    description: 'Navigate to connected node on the left (like ArrowLeft)',
    execute: (ctx) => navigateToNode(ctx, 'left')
  },
  'nav-right': {
    description: 'Navigate to connected node on the right (like ArrowRight)',
    execute: (ctx) => navigateToNode(ctx, 'right')
  },
  'edit': {
    description: 'Enter edit mode on active node (like Enter on active)',
    execute: (ctx) => {
      const { graphStore, uiStore, focusNodeTextInput } = ctx;
      const activeNode = graphStore.getNode(uiStore.activeNodeId);
      
      if (!activeNode) {
        return 'No active node to edit';
      }
      
      if (activeNode.state === NodeState.EDITABLE) {
        return 'Already in edit mode';
      }
      
      uiStore.setEditableNode(activeNode.id);
      setTimeout(() => focusNodeTextInput(activeNode.id), 50);
      return 'Entered edit mode';
    }
  },
  'confirm': {
    description: 'Exit edit mode (like Enter in edit mode)',
    execute: (ctx) => {
      const { graphStore, uiStore, updateSimulation } = ctx;
      const activeNode = graphStore.getNode(uiStore.activeNodeId);
      
      if (!activeNode) {
        return 'No active node';
      }
      
      if (activeNode.state !== NodeState.EDITABLE) {
        return 'Not in edit mode';
      }
      
      const nodeText = activeNode.text?.trim() || '';
      if (!nodeText) {
        graphStore.deleteNode(activeNode.id, false);
        uiStore.clearSelection();
        updateSimulation();
        return 'Empty node removed';
      } else {
        uiStore.exitEditable(activeNode.id);
        graphStore.recalculateNodeSize(activeNode.id);
        updateSimulation();
        return 'Exited edit mode';
      }
    }
  },
  'escape': {
    description: 'Escape current mode or clear selection (like Escape)',
    execute: (ctx) => {
      const { graphStore, uiStore, updateSimulation } = ctx;
      const activeNode = graphStore.getNode(uiStore.activeNodeId);
      
      if (uiStore.helpVisible) {
        uiStore.hideHelp();
        return 'Closed help panel';
      }
      
      if (activeNode?.state === NodeState.EDITABLE) {
        const nodeText = activeNode.text?.trim() || '';
        if (!nodeText) {
          graphStore.deleteNode(activeNode.id, false);
          uiStore.clearSelection();
          return 'Empty node removed';
        } else {
          uiStore.exitEditable(activeNode.id);
          graphStore.recalculateNodeSize(activeNode.id);
          updateSimulation();
          return 'Exited edit mode';
        }
      } else {
        uiStore.clearSelection();
        return 'Selection cleared';
      }
    }
  },
  'delete': {
    description: 'Delete selected node(s) or edge (like Delete/Backspace)',
    execute: (ctx) => {
      const { graphStore, uiStore, updateSimulation } = ctx;
      const activeNode = graphStore.getNode(uiStore.activeNodeId);
      
      if (activeNode?.state === NodeState.EDITABLE) {
        return 'Cannot delete while editing';
      }
      
      if (uiStore.selectedEdgeId) {
        graphStore.deleteEdge(uiStore.selectedEdgeId);
        uiStore.setSelectedEdge(null);
        updateSimulation();
        return 'Edge deleted';
      }
      
      const selectedIds = uiStore.getSelectedNodeIds();
      if (selectedIds.length > 0) {
        for (const id of selectedIds) {
          graphStore.deleteNode(id);
        }
        uiStore.clearSelection();
        updateSimulation();
        return `${selectedIds.length} node(s) deleted`;
      }
      
      return 'Nothing to delete';
    }
  },
  'undo': {
    description: 'Undo last action (like Cmd+Z)',
    execute: (ctx) => {
      ctx.undoStore.undo();
      return 'Undo executed';
    }
  },
  'redo': {
    description: 'Redo last undone action (like Cmd+Shift+Z)',
    execute: (ctx) => {
      ctx.undoStore.redo();
      return 'Redo executed';
    }
  },
  'help': {
    description: 'Show available commands',
    execute: () => {
      const cmdList = Object.entries(COMMANDS)
        .map(([name, cmd]) => `  ${name}: ${cmd.description}`)
        .join('\n');
      return `Available commands:\n${cmdList}`;
    }
  },
  'clear': {
    description: 'Clear console history',
    execute: (ctx) => {
      ctx.clearHistory();
      return '';
    }
  }
};

/**
 * Helper: Create a connected node in a direction
 */
function createConnectedNode(ctx, direction) {
  const { graphStore, uiStore, focusNodeTextInput, updateSimulation, centerOnNode } = ctx;
  const activeNode = graphStore.getNode(uiStore.activeNodeId);
  
  if (!activeNode) {
    return 'No active node to connect from';
  }
  
  const offset = 200;
  let newX = activeNode.x;
  let newY = activeNode.y;
  
  switch (direction) {
    case 'up': newY -= offset; break;
    case 'down': newY += offset; break;
    case 'left': newX -= offset; break;
    case 'right': newX += offset; break;
  }
  
  const newNode = graphStore.createNode({ x: newX, y: newY, text: '' });
  graphStore.createEdge(activeNode.id, newNode.id);
  uiStore.setActiveNode(newNode.id);
  uiStore.setEditableNode(newNode.id);
  
  updateSimulation();
  centerOnNode(newNode.id);
  setTimeout(() => focusNodeTextInput(newNode.id), 100);
  
  return `Created connected node ${newNode.id}`;
}

/**
 * Helper: Navigate to a connected node in a direction
 */
function navigateToNode(ctx, direction) {
  const { graphStore, uiStore, centerOnNode } = ctx;
  const activeNode = graphStore.getNode(uiStore.activeNodeId);
  
  if (!activeNode) {
    return 'No active node';
  }
  
  if (activeNode.state === NodeState.EDITABLE) {
    return 'Exit edit mode first';
  }
  
  const connectedNodes = graphStore.getConnectedNodes(activeNode.id);
  if (connectedNodes.length === 0) {
    return 'No connected nodes';
  }
  
  let bestNode = null;
  let bestScore = -Infinity;
  
  for (const node of connectedNodes) {
    const dx = node.x - activeNode.x;
    const dy = node.y - activeNode.y;
    
    let score = 0;
    switch (direction) {
      case 'up': score = -dy - Math.abs(dx) * 0.5; break;
      case 'down': score = dy - Math.abs(dx) * 0.5; break;
      case 'left': score = -dx - Math.abs(dy) * 0.5; break;
      case 'right': score = dx - Math.abs(dy) * 0.5; break;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }
  
  if (bestNode) {
    uiStore.setActiveNode(bestNode.id);
    centerOnNode(bestNode.id);
    return `Navigated to node ${bestNode.id}`;
  }
  
  return `No node in ${direction} direction`;
}

/**
 * DevConsole component - command input panel for dev mode.
 */
const DevConsole = observer(function DevConsole() {
  const { graphStore, uiStore, undoStore } = useStores();
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState([]);
  const inputRef = useRef(null);
  const historyRef = useRef(null);
  
  // Focus input when dev mode becomes active
  useEffect(() => {
    if (uiStore.devModeActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [uiStore.devModeActive]);
  
  // Scroll history to bottom on new entries
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history]);
  
  // Helper functions that will be passed to command context
  const focusNodeTextInput = useCallback((nodeId) => {
    // Dispatch event to focus node (Canvas will handle it)
    window.dispatchEvent(new CustomEvent('brainstorm:focus-node', { detail: { nodeId } }));
  }, []);
  
  const updateSimulation = useCallback(() => {
    window.dispatchEvent(new CustomEvent('brainstorm:update-simulation'));
  }, []);
  
  const centerOnNode = useCallback((nodeId) => {
    window.dispatchEvent(new CustomEvent('brainstorm:center-node', { detail: { nodeId } }));
  }, []);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);
  
  // Commands that put node into edit mode (should blur console after)
  const EDIT_MODE_COMMANDS = ['new-node', 'new-up', 'new-down', 'new-left', 'new-right', 'edit'];
  
  // Execute a command
  const executeCommand = useCallback((command) => {
    const trimmed = command.trim().toLowerCase();
    if (!trimmed) return;
    
    // Add to command history
    setCommandHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);
    
    // Add command to output history
    setHistory(prev => [...prev, { type: 'command', text: `> ${command}` }]);
    
    // Look up command
    const cmd = COMMANDS[trimmed];
    if (cmd) {
      try {
        const result = cmd.execute({
          graphStore,
          uiStore,
          undoStore,
          focusNodeTextInput,
          updateSimulation,
          centerOnNode,
          clearHistory
        });
        if (result) {
          setHistory(prev => [...prev, { type: 'result', text: result }]);
        }
        
        // If command puts node in edit mode, blur the console input
        if (EDIT_MODE_COMMANDS.includes(trimmed)) {
          // Blur after a small delay to let the node focus
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.blur();
            }
          }, 150);
        }
      } catch (err) {
        setHistory(prev => [...prev, { type: 'error', text: `Error: ${err.message}` }]);
      }
    } else {
      setHistory(prev => [...prev, { type: 'error', text: `Unknown command: ${trimmed}. Type "help" for available commands.` }]);
    }
    
    setInputValue('');
  }, [graphStore, uiStore, undoStore, focusNodeTextInput, updateSimulation, centerOnNode, clearHistory]);
  
  // Handle key down in input
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(inputValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      uiStore.hideDevMode();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInputValue('');
        } else {
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        }
      }
    }
  }, [inputValue, executeCommand, uiStore, commandHistory, historyIndex]);
  
  if (!uiStore.devModeActive) return null;
  
  return (
    <div className="dev-console">
      <div className="dev-console-header">
        <span className="dev-console-title">Dev Console</span>
        <button className="dev-console-close" onClick={() => uiStore.hideDevMode()}>×</button>
      </div>
      <div className="dev-console-history" ref={historyRef}>
        {history.map((entry, i) => (
          <div key={i} className={`dev-console-entry dev-console-${entry.type}`}>
            {entry.text}
          </div>
        ))}
      </div>
      <div className="dev-console-input-row">
        <span className="dev-console-prompt">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          className="dev-console-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type command and press Enter..."
          autoComplete="off"
          spellCheck="false"
        />
      </div>
    </div>
  );
});

export default DevConsole;

