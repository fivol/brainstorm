import { useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../stores';
import { CanvasRenderer } from '../canvas/CanvasRenderer';
import { ForceSimulation } from '../canvas/ForceSimulation';
import { NodeState } from '../types';
import { pointInRect } from '../utils/geometry';
import './Canvas.css';

/**
 * Main canvas component.
 * Integrates D3 rendering with React and MobX.
 */
const Canvas = observer(function Canvas() {
  const { graphStore, uiStore, undoStore } = useStores();
  const svgRef = useRef(null);
  const rendererRef = useRef(null);
  const simulationRef = useRef(null);
  
  // Track drag state for distinguishing click vs drag
  const dragStateRef = useRef({ isDragging: false, startX: 0, startY: 0 });
  
  // Track if we just finished a rect selection (to prevent creating node on mouseup)
  const justFinishedRectSelection = useRef(false);

  // Initialize renderer and simulation
  useEffect(() => {
    if (!svgRef.current) return;
    
    const renderer = new CanvasRenderer(svgRef.current, graphStore, uiStore);
    rendererRef.current = renderer;
    
    const simulation = new ForceSimulation(graphStore, uiStore);
    simulationRef.current = simulation;
    
    // Wire up callbacks
    renderer.onNodeClick = handleNodeClick;
    renderer.onNodeDoubleClick = handleNodeDoubleClick;
    renderer.onNodeDragStart = handleNodeDragStart;
    renderer.onNodeDrag = handleNodeDrag;
    renderer.onNodeDragEnd = handleNodeDragEnd;
    renderer.onEdgeClick = handleEdgeClick;
    
    // Force simulation tick triggers re-render
    simulation.onTick = () => {
      renderer.render();
    };
    
    // Initial render
    renderer.render();
    
    // Handle resize
    const handleResize = () => {
      renderer.resize();
    };
    window.addEventListener('resize', handleResize);
    
    // Handle fit view event
    const handleFitView = () => {
      renderer.fitView();
    };
    window.addEventListener('brainstorm:fit-view', handleFitView);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('brainstorm:fit-view', handleFitView);
      simulation.dispose();
      renderer.dispose();
    };
  }, []);

  // Re-render when store data changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render();
    }
  }, [
    graphStore.nodes.size,
    graphStore.edges.size,
    uiStore.activeNodeId,
    uiStore.selectedEdgeId,
    uiStore.multiSelectedIds.size,
    uiStore.rectSelection.active,
    uiStore.edgeCreation.active
  ]);

  // Handle node click
  const handleNodeClick = useCallback((nodeId, _event) => {
    const node = graphStore.getNode(nodeId);
    if (!node) return;
    
    if (node.state === NodeState.ACTIVE) {
      // Second click on active node -> editable
      uiStore.setEditableNode(nodeId);
      // Focus the text input
      setTimeout(() => focusNodeTextInput(nodeId), 50);
    } else if (node.state === NodeState.EDITABLE) {
      // Already editable, do nothing
    } else {
      // Clear previous focus
      if (simulationRef.current) {
        simulationRef.current.clearFocus();
      }
      
      // Make active
      uiStore.setActiveNode(nodeId);
      
      // Focus on connected nodes - selective strengthening
      if (simulationRef.current) {
        simulationRef.current.focusNode(nodeId);
      }
    }
  }, [graphStore, uiStore]);

  // Handle node double click
  const handleNodeDoubleClick = useCallback((nodeId, _event) => {
    uiStore.setActiveNode(nodeId);
    uiStore.setEditableNode(nodeId);
    setTimeout(() => focusNodeTextInput(nodeId), 50);
  }, [uiStore]);

  // Focus text input inside node
  const focusNodeTextInput = (nodeId) => {
    const nodeEl = svgRef.current?.querySelector(`[data-node-id="${nodeId}"] .node-text-container`);
    if (nodeEl) {
      nodeEl.focus();
      // Place cursor at end
      const range = document.createRange();
      range.selectNodeContents(nodeEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  // Handle node drag start
  const handleNodeDragStart = useCallback((nodeId, event) => {
    const node = graphStore.getNode(nodeId);
    if (!node || node.state === NodeState.EDITABLE) return;
    
    uiStore.setDraggingNode(nodeId);
    
    // Track start position for undo
    dragStateRef.current = {
      isDragging: true,
      startX: node.x,
      startY: node.y
    };
    
    // If dragging from an active node, start edge creation (per spec: drag from active node creates edge)
    if (node.state === NodeState.ACTIVE) {
      uiStore.startEdgeCreation(nodeId);
      // Initialize cursor position
      const pos = rendererRef.current.screenToCanvas(event.sourceEvent.clientX, event.sourceEvent.clientY);
      uiStore.updateEdgeCreation(pos.x, pos.y);
      return;
    }
    
    // Fix position during drag and heat up simulation
    if (simulationRef.current) {
      simulationRef.current.fixNode(nodeId, node.x, node.y);
      simulationRef.current.startDrag(nodeId); // Heat up for responsive collision
    }
  }, [graphStore, uiStore]);

  // Handle node drag
  const handleNodeDrag = useCallback((nodeId, event) => {
    // Check if creating edge
    if (uiStore.edgeCreation.active) {
      const pos = rendererRef.current.screenToCanvas(event.sourceEvent.clientX, event.sourceEvent.clientY);
      uiStore.updateEdgeCreation(pos.x, pos.y);
      rendererRef.current.render();
      return;
    }
    
    const node = graphStore.getNode(nodeId);
    if (!node) return;
    
    const { scale } = uiStore.view;
    const newX = node.x + event.dx / scale;
    const newY = node.y + event.dy / scale;
    
    graphStore.moveNode(nodeId, newX, newY, false);
    
    if (simulationRef.current) {
      simulationRef.current.fixNode(nodeId, newX, newY);
      simulationRef.current.syncFromStore();
    }
    
    rendererRef.current.render();
  }, [graphStore, uiStore]);

  // Handle node drag end
  const handleNodeDragEnd = useCallback((nodeId, event) => {
    uiStore.setDraggingNode(null);
    
    // Check if edge creation
    if (uiStore.edgeCreation.active) {
      const pos = rendererRef.current.screenToCanvas(event.sourceEvent.clientX, event.sourceEvent.clientY);
      
      // Find target node
      const targetNode = findNodeAtPosition(pos.x, pos.y);
      
      if (targetNode && targetNode.id !== uiStore.edgeCreation.sourceId) {
        // Create edge to existing node
        graphStore.createEdge(uiStore.edgeCreation.sourceId, targetNode.id);
        uiStore.info('Edge created');
      } else if (!targetNode) {
        // Create new node and edge
        const newNode = graphStore.createNode({ x: pos.x, y: pos.y, text: '' });
        graphStore.createEdge(uiStore.edgeCreation.sourceId, newNode.id);
        uiStore.setActiveNode(newNode.id);
        uiStore.setEditableNode(newNode.id);
        setTimeout(() => focusNodeTextInput(newNode.id), 50);
      }
      
      uiStore.cancelEdgeCreation();
      
      if (simulationRef.current) {
        simulationRef.current.update();
        simulationRef.current.reheat(0.3);
      }
      return;
    }
    
    // Record position change for undo
    const node = graphStore.getNode(nodeId);
    if (node) {
      undoStore.push({
        type: 'move_node',
        data: { nodeId, oldX: dragStateRef.current.startX, oldY: dragStateRef.current.startY },
        reverseData: { nodeId, newX: node.x, newY: node.y }
      });
    }
    
    // Release fixed position and let simulation cool down
    if (simulationRef.current) {
      simulationRef.current.releaseNode(nodeId);
      simulationRef.current.endDrag(); // Allow natural settling
    }
    
    dragStateRef.current.isDragging = false;
  }, [graphStore, uiStore, undoStore]);

  // Find node at position
  const findNodeAtPosition = (x, y) => {
    for (const node of graphStore.nodes.values()) {
      if (pointInRect(x, y, node.x, node.y, node.w, node.h)) {
        return node;
      }
    }
    return null;
  };

  // Handle edge click
  const handleEdgeClick = useCallback((edgeId, _event) => {
    uiStore.setSelectedEdge(edgeId);
  }, [uiStore]);

  // Handle canvas click (empty space)
  const handleCanvasClick = useCallback((event) => {
    // Skip if we just finished a rect selection
    if (justFinishedRectSelection.current) {
      justFinishedRectSelection.current = false;
      return;
    }
    
    // Check if click is on canvas background (not on nodes/edges)
    const target = event.target;
    const isBackground = target.classList.contains('canvas-background') || 
                        target === svgRef.current ||
                        target.classList.contains('graph-canvas');
    
    if (!isBackground) return;
    
    const pos = rendererRef.current.screenToCanvas(event.clientX, event.clientY);
    
    // Check if clicking on a node first
    const clickedNode = findNodeAtPosition(pos.x, pos.y);
    if (clickedNode) return;
    
    // Create new node at click position
    const node = graphStore.createNode({ x: pos.x, y: pos.y, text: '' });
    uiStore.setActiveNode(node.id);
    uiStore.setEditableNode(node.id);
    
    if (simulationRef.current) {
      simulationRef.current.update();
      simulationRef.current.reheat(0.2);
    }
    
    setTimeout(() => focusNodeTextInput(node.id), 50);
    uiStore.info('Node created');
  }, [graphStore, uiStore]);

  // Handle canvas drag for rectangular selection
  const handleCanvasMouseDown = useCallback((event) => {
    // Check if click is on canvas background
    const target = event.target;
    const isBackground = target.classList.contains('canvas-background') || 
                        target === svgRef.current ||
                        target.classList.contains('graph-canvas');
    
    if (!isBackground) return;
    if (event.button !== 0) return; // Left click only
    
    const pos = rendererRef.current.screenToCanvas(event.clientX, event.clientY);
    
    // Check if clicking empty space
    const clickedNode = findNodeAtPosition(pos.x, pos.y);
    if (clickedNode) return;
    
    // Track potential rect selection start - but don't start it yet
    // Only start if mouse moves (handled in handleCanvasMouseMove)
    dragStateRef.current = {
      isDragging: false,
      startX: pos.x,
      startY: pos.y,
      screenStartX: event.clientX,
      screenStartY: event.clientY,
      isPotentialRectSelect: true,
      isRectSelect: false
    };
  }, []);

  const handleCanvasMouseMove = useCallback((event) => {
    // Check if we should start a rect selection (mouse moved enough)
    if (dragStateRef.current.isPotentialRectSelect && !dragStateRef.current.isRectSelect) {
      const dx = Math.abs(event.clientX - dragStateRef.current.screenStartX);
      const dy = Math.abs(event.clientY - dragStateRef.current.screenStartY);
      
      // Start rect selection only if mouse moved more than 5 pixels
      if (dx > 5 || dy > 5) {
        dragStateRef.current.isRectSelect = true;
        dragStateRef.current.isDragging = true;
        uiStore.startRectSelection(dragStateRef.current.startX, dragStateRef.current.startY);
      }
    }
    
    if (!dragStateRef.current.isRectSelect) return;
    
    const pos = rendererRef.current.screenToCanvas(event.clientX, event.clientY);
    uiStore.updateRectSelection(pos.x, pos.y);
    
    // Update multi-selection based on rectangle
    const bounds = uiStore.getRectSelectionBounds();
    const selectedIds = [];
    
    for (const node of graphStore.nodes.values()) {
      if (pointInRect(node.x, node.y, 
          bounds.x + bounds.width / 2, bounds.y + bounds.height / 2,
          bounds.width, bounds.height)) {
        selectedIds.push(node.id);
      }
    }
    
    uiStore.setMultiSelection(selectedIds);
    rendererRef.current.render();
  }, [graphStore, uiStore]);

  const handleCanvasMouseUp = useCallback((event) => {
    if (dragStateRef.current.isRectSelect) {
      // Mark that we just finished a rect selection to prevent click from creating a node
      justFinishedRectSelection.current = true;
      uiStore.endRectSelection();
      rendererRef.current.render();
    }
    // Reset all drag state
    dragStateRef.current = {
      isDragging: false,
      isRectSelect: false,
      isPotentialRectSelect: false
    };
  }, [uiStore]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event) => {
    const activeNode = graphStore.getNode(uiStore.activeNodeId);
    
    // Global shortcuts
    if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
      if (event.shiftKey) {
        undoStore.redo();
      } else {
        undoStore.undo();
      }
      event.preventDefault();
      return;
    }
    
    // Delete selected
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (uiStore.selectedEdgeId) {
        graphStore.deleteEdge(uiStore.selectedEdgeId);
        uiStore.setSelectedEdge(null);
        uiStore.info('Edge deleted');
        if (simulationRef.current) simulationRef.current.update();
        return;
      }
      
      const selectedIds = uiStore.getSelectedNodeIds();
      if (selectedIds.length > 0 && !activeNode?.state === NodeState.EDITABLE) {
        for (const id of selectedIds) {
          graphStore.deleteNode(id);
        }
        uiStore.clearSelection();
        uiStore.info(`${selectedIds.length} node(s) deleted`);
        if (simulationRef.current) simulationRef.current.update();
      }
      return;
    }
    
    // Escape - close help, exit editable, or clear selection
    if (event.key === 'Escape') {
      // First priority: close help panel if open
      if (uiStore.helpVisible) {
        uiStore.hideHelp();
        return;
      }
      
      if (activeNode?.state === NodeState.EDITABLE) {
        // Remove node if text is empty
        const nodeText = activeNode.text?.trim() || '';
        if (!nodeText) {
          graphStore.deleteNode(activeNode.id, false);
          uiStore.clearSelection();
          uiStore.info('Empty node removed');
        } else {
          uiStore.exitEditable(activeNode.id);
          graphStore.recalculateNodeSize(activeNode.id);
        }
        if (simulationRef.current) {
          simulationRef.current.update();
          simulationRef.current.reheat(0.1);
        }
      } else {
        uiStore.clearSelection();
      }
      rendererRef.current.render();
      return;
    }
    
    // Enter - create node or enter edit mode
    if (event.key === 'Enter' && !event.shiftKey) {
      if (activeNode?.state === NodeState.EDITABLE) {
        // Remove node if text is empty, otherwise exit edit mode
        const nodeText = activeNode.text?.trim() || '';
        if (!nodeText) {
          graphStore.deleteNode(activeNode.id, false);
          uiStore.clearSelection();
          uiStore.info('Empty node removed');
        } else {
          uiStore.exitEditable(activeNode.id);
          graphStore.recalculateNodeSize(activeNode.id);
        }
        if (simulationRef.current) {
          simulationRef.current.update();
          simulationRef.current.reheat(0.1);
        }
        rendererRef.current.render();
        event.preventDefault();
        return;
      }
      
      if (activeNode?.state === NodeState.ACTIVE) {
        // Enter edit mode
        uiStore.setEditableNode(activeNode.id);
        setTimeout(() => focusNodeTextInput(activeNode.id), 50);
        event.preventDefault();
        return;
      }
      
      if (!uiStore.activeNodeId) {
        // Create new node in center
        const { x, y, scale } = uiStore.view;
        const centerX = (rendererRef.current.width / 2 - x) / scale;
        const centerY = (rendererRef.current.height / 2 - y) / scale;
        
        const node = graphStore.createNode({ x: centerX, y: centerY, text: '' });
        uiStore.setActiveNode(node.id);
        uiStore.setEditableNode(node.id);
        
        if (simulationRef.current) {
          simulationRef.current.update();
          simulationRef.current.reheat(0.2);
        }
        
        setTimeout(() => focusNodeTextInput(node.id), 50);
        event.preventDefault();
      }
      return;
    }
    
    // Arrow key navigation
    if (event.key.startsWith('Arrow') && activeNode && activeNode.state !== NodeState.EDITABLE) {
      const connectedNodes = graphStore.getConnectedNodes(activeNode.id);
      if (connectedNodes.length === 0) return;
      
      // Find node in the arrow direction
      const dir = event.key.replace('Arrow', '').toLowerCase();
      let bestNode = null;
      let bestScore = -Infinity;
      
      for (const node of connectedNodes) {
        const dx = node.x - activeNode.x;
        const dy = node.y - activeNode.y;
        
        let score = 0;
        switch (dir) {
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
        rendererRef.current.render();
      }
      event.preventDefault();
      return;
    }
    
    // Ctrl/Cmd + Arrow: create connected node
    if ((event.metaKey || event.ctrlKey) && event.key.startsWith('Arrow') && activeNode) {
      const dir = event.key.replace('Arrow', '').toLowerCase();
      const offset = 200;
      
      let newX = activeNode.x;
      let newY = activeNode.y;
      
      switch (dir) {
        case 'up': newY -= offset; break;
        case 'down': newY += offset; break;
        case 'left': newX -= offset; break;
        case 'right': newX += offset; break;
      }
      
      const newNode = graphStore.createNode({ x: newX, y: newY, text: '' });
      graphStore.createEdge(activeNode.id, newNode.id);
      uiStore.setActiveNode(newNode.id);
      uiStore.setEditableNode(newNode.id);
      
      if (simulationRef.current) {
        simulationRef.current.update();
        simulationRef.current.reheat(0.3);
      }
      
      setTimeout(() => focusNodeTextInput(newNode.id), 50);
      event.preventDefault();
    }
  }, [graphStore, uiStore, undoStore]);

  // Handle text input in nodes
  const handleNodeTextInput = useCallback((event) => {
    const nodeId = uiStore.activeNodeId;
    if (!nodeId) return;
    
    const node = graphStore.getNode(nodeId);
    if (!node || node.state !== NodeState.EDITABLE) return;
    
    // Get text from contenteditable
    const text = event.target.innerText || '';
    graphStore.updateNodeText(nodeId, text, false);
    
    // Recalculate size live
    graphStore.recalculateNodeSize(nodeId);
    rendererRef.current.render();
  }, [graphStore, uiStore]);

  // Set up event delegation for text input
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    
    const handleInput = (event) => {
      if (event.target.classList.contains('node-text-container')) {
        handleNodeTextInput(event);
      }
    };
    
    const handleBlur = (event) => {
      if (event.target.classList.contains('node-text-container')) {
        const nodeId = uiStore.activeNodeId;
        if (nodeId) {
          const node = graphStore.getNode(nodeId);
          if (node?.state === NodeState.EDITABLE) {
            // Record text change for undo
            const text = event.target.innerText || '';
            graphStore.updateNodeText(nodeId, text, true);
          }
        }
      }
    };
    
    svg.addEventListener('input', handleInput);
    svg.addEventListener('blur', handleBlur, true);
    
    return () => {
      svg.removeEventListener('input', handleInput);
      svg.removeEventListener('blur', handleBlur, true);
    };
  }, [graphStore, uiStore, handleNodeTextInput]);

  // Global keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <svg
      ref={svgRef}
      className="graph-canvas"
      onClick={handleCanvasClick}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
    />
  );
});

export default Canvas;
