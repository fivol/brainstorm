import * as d3 from 'd3';
import { runInAction } from 'mobx';

/**
 * Force simulation manager for graph layout.
 * 
 * Uses the Brainstorm algorithm with competing physical forces:
 * - Many-Body (global repulsion)
 * - Link (elastic tension between connected nodes)
 * - Collision (physical volume prevents overlap)
 * - Centering forces (keeps graph in view)
 */
export class ForceSimulation {
  simulation = null;
  graphStore = null;
  uiStore = null;
  onTick = null;
  
  // Force parameters matching the algorithm spec
  linkDistance = 250;          // Target distance between connected nodes
  chargeStrength = -1000;      // Strong repulsion for spacing
  collisionPadding = 20;       // Extra padding around nodes
  
  // Track focused node for selective strengthening
  focusedNodeId = null;
  
  // Timeout for fixing positions after time limit
  settleTimeout = null;
  settleTimeLimit = 1000;      // 1 second time limit for arrangement
  
  constructor(graphStore, uiStore = null, options = {}) {
    this.graphStore = graphStore;
    this.uiStore = uiStore;
    Object.assign(this, options);
    this.init();
  }

  init() {
    this.simulation = d3.forceSimulation()
      // A. Many-Body Force (Global Repulsion)
      // Every node repels every other node
      .force('charge', d3.forceManyBody()
        .strength(this.chargeStrength)
        .distanceMax(500)  // Optimization: cap at 500px for performance
      )
      
      // B. Link Force (Elastic Tension)
      // Acts like springs between connected nodes
      .force('link', d3.forceLink()
        .id(d => d.id)
        .distance(this.linkDistance)
        .strength(d => this.getLinkStrength(d))
      )
      
      // C. Collision Force (Physical Volume)
      // Prevents node overlap with push behavior
      .force('collision', d3.forceCollide()
        .radius(d => this.getCollisionRadius(d))
        .strength(1)  // Full strength for solid collision
        .iterations(2)  // Multiple iterations for better resolution
      )
      
      // D. Centering Forces
      // Keep center of mass at origin
      .force('center', d3.forceCenter(0, 0))
      
      // Gentle gravity to prevent infinite drift
      .force('x', d3.forceX(0).strength(0.02))
      .force('y', d3.forceY(0).strength(0.02))
      
      // Simulation parameters for fast settling
      .alphaDecay(0.05)      // Faster decay for quicker settling
      .velocityDecay(0.5);   // Higher friction for faster stabilization
    
    this.simulation.on('tick', () => {
      this.syncToStore();
      if (this.onTick) this.onTick();
    });
    
    // Start cooled down
    this.simulation.alpha(0).stop();
  }

  /**
   * Get collision radius for a node based on its geometric bounds.
   * Formula: sqrt((width/2)^2 + (height/2)^2) + padding
   * @param {Object} d - Node data
   * @returns {number}
   */
  getCollisionRadius(d) {
    const halfW = (d.w || 100) / 2;
    const halfH = (d.h || 50) / 2;
    return Math.sqrt(halfW * halfW + halfH * halfH) + this.collisionPadding;
  }

  /**
   * Get link strength based on focus context.
   * Connected to focused node: 1.0 (rigid)
   * Not connected to focused: 0.1 (loose)
   * @param {Object} d - Link data with source/target
   * @returns {number}
   */
  getLinkStrength(d) {
    if (!this.focusedNodeId) {
      return 0.3; // Default medium strength
    }
    
    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
    
    // Connected to focused node gets rigid strength
    if (sourceId === this.focusedNodeId || targetId === this.focusedNodeId) {
      return 1.0;
    }
    
    // Other links stay loose
    return 0.1;
  }

  /**
   * Update simulation with current graph data.
   */
  update() {
    const nodes = this.graphStore.getNodes().map(n => {
      // Find existing simulation node to preserve velocity
      const existing = this.simulation.nodes().find(sn => sn.id === n.id);
      return {
        ...n,
        // Preserve velocity for smooth continuation
        vx: existing?.vx || 0,
        vy: existing?.vy || 0,
        // Preserve fixed position if set
        fx: existing?.fx,
        fy: existing?.fy
      };
    });
    
    const edges = this.graphStore.getEdges().map(e => ({
      source: e.sourceId,
      target: e.targetId
    }));
    
    this.simulation.nodes(nodes);
    this.simulation.force('link').links(edges);
    
    // Update collision radii based on current node sizes
    this.simulation.force('collision').radius(d => this.getCollisionRadius(d));
    
    // Update link strengths based on focus
    this.simulation.force('link').strength(d => this.getLinkStrength(d));
  }

  /**
   * Sync simulation positions back to store.
   */
  syncToStore() {
    const simNodes = this.simulation.nodes();
    runInAction(() => {
      for (const simNode of simNodes) {
        const storeNode = this.graphStore.getNode(simNode.id);
        if (storeNode) {
          storeNode.x = simNode.x;
          storeNode.y = simNode.y;
        }
      }
    });
  }

  /**
   * Sync store positions to simulation.
   */
  syncFromStore() {
    const simNodes = this.simulation.nodes();
    for (const simNode of simNodes) {
      const storeNode = this.graphStore.getNode(simNode.id);
      if (storeNode) {
        simNode.x = storeNode.x;
        simNode.y = storeNode.y;
        simNode.w = storeNode.w;
        simNode.h = storeNode.h;
      }
    }
  }

  /**
   * Trigger a gentle layout adaptation.
   * Positions will be fixed after settleTimeLimit (1s).
   * @param {number} [alpha=0.3] - Heat level (0-1)
   */
  reheat(alpha = 0.3) {
    this.update();
    this.simulation.alpha(alpha).restart();
    
    // Clear any existing timeout
    if (this.settleTimeout) {
      clearTimeout(this.settleTimeout);
    }
    
    // Set timeout to stop simulation and fix positions after 1s
    this.settleTimeout = setTimeout(() => {
      this.simulation.stop();
      this.settleTimeout = null;
    }, this.settleTimeLimit);
  }

  /**
   * Fix a node position (during drag).
   * Setting fx/fy overrides physics calculations.
   * @param {string} nodeId
   * @param {number} x
   * @param {number} y
   */
  fixNode(nodeId, x, y) {
    const simNodes = this.simulation.nodes();
    const node = simNodes.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }

  /**
   * Release a fixed node.
   * Allows physics to take over again.
   * @param {string} nodeId
   */
  releaseNode(nodeId) {
    const simNodes = this.simulation.nodes();
    const node = simNodes.find(n => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
  }

  /**
   * Start drag interaction.
   * Heats up simulation for responsive push behavior.
   * @param {string} nodeId
   */
  startDrag(nodeId) {
    // Clear settle timeout during drag
    if (this.settleTimeout) {
      clearTimeout(this.settleTimeout);
      this.settleTimeout = null;
    }
    // Heat up simulation for responsive collision
    this.simulation.alphaTarget(0.3).restart();
  }

  /**
   * End drag interaction.
   * Allows simulation to cool down naturally with time limit.
   */
  endDrag() {
    // Let simulation cool down naturally
    this.simulation.alphaTarget(0);
    
    // Set timeout to stop simulation after settling
    if (this.settleTimeout) {
      clearTimeout(this.settleTimeout);
    }
    this.settleTimeout = setTimeout(() => {
      this.simulation.stop();
      this.settleTimeout = null;
    }, this.settleTimeLimit);
  }

  /**
   * Stop the simulation.
   */
  stop() {
    this.simulation.stop();
  }

  /**
   * Restart with full energy.
   */
  restart() {
    this.update();
    this.simulation.alpha(1).restart();
  }

  /**
   * Set center point for centering force.
   * @param {number} x
   * @param {number} y
   */
  setCenter(x, y) {
    this.simulation.force('center', d3.forceCenter(x, y));
    this.simulation.force('x', d3.forceX(x).strength(0.02));
    this.simulation.force('y', d3.forceY(y).strength(0.02));
  }

  /**
   * Focus on a node - connected nodes snap closer via selective strengthening.
   * @param {string} nodeId
   */
  focusNode(nodeId) {
    this.focusedNodeId = nodeId;
    
    // Update link strengths
    this.simulation.force('link').strength(d => this.getLinkStrength(d));
    
    // Reduce distance for connected links
    this.simulation.force('link').distance(d => {
      const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const targetId = typeof d.target === 'object' ? d.target.id : d.target;
      
      if (sourceId === nodeId || targetId === nodeId) {
        return this.linkDistance * 0.6; // Pull connected nodes closer
      }
      return this.linkDistance;
    });
    
    this.reheat(0.3);
  }

  /**
   * Clear focus - restore default link behavior.
   */
  clearFocus() {
    this.focusedNodeId = null;
    
    // Restore default link behavior
    this.simulation.force('link')
      .strength(d => this.getLinkStrength(d))
      .distance(this.linkDistance);
  }

  /**
   * Dispose simulation.
   */
  dispose() {
    if (this.settleTimeout) {
      clearTimeout(this.settleTimeout);
      this.settleTimeout = null;
    }
    this.simulation.stop();
    this.simulation = null;
  }
}

export default ForceSimulation;
