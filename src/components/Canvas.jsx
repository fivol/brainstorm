import { useEffect, useRef, useCallback, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../stores';
import { CanvasRenderer } from '../canvas/CanvasRenderer';
import { ForceSimulation } from '../canvas/ForceSimulation';
import { NodeState, ActionType } from '../types';
import { pointInRect, findFreePosition } from '../utils/geometry';
import './Canvas.css';

/**
 * Main canvas component.
 * Integrates D3 rendering with React and MobX.
 */
const Canvas = observer(function Canvas() {
  const { graphStore, uiStore, undoStore, aiStore } = useStores();
  
  // AI Generate state
  const [showAIInput, setShowAIInput] = useState(false);
  const [aiInputValue, setAIInputValue] = useState('');
  const [aiInputPosition, setAIInputPosition] = useState({ x: 0, y: 0 });
  const aiInputRef = useRef(null);
  
  // AI Suggestions (virtual cards) state
  const [selectedVirtualCard, setSelectedVirtualCard] = useState(null);
  
  const svgRef = useRef(null);
  const rendererRef = useRef(null);
  const simulationRef = useRef(null);
  
  // Track drag state for distinguishing click vs drag
  const dragStateRef = useRef({ isDragging: false, startX: 0, startY: 0 });
  
  // Track if we just finished a rect selection (to prevent creating node on mouseup)
  const justFinishedRectSelection = useRef(false);
  
  // Track if we just deselected an empty node (to prevent creating new node on canvas click)
  const justDeletedEmptyNode = useRef(false);

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
    
    // Handle focus node event (from DevConsole)
    const handleFocusNode = (event) => {
      const { nodeId } = event.detail;
      if (nodeId) {
        const nodeEl = svgRef.current?.querySelector(`[data-node-id="${nodeId}"] .node-text-container`);
        if (nodeEl) {
          nodeEl.focus();
          const range = document.createRange();
          range.selectNodeContents(nodeEl);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    };
    window.addEventListener('brainstorm:focus-node', handleFocusNode);
    
    // Handle update simulation event (from DevConsole)
    const handleUpdateSimulation = () => {
      if (simulationRef.current) {
        simulationRef.current.update();
        simulationRef.current.reheat(0.2);
      }
      renderer.render();
    };
    window.addEventListener('brainstorm:update-simulation', handleUpdateSimulation);
    
    // Handle center on node event (from DevConsole)
    const handleCenterNode = (event) => {
      const { nodeId } = event.detail;
      if (nodeId) {
        renderer.centerOnNode(nodeId);
        renderer.render();
      }
    };
    window.addEventListener('brainstorm:center-node', handleCenterNode);
    
    // Handle create new node event (from plus button)
    const handleCreateNewNode = () => {
      // Don't create new node if there's already an active node
      if (uiStore.activeNodeId) {
        return;
      }
      
      // Create new node in center of view, finding free space
      const { x, y, scale } = uiStore.view;
      const centerX = (renderer.width / 2 - x) / scale;
      const centerY = (renderer.height / 2 - y) / scale;
      
      // Find a free position near the center
      const existingNodes = graphStore.getNodes();
      const freePos = findFreePosition(existingNodes, centerX, centerY, 160, 44);
      
      const node = graphStore.createNode({ x: freePos.x, y: freePos.y, text: '' });
      uiStore.setActiveNode(node.id);
      uiStore.setEditableNode(node.id);
      
      simulation.update();
      simulation.reheat(0.2);
      
      renderer.centerOnNode(node.id, false);
      renderer.render();
      setTimeout(() => focusNodeTextInput(node.id), 100);
    };
    window.addEventListener('brainstorm:create-node', handleCreateNewNode);
    
    // Handle first visit complete - create first node only if no nodes exist
    const handleFirstVisitComplete = () => {
      // If there are already nodes (e.g., from loaded example), don't create new one
      if (graphStore.nodes.size > 0) {
        renderer.fitView();
        return;
      }
      
      // Create first node at canvas origin (0, 0) - this will be centered
      // Using 0,0 ensures the node is at the logical center regardless of view state
      const node = graphStore.createNode({ x: 0, y: 0, text: '' });
      uiStore.setActiveNode(node.id);
      uiStore.setEditableNode(node.id);
      
      simulation.update();
      simulation.reheat(0.2);
      
      // Center the view on the new node (which is at 0,0)
      renderer.centerOnNode(node.id, false);
      renderer.render();
      
      // Focus the node text input
      setTimeout(() => {
        const nodeEl = svgRef.current?.querySelector(`[data-node-id="${node.id}"] .node-text-container`);
        if (nodeEl) {
          nodeEl.focus();
        }
      }, 100);
    };
    window.addEventListener('brainstorm:first-visit-complete', handleFirstVisitComplete);
    
    // Handle open AI prompt event (from Controls panel)
    const handleOpenAIPrompt = () => {
      // Will be handled by effect that sets up the actual handler
      window.dispatchEvent(new CustomEvent('brainstorm:open-ai-prompt-internal'));
    };
    window.addEventListener('brainstorm:open-ai-prompt', handleOpenAIPrompt);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('brainstorm:fit-view', handleFitView);
      window.removeEventListener('brainstorm:focus-node', handleFocusNode);
      window.removeEventListener('brainstorm:update-simulation', handleUpdateSimulation);
      window.removeEventListener('brainstorm:center-node', handleCenterNode);
      window.removeEventListener('brainstorm:create-node', handleCreateNewNode);
      window.removeEventListener('brainstorm:first-visit-complete', handleFirstVisitComplete);
      window.removeEventListener('brainstorm:open-ai-prompt', handleOpenAIPrompt);
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

  // Get active node state for effect dependency
  const activeNodeForEffect = graphStore.getNode(uiStore.activeNodeId);
  const activeNodeState = activeNodeForEffect?.state;
  const activeNodeText = activeNodeForEffect?.text;
  
  // Track previous state to detect edit -> active transition
  const prevNodeStateRef = useRef(null);
  const prevActiveNodeIdRef = useRef(null);

  // Auto-trigger AI suggestions only on edit -> active transition (when auto-suggestions enabled)
  useEffect(() => {
    const prevState = prevNodeStateRef.current;
    const prevNodeId = prevActiveNodeIdRef.current;
    
    // Update refs for next render
    prevNodeStateRef.current = activeNodeState;
    prevActiveNodeIdRef.current = uiStore.activeNodeId;
    
    if (!uiStore.activeNodeId) {
      // Clear suggestions when no node is active
      if (aiStore.virtualCards.length > 0) {
        aiStore.clearVirtualCards();
        setSelectedVirtualCard(null);
      }
      return;
    }
    
    const activeNode = graphStore.getNode(uiStore.activeNodeId);
    if (!activeNode) return;
    
    // Hide suggestions when node enters editable mode
    if (activeNode.state === NodeState.EDITABLE) {
      if (aiStore.virtualCards.length > 0) {
        aiStore.clearVirtualCards();
        setSelectedVirtualCard(null);
      }
      return;
    }
    
    // Clear suggestions if switching to a different node (not staying on same node)
    if (prevNodeId && prevNodeId !== uiStore.activeNodeId) {
      if (aiStore.virtualCards.length > 0) {
        aiStore.clearVirtualCards();
        setSelectedVirtualCard(null);
      }
      // Don't auto-suggest when just navigating between nodes
      return;
    }
    
    // Only show suggestions if:
    // - Node is active (not editable)
    // - Node has text content (not empty)
    // - AI is configured and hints are enabled
    // - Auto suggestions are enabled
    // - Previous state was EDITABLE (edit -> active transition)
    const isEditToActiveTransition = prevState === NodeState.EDITABLE && activeNode.state === NodeState.ACTIVE;
    
    if (
      activeNode.state === NodeState.ACTIVE &&
      activeNode.text?.trim() &&
      aiStore.isConfigured &&
      aiStore.hintsEnabled &&
      aiStore.autoSuggestionsEnabled &&
      isEditToActiveTransition
    ) {
      // Generate suggestions after edit -> active transition
      aiStore.generateSuggestions(graphStore, uiStore.activeNodeId, 3)
        .then(() => {
          setSelectedVirtualCard(0);
        })
        .catch((err) => {
          console.error('Failed to generate AI suggestions:', err);
        });
    }
  }, [uiStore.activeNodeId, activeNodeState, activeNodeText, graphStore, aiStore]);

  // Handle node click
  const handleNodeClick = useCallback((nodeId, _event) => {
    const node = graphStore.getNode(nodeId);
    if (!node) return;
    
    // If clicking on an empty node (that was in editable mode but lost focus), remove it
    if (!node.text?.trim() && node.state !== NodeState.EDITABLE) {
      graphStore.deleteNode(nodeId, false);
      uiStore.clearSelection();
      if (simulationRef.current) {
        simulationRef.current.update();
      }
      rendererRef.current.render();
      return;
    }
    
    if (node.state === NodeState.ACTIVE) {
      // Second click on active node -> editable
      // Clear AI suggestions when entering edit mode
      if (aiStore.virtualCards.length > 0) {
        aiStore.clearVirtualCards();
        setSelectedVirtualCard(null);
      }
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
    
    const sourceEvent = event.sourceEvent;
    const hasModifier = sourceEvent.metaKey || sourceEvent.ctrlKey || sourceEvent.altKey;
    
    uiStore.setDraggingNode(nodeId);
    
    // Track start position for undo
    dragStateRef.current = {
      isDragging: true,
      startX: node.x,
      startY: node.y
    };
    
    // Edge creation with modifier key (cmd/ctrl/alt + drag) - works on any node
    if (hasModifier) {
      // Make the node active first if not already
      if (node.state !== NodeState.ACTIVE) {
        uiStore.setActiveNode(nodeId);
      }
      uiStore.startEdgeCreation(nodeId);
      // Initialize cursor position
      const pos = rendererRef.current.screenToCanvas(sourceEvent.clientX, sourceEvent.clientY);
      uiStore.updateEdgeCreation(pos.x, pos.y);
      return;
    }
    
    // Plain drag = node movement (select if not already)
    if (node.state !== NodeState.ACTIVE) {
      uiStore.setActiveNode(nodeId);
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
      let newNodeId = null;
      
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
        newNodeId = newNode.id;
      }
      
      uiStore.cancelEdgeCreation();
      
      if (simulationRef.current) {
        simulationRef.current.update();
        simulationRef.current.reheat(0.3);
      }
      
      // If a new node was created, center on it, render and focus it
      if (newNodeId) {
        rendererRef.current.centerOnNode(newNodeId);
        rendererRef.current.render();
        setTimeout(() => focusNodeTextInput(newNodeId), 100);
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
    
    // Skip if we just deleted an empty node (clicked to deselect empty editable node)
    if (justDeletedEmptyNode.current) {
      justDeletedEmptyNode.current = false;
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
    
    // Check if there's currently an empty editable node that will be deleted
    const activeNode = graphStore.getNode(uiStore.activeNodeId);
    if (activeNode && activeNode.state === NodeState.EDITABLE && !activeNode.text?.trim()) {
      // This click will deselect and delete the empty node - don't create a new one
      justDeletedEmptyNode.current = true;
      uiStore.clearSelection();
      if (simulationRef.current) {
        simulationRef.current.update();
      }
      rendererRef.current.render();
      return;
    }
    
    // Create new node at click position
    const node = graphStore.createNode({ x: pos.x, y: pos.y, text: '' });
    uiStore.setActiveNode(node.id);
    uiStore.setEditableNode(node.id);
    
    if (simulationRef.current) {
      simulationRef.current.update();
      simulationRef.current.reheat(0.2);
    }
    
    // Render (node is already at cursor position, no need to center)
    rendererRef.current.render();
    setTimeout(() => focusNodeTextInput(node.id), 100);
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

  const handleCanvasMouseUp = useCallback(() => {
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

  // Handle virtual card click (accept AI suggestion)
  const handleVirtualCardClick = useCallback((cardIndex) => {
    const card = aiStore.virtualCards[cardIndex];
    if (!card) return;
    
    const activeNode = graphStore.getNode(uiStore.activeNodeId);
    if (!activeNode) return;
    
    // Find best position for new node
    const offset = 200;
    let newX = activeNode.x + activeNode.w + offset;
    let newY = activeNode.y;
    
    // Check if right side is busy
    const existingNodes = graphStore.getNodes();
    const rightSideBusy = existingNodes.some(n => 
      n.id !== activeNode.id && 
      n.x > activeNode.x && 
      Math.abs(n.x - newX) < 100 && 
      Math.abs(n.y - newY) < 50
    );
    
    if (rightSideBusy) {
      newX = activeNode.x - offset - 160;
    }
    
    // Create the real node
    const newNode = graphStore.createNode({ x: newX, y: newY, text: card.text });
    graphStore.createEdge(activeNode.id, newNode.id);
    
    aiStore.clearVirtualCards();
    setSelectedVirtualCard(null);
    
    uiStore.setActiveNode(newNode.id);
    
    if (simulationRef.current) {
      simulationRef.current.update();
      simulationRef.current.reheat(0.3);
    }
    
    rendererRef.current.centerOnNode(newNode.id);
    rendererRef.current.render();
  }, [graphStore, uiStore, aiStore]);

  // Open AI prompt input - can work with or without active node
  const openAIPromptInput = useCallback(() => {
    if (!aiStore.isConfigured) {
      aiStore.openModal();
      uiStore.info('Configure AI to use generate feature');
      return;
    }
    
    // Always center the prompt in the viewport for better UX
    const screenX = window.innerWidth / 2 - 170;
    const screenY = window.innerHeight / 2 - 80;
    
    setAIInputPosition({ x: screenX, y: screenY });
    setShowAIInput(true);
    setAIInputValue('');
    
    // Focus input after it appears
    setTimeout(() => {
      aiInputRef.current?.focus();
    }, 50);
  }, [aiStore, uiStore]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event) => {
    // Skip if dev console is active and not F8/Escape
    if (uiStore.devModeActive && event.key !== 'F8' && event.key !== 'Escape') {
      return;
    }
    
    // F8 - Toggle dev mode
    if (event.key === 'F8') {
      event.preventDefault();
      uiStore.toggleDevMode();
      return;
    }
    
    const activeNode = graphStore.getNode(uiStore.activeNodeId);
    
    // Cmd+P - Open AI prompt input (when generateEnabled) - works even without selection
    if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
      event.preventDefault();
      if (aiStore.generateEnabled) {
        // Can work without active node or with active non-editable node
        if (!activeNode || activeNode.state !== NodeState.EDITABLE) {
          openAIPromptInput();
        }
      }
      return;
    }
    
    // Handle virtual cards navigation with Up/Down arrow keys only
    if (aiStore.virtualCards.length > 0 && activeNode && activeNode.state === NodeState.ACTIVE) {
      // Up/Down for virtual card navigation
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedVirtualCard(prev => 
          prev === null || prev === 0 ? aiStore.virtualCards.length - 1 : prev - 1
        );
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedVirtualCard(prev => 
          prev === null ? 0 : (prev + 1) % aiStore.virtualCards.length
        );
        return;
      }
      // Enter to accept selected virtual card
      if (event.key === 'Enter' && selectedVirtualCard !== null) {
        event.preventDefault();
        handleVirtualCardClick(selectedVirtualCard);
        return;
      }
      // Escape to close virtual cards
      if (event.key === 'Escape') {
        event.preventDefault();
        aiStore.clearVirtualCards();
        setSelectedVirtualCard(null);
        return;
      }
      // Left/Right arrows dismiss suggestions and navigate graph
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        aiStore.clearVirtualCards();
        setSelectedVirtualCard(null);
        // Continue to graph navigation below
      }
    }
    
    // Ctrl+Space - trigger AI suggestions
    if ((event.ctrlKey || event.metaKey) && event.key === ' ') {
      event.preventDefault();
      if (activeNode && activeNode.state !== NodeState.EDITABLE && aiStore.isConfigured && aiStore.hintsEnabled) {
        aiStore.generateSuggestions(graphStore, activeNode.id, 3);
        setSelectedVirtualCard(0);
      } else if (!aiStore.isConfigured) {
        aiStore.openModal();
        uiStore.info('Configure AI to get suggestions');
      }
      return;
    }
    
    // Handle virtual cards navigation and selection (currently disabled)
    /* if (aiStore.virtualCards.length > 0 && activeNode && activeNode.state === NodeState.ACTIVE) {
      const cards = aiStore.virtualCards;
      
      // Arrow navigation between virtual cards
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedVirtualCard(prev => 
          prev === null ? 0 : Math.min(prev + 1, cards.length - 1)
        );
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedVirtualCard(prev => 
          prev === null ? 0 : Math.max(prev - 1, 0)
        );
        return;
      }
      
      // Enter to accept selected virtual card
      if (event.key === 'Enter' && selectedVirtualCard !== null) {
        event.preventDefault();
        const card = cards[selectedVirtualCard];
        if (card) {
          // Find best position for new node (to the right of current node, or other side if busy)
          const offset = 200;
          let newX = activeNode.x + activeNode.w + offset;
          let newY = activeNode.y;
          
          // Check if right side is busy (has a node nearby)
          const existingNodes = graphStore.getNodes();
          const rightSideBusy = existingNodes.some(n => 
            n.id !== activeNode.id && 
            n.x > activeNode.x && 
            Math.abs(n.x - newX) < 100 && 
            Math.abs(n.y - newY) < 50
          );
          
          if (rightSideBusy) {
            // Try left side
            newX = activeNode.x - offset - 160;
          }
          
          // Create the real node
          const newNode = graphStore.createNode({ x: newX, y: newY, text: card.text });
          graphStore.createEdge(activeNode.id, newNode.id);
          
          aiStore.clearVirtualCards();
          setSelectedVirtualCard(null);
          
          uiStore.setActiveNode(newNode.id);
          
          if (simulationRef.current) {
            simulationRef.current.update();
            simulationRef.current.reheat(0.3);
          }
          
          rendererRef.current.centerOnNode(newNode.id);
          rendererRef.current.render();
        }
        return;
      }
      
      // Escape to close virtual cards
      if (event.key === 'Escape') {
        event.preventDefault();
        aiStore.clearVirtualCards();
        setSelectedVirtualCard(null);
        return;
      }
    } */
    
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
    
    // Cmd+Delete/Backspace - delete current node and restore previous selection
    if ((event.metaKey || event.ctrlKey) && (event.key === 'Delete' || event.key === 'Backspace')) {
      if (activeNode && activeNode.state !== NodeState.EDITABLE) {
        const previousId = uiStore.getPreviousNodeId();
        const previousNode = previousId ? graphStore.getNode(previousId) : null;
        
        graphStore.deleteNode(activeNode.id);
        
        // Restore previous selection if it still exists
        if (previousNode) {
          uiStore.setActiveNode(previousId);
          rendererRef.current.centerOnNode(previousId);
        } else {
          uiStore.clearSelection();
        }
        
        uiStore.info('Node deleted');
        if (simulationRef.current) simulationRef.current.update();
        rendererRef.current.render();
        event.preventDefault();
        return;
      }
    }
    
    // Delete selected (without modifier)
    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Skip if in editable mode (let text editing handle it)
      if (activeNode?.state === NodeState.EDITABLE) return;
      
      if (uiStore.selectedEdgeId) {
        graphStore.deleteEdge(uiStore.selectedEdgeId);
        uiStore.setSelectedEdge(null);
        uiStore.info('Edge deleted');
        if (simulationRef.current) simulationRef.current.update();
        return;
      }
      
      const selectedIds = uiStore.getSelectedNodeIds();
      if (selectedIds.length > 0) {
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
          uiStore.info('Empty node removed');
        } else {
          graphStore.recalculateNodeSize(activeNode.id);
        }
        if (simulationRef.current) {
          simulationRef.current.update();
          simulationRef.current.reheat(0.1);
        }
      }
      // Always clear selection on Escape
      uiStore.clearSelection();
      rendererRef.current.render();
      return;
    }
    
    // Tab - create new node and deselect current
    if (event.key === 'Tab') {
      event.preventDefault();
      
      // If in editable mode, exit first
      if (activeNode?.state === NodeState.EDITABLE) {
        const nodeText = activeNode.text?.trim() || '';
        if (!nodeText) {
          graphStore.deleteNode(activeNode.id, false);
        } else {
          uiStore.exitEditable(activeNode.id);
          graphStore.recalculateNodeSize(activeNode.id);
        }
      }
      
      // Clear current selection first
      uiStore.clearSelection();
      
      // Create new node in center of view, finding free space
      const { x, y, scale } = uiStore.view;
      const centerX = (rendererRef.current.width / 2 - x) / scale;
      const centerY = (rendererRef.current.height / 2 - y) / scale;
      
      // Find a free position near the center
      const existingNodes = graphStore.getNodes();
      const freePos = findFreePosition(existingNodes, centerX, centerY, 160, 44);
      
      const node = graphStore.createNode({ x: freePos.x, y: freePos.y, text: '' });
      uiStore.setActiveNode(node.id);
      uiStore.setEditableNode(node.id);
      
      if (simulationRef.current) {
        simulationRef.current.update();
        simulationRef.current.reheat(0.2);
      }
      
      rendererRef.current.centerOnNode(node.id, false);
      rendererRef.current.render();
      setTimeout(() => focusNodeTextInput(node.id), 100);
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
        // If there are existing nodes (e.g., from loaded example), don't create new one
        // Instead, do nothing and let user click on a node to select it
        if (graphStore.nodes.size > 0) {
          event.preventDefault();
          return;
        }
        
        // Create new node in center of view, finding free space
        const { x, y, scale } = uiStore.view;
        const centerX = (rendererRef.current.width / 2 - x) / scale;
        const centerY = (rendererRef.current.height / 2 - y) / scale;
        
        // Find a free position near the center
        const existingNodes = graphStore.getNodes();
        const freePos = findFreePosition(existingNodes, centerX, centerY, 160, 44);
        
        const node = graphStore.createNode({ x: freePos.x, y: freePos.y, text: '' });
        uiStore.setActiveNode(node.id);
        uiStore.setEditableNode(node.id);
        
        if (simulationRef.current) {
          simulationRef.current.update();
          simulationRef.current.reheat(0.2);
        }
        
        // Center on new node and render
        rendererRef.current.centerOnNode(node.id, false);
        rendererRef.current.render();
        setTimeout(() => focusNodeTextInput(node.id), 100);
        event.preventDefault();
      }
      return;
    }
    
    // Ctrl/Cmd + Arrow: create connected node (check this first before plain arrow navigation)
    if ((event.metaKey || event.ctrlKey) && event.key.startsWith('Arrow') && activeNode && activeNode.state !== NodeState.EDITABLE) {
      event.preventDefault();
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
      
      // Clear AI suggestions when creating new connected node
      if (aiStore.virtualCards.length > 0) {
        aiStore.clearVirtualCards();
        setSelectedVirtualCard(null);
      }
      
      const newNode = graphStore.createNode({ x: newX, y: newY, text: '' });
      graphStore.createEdge(activeNode.id, newNode.id);
      uiStore.setActiveNode(newNode.id);
      uiStore.setEditableNode(newNode.id);
      
      if (simulationRef.current) {
        simulationRef.current.update();
        simulationRef.current.reheat(0.3);
      }
      
      // Center on new node and render
      rendererRef.current.centerOnNode(newNode.id);
      rendererRef.current.render();
      setTimeout(() => focusNodeTextInput(newNode.id), 100);
      return;
    }
    
    // Arrow key navigation - moves to closest node in direction (connected nodes prioritized)
    if (event.key.startsWith('Arrow') && activeNode && activeNode.state !== NodeState.EDITABLE) {
      // Clear AI suggestions when navigating away
      if (aiStore.virtualCards.length > 0) {
        aiStore.clearVirtualCards();
        setSelectedVirtualCard(null);
      }
      
      const connectedNodes = graphStore.getConnectedNodes(activeNode.id);
      const allNodes = graphStore.getNodes().filter(n => n.id !== activeNode.id);
      
      if (allNodes.length === 0) return;
      
      // Find node in the arrow direction
      const dir = event.key.replace('Arrow', '').toLowerCase();
      
      // Helper to calculate score for a node in the given direction
      const calculateScore = (node, isConnected) => {
        const dx = node.x - activeNode.x;
        const dy = node.y - activeNode.y;
        
        // Check if node is in the correct direction
        let inDirection = false;
        let dirScore = 0;
        switch (dir) {
          case 'up': 
            inDirection = dy < 0; 
            dirScore = -dy - Math.abs(dx) * 0.5;
            break;
          case 'down': 
            inDirection = dy > 0; 
            dirScore = dy - Math.abs(dx) * 0.5;
            break;
          case 'left': 
            inDirection = dx < 0; 
            dirScore = -dx - Math.abs(dy) * 0.5;
            break;
          case 'right': 
            inDirection = dx > 0; 
            dirScore = dx - Math.abs(dy) * 0.5;
            break;
        }
        
        // If not in direction, return very low score
        if (!inDirection) return -Infinity;
        
        // Connected nodes get a bonus
        const connectionBonus = isConnected ? 10000 : 0;
        
        return dirScore + connectionBonus;
      };
      
      let bestNode = null;
      let bestScore = -Infinity;
      
      // Check all nodes, but prioritize connected ones
      const connectedIds = new Set(connectedNodes.map(n => n.id));
      
      for (const node of allNodes) {
        const isConnected = connectedIds.has(node.id);
        const score = calculateScore(node, isConnected);
        
        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
        }
      }
      
      if (bestNode) {
        uiStore.setActiveNode(bestNode.id);
        rendererRef.current.centerOnNode(bestNode.id);
        rendererRef.current.render();
      }
      event.preventDefault();
      return;
    }
  }, [graphStore, uiStore, undoStore, openAIPromptInput, aiStore, handleVirtualCardClick, selectedVirtualCard]);

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

  // Listen for open AI prompt event from Controls panel
  useEffect(() => {
    const handleOpenAIPromptInternal = () => {
      openAIPromptInput();
    };
    window.addEventListener('brainstorm:open-ai-prompt-internal', handleOpenAIPromptInternal);
    return () => window.removeEventListener('brainstorm:open-ai-prompt-internal', handleOpenAIPromptInternal);
  }, [openAIPromptInput]);

  // Position AI button close to selected node
  const getAIIconPosition = useCallback(() => {
    const activeNode = graphStore.getNode(uiStore.activeNodeId);
    if (!activeNode || activeNode.state === NodeState.EDITABLE) return null;
    
    const { x: viewX, y: viewY, scale } = uiStore.view;
    
    // Position at top-right corner of the node
    const canvasX = activeNode.x + activeNode.w / 2 + 8;
    const canvasY = activeNode.y - activeNode.h / 2 - 8;
    
    // Convert to screen coordinates
    const screenX = canvasX * scale + viewX;
    const screenY = canvasY * scale + viewY;
    
    return { x: screenX, y: screenY };
  }, [graphStore, uiStore.activeNodeId, uiStore.view]);

  // Handle AI icon click (near node)
  const handleAIIconClick = useCallback(() => {
    openAIPromptInput();
  }, [openAIPromptInput]);

  // Handle AI input submit
  const handleAIInputSubmit = useCallback(async () => {
    if (!aiInputValue.trim()) return;
    
    // Get active node if any (can be null for generating new graph)
    const activeNode = uiStore.activeNodeId ? graphStore.getNode(uiStore.activeNodeId) : null;
    
    const result = await aiStore.generateFromTask(graphStore, uiStore.activeNodeId, aiInputValue);
    
    if (result && result.nodes && result.edges) {
      // Collect all actions for batch undo
      const batchActions = [];
      
      // Create a mapping from short IDs to full IDs
      const idMap = new Map();
      
      // Map existing node short IDs
      for (const node of graphStore.getNodes()) {
        idMap.set(node.id.slice(-6), node.id);
      }
      
      // Base position: near active node or center of view
      let baseX = 0, baseY = 0;
      if (activeNode) {
        baseX = activeNode.x;
        baseY = activeNode.y;
      } else {
        // Center of current view
        const { x, y, scale } = uiStore.view;
        baseX = (rendererRef.current?.width / 2 - x) / scale || 0;
        baseY = (rendererRef.current?.height / 2 - y) / scale || 0;
      }
      
      // Create new nodes (without recording undo individually)
      const baseOffset = 200;
      result.nodes.forEach((nodeData, index) => {
        const angle = (index / result.nodes.length) * Math.PI * 2;
        const radius = baseOffset + (index % 2) * 80;
        
        const newX = baseX + Math.cos(angle) * radius;
        const newY = baseY + Math.sin(angle) * radius;
        
        const newNode = graphStore.createNode({ 
          x: newX, 
          y: newY, 
          text: nodeData.text 
        }, false); // Don't record undo individually
        
        // Map the new short ID to the full ID
        idMap.set(nodeData.id, newNode.id);
        
        // Add to batch actions
        batchActions.push({
          type: ActionType.CREATE_NODE,
          data: { nodeId: newNode.id },
          reverseData: { node: { ...newNode } }
        });
      });
      
      // Create edges (without recording undo individually)
      result.edges.forEach((edgeData) => {
        const sourceId = idMap.get(edgeData.from);
        const targetId = idMap.get(edgeData.to);
        
        if (sourceId && targetId) {
          const edge = graphStore.createEdge(sourceId, targetId, '', false); // Don't record undo individually
          if (edge) {
            batchActions.push({
              type: ActionType.CREATE_EDGE,
              data: { edgeId: edge.id },
              reverseData: { edge: { ...edge } }
            });
          }
        }
      });
      
      // Push a single batch action for undo
      if (batchActions.length > 0) {
        undoStore.push({
          type: ActionType.BATCH,
          data: { actions: batchActions },
          reverseData: {}
        });
      }
      
      // Update simulation and render
      if (simulationRef.current) {
        simulationRef.current.update();
        simulationRef.current.reheat(0.5);
      }
      
      rendererRef.current.render();
      uiStore.info(`Generated ${result.nodes.length} nodes`);
    }
    
    setShowAIInput(false);
    setAIInputValue('');
  }, [aiInputValue, aiStore, graphStore, uiStore, undoStore]);

  // Handle AI input key down
  const handleAIInputKeyDown = useCallback((e) => {
    // Stop propagation for all keys to prevent Canvas shortcuts
    e.stopPropagation();
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAIInputSubmit();
    } else if (e.key === 'Escape') {
      setShowAIInput(false);
      setAIInputValue('');
    }
  }, [handleAIInputSubmit]);

  const aiIconPosition = getAIIconPosition();

  // Calculate virtual card positions - positioned to the right of the active node
  const getVirtualCardPositions = useCallback(() => {
    if (aiStore.virtualCards.length === 0) return [];
    
    // Don't show virtual cards when AI prompt input is visible
    if (showAIInput) return [];
    
    const activeNode = graphStore.getNode(uiStore.activeNodeId);
    if (!activeNode) return [];
    
    // Don't show virtual cards for empty nodes
    if (!activeNode.text?.trim()) return [];
    
    const { x: viewX, y: viewY, scale } = uiStore.view;
    const cardWidth = 160;
    const cardHeight = 50;
    const gap = 12;
    const offsetFromNode = 60; // Increased offset to avoid tooltip overlap
    
    // Position to the right of the node
    const nodeRightX = (activeNode.x + activeNode.w / 2 + offsetFromNode) * scale + viewX;
    const nodeCenterY = activeNode.y * scale + viewY;
    
    // Calculate total height of all cards
    const totalHeight = aiStore.virtualCards.length * cardHeight + (aiStore.virtualCards.length - 1) * gap;
    const startY = nodeCenterY - totalHeight / 2;
    
    return aiStore.virtualCards.map((card, index) => {
      const screenX = nodeRightX;
      const screenY = startY + index * (cardHeight + gap);
      
      return {
        ...card,
        index,
        x: screenX,
        y: screenY,
        width: cardWidth,
        height: cardHeight,
        // Arrow start point (from active node)
        arrowStartX: (activeNode.x + activeNode.w / 2) * scale + viewX,
        arrowStartY: nodeCenterY,
        // Arrow end point (to virtual card)
        arrowEndX: screenX,
        arrowEndY: screenY + cardHeight / 2
      };
    });
  }, [graphStore, uiStore, aiStore.virtualCards, showAIInput]);

  const virtualCardPositions = getVirtualCardPositions();

  return (
    <>
      <svg
        ref={svgRef}
        className="graph-canvas"
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      />
      
      {/* AI Generate Icon - Conversation style, fixed position */}
      {aiIconPosition && aiStore.generateEnabled && aiStore.isConfigured && !showAIInput && (
        <button
          className="ai-generate-icon"
          style={{
            left: aiIconPosition.x,
            top: aiIconPosition.y,
          }}
          onClick={handleAIIconClick}
          title="Generate nodes with AI (⌘P)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
          </svg>
        </button>
      )}
      
      {/* AI Generate Input */}
      {showAIInput && (
        <div 
          className="ai-generate-input-container"
          style={{
            left: aiInputPosition.x,
            top: aiInputPosition.y,
          }}
        >
          <div className="ai-generate-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            <span>AI Generate</span>
          </div>
          <div className="ai-generate-body">
            <input
              ref={aiInputRef}
              type="text"
              className="ai-generate-input"
              placeholder="What would you like to create?"
              value={aiInputValue}
              onChange={(e) => setAIInputValue(e.target.value)}
              onKeyDown={handleAIInputKeyDown}
              onBlur={() => {
                // Delay to allow click on submit
                setTimeout(() => {
                  if (!aiStore.generateLoading) {
                    setShowAIInput(false);
                  }
                }, 200);
              }}
            />
            {aiStore.generateLoading ? (
              <div className="ai-generate-loading">
                <span className="ai-generate-spinner" />
              </div>
            ) : (
              <button 
                className="ai-generate-submit"
                onClick={handleAIInputSubmit}
                disabled={!aiInputValue.trim()}
                title="Generate"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            )}
          </div>
          <div className="ai-generate-hint">
            <span>Describe nodes, topics, or ideas to add</span>
            <span><kbd>Enter</kbd> to send · <kbd>Esc</kbd> to close</span>
          </div>
        </div>
      )}
      
      {/* Virtual Cards Overlay */}
      {virtualCardPositions.length > 0 && (
        <div className="virtual-cards-overlay">
          <svg className="virtual-arrows-svg">
            <defs>
              <marker
                id="virtual-arrow-head"
                markerWidth="4"
                markerHeight="4"
                refX="3"
                refY="2"
                orient="auto"
              >
                <path d="M0,0 L4,2 L0,4 Z" fill="var(--info-color)" opacity="0.7" />
              </marker>
            </defs>
            {virtualCardPositions.map((card, index) => {
              const controlX = card.arrowStartX + (card.arrowEndX - card.arrowStartX) * 0.5;
              const controlY = card.arrowStartY;
              return (
                <path
                  key={`arrow-${index}`}
                  d={`M ${card.arrowStartX} ${card.arrowStartY} Q ${controlX} ${controlY} ${card.arrowEndX} ${card.arrowEndY}`}
                  fill="none"
                  stroke="var(--info-color)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  opacity={selectedVirtualCard === index ? 0.8 : 0.5}
                  markerEnd="url(#virtual-arrow-head)"
                />
              );
            })}
          </svg>
          
          {virtualCardPositions.map((card, index) => (
            <div
              key={card.id}
              className={`virtual-card ${selectedVirtualCard === index ? 'virtual-card-selected' : ''}`}
              style={{
                left: card.x,
                top: card.y,
                width: card.width,
                minHeight: card.height,
                transform: `scale(${1})`,
              }}
              onClick={() => handleVirtualCardClick(index)}
              onMouseEnter={() => setSelectedVirtualCard(index)}
            >
              <span className="virtual-card-text">{card.text}</span>
            </div>
          ))}
          
          {aiStore.loadingSuggestions && (
            <div className="virtual-cards-loading">
              <span className="virtual-spinner" />
              Generating suggestions...
            </div>
          )}
        </div>
      )}
    </>
  );
});

export default Canvas;
