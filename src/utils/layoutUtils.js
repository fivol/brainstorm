import * as d3 from 'd3'

// Store simulation instance for reuse
let currentSimulation = null

/**
 * Create a force-directed graph simulation for universal graph layout.
 * Works with any graph structure: cycles, multiple parents, disconnected components.
 */
export const createForceSimulation = (
  blocks,
  connections,
  canvasWidth = window.innerWidth,
  canvasHeight = window.innerHeight,
  onTick = null
) => {
  // Stop any existing simulation
  if (currentSimulation) {
    currentSimulation.stop()
  }

  if (blocks.length === 0) return null

  // Create nodes array with current positions
  const nodes = blocks.map(block => ({
    id: block.id,
    x: block.x + (block.width || 200) / 2, // Use center position
    y: block.y + (block.height || 100) / 2,
    width: block.width || 200,
    height: block.height || 100,
    fx: null, // Fixed x (null = not fixed)
    fy: null  // Fixed y (null = not fixed)
  }))

  // Create links array from connections
  const links = connections.map(conn => ({
    source: conn.from,
    target: conn.to
  }))

  // Calculate center of canvas
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2

  // Create force simulation
  const simulation = d3.forceSimulation(nodes)
    // Link force - connected nodes attract
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(250) // Preferred distance between connected nodes
      .strength(0.8)  // How strongly links pull nodes together
    )
    // Charge force - nodes repel each other
    .force('charge', d3.forceManyBody()
      .strength(-800) // Negative = repulsion
      .distanceMin(100)
      .distanceMax(800)
    )
    // Center force - keep graph centered
    .force('center', d3.forceCenter(centerX, centerY)
      .strength(0.1)
    )
    // Collision force - prevent node overlap
    .force('collision', d3.forceCollide()
      .radius(d => Math.max(d.width, d.height) / 2 + 30)
      .strength(0.9)
    )
    // X positioning force - spread horizontally
    .force('x', d3.forceX(centerX).strength(0.02))
    // Y positioning force - spread vertically
    .force('y', d3.forceY(centerY).strength(0.02))
    // Simulation parameters
    .alphaDecay(0.02)  // How quickly simulation cools down
    .velocityDecay(0.4) // Friction

  // Set up tick callback if provided
  if (onTick) {
    simulation.on('tick', () => onTick(nodes))
  }

  currentSimulation = simulation
  return simulation
}

/**
 * Run force simulation and return final positions.
 * This runs the simulation to completion (synchronously).
 */
export const calculateForceLayout = (
  blocks,
  connections,
  canvasWidth = window.innerWidth,
  canvasHeight = window.innerHeight
) => {
  const positionMap = new Map()
  
  if (blocks.length === 0) return positionMap

  // Create nodes array with current positions
  const nodes = blocks.map(block => ({
    id: block.id,
    x: block.x + (block.width || 200) / 2,
    y: block.y + (block.height || 100) / 2,
    width: block.width || 200,
    height: block.height || 100
  }))

  // Create links array from connections
  const links = connections.map(conn => ({
    source: conn.from,
    target: conn.to
  }))

  // Calculate center of canvas
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2

  // Create and run simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(250)
      .strength(0.8)
    )
    .force('charge', d3.forceManyBody()
      .strength(-800)
      .distanceMin(100)
      .distanceMax(800)
    )
    .force('center', d3.forceCenter(centerX, centerY)
      .strength(0.1)
    )
    .force('collision', d3.forceCollide()
      .radius(d => Math.max(d.width, d.height) / 2 + 30)
      .strength(0.9)
    )
    .force('x', d3.forceX(centerX).strength(0.02))
    .force('y', d3.forceY(centerY).strength(0.02))
    .alphaDecay(0.05)
    .velocityDecay(0.4)
    .stop() // Don't auto-start

  // Run simulation for a fixed number of iterations
  const iterations = 150
  for (let i = 0; i < iterations; i++) {
    simulation.tick()
  }

  // Extract final positions (convert from center to top-left)
  nodes.forEach(node => {
    positionMap.set(node.id, {
      x: node.x - node.width / 2,
      y: node.y - node.height / 2
    })
  })

  return positionMap
}

/**
 * Calculate the bounding box of all positioned blocks.
 */
export const getLayoutBounds = (positionMap, blocks) => {
  if (positionMap.size === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }
  
  let minX = Infinity, minY = Infinity
  let maxX = -Infinity, maxY = -Infinity
  
  positionMap.forEach((pos, blockId) => {
    const block = blocks.find(b => b.id === blockId)
    const width = block?.width || 200
    const height = block?.height || 100
    
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + width)
    maxY = Math.max(maxY, pos.y + height)
  })
  
  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Generate a bezier curve path between two points.
 * Uses d3.linkHorizontal for smooth curves.
 */
export const generateBezierPath = (
  fromX, fromY,
  toX, toY
) => {
  // Determine if connection is more horizontal or vertical
  const dx = Math.abs(toX - fromX)
  const dy = Math.abs(toY - fromY)
  
  if (dx > dy) {
    // Use horizontal link generator (curves horizontally)
    const linkGenerator = d3.linkHorizontal()
      .x(d => d.x)
      .y(d => d.y)
    
    return linkGenerator({
      source: { x: fromX, y: fromY },
      target: { x: toX, y: toY }
    })
  } else {
    // Use vertical link generator (curves vertically)
    const linkGenerator = d3.linkVertical()
      .x(d => d.x)
      .y(d => d.y)
    
    return linkGenerator({
      source: { x: fromX, y: fromY },
      target: { x: toX, y: toY }
    })
  }
}

/**
 * Find the best connection points on block edges.
 */
export const findConnectionPoints = (
  fromBlock, toBlock,
  fromDimensions, toDimensions
) => {
  const fromCenterX = fromBlock.x + fromDimensions.width / 2
  const fromCenterY = fromBlock.y + fromDimensions.height / 2
  const toCenterX = toBlock.x + toDimensions.width / 2
  const toCenterY = toBlock.y + toDimensions.height / 2
  
  const dx = toCenterX - fromCenterX
  const dy = toCenterY - fromCenterY
  
  // Determine which sides to connect based on relative positions
  let fromX, fromY, toX, toY
  
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      // Target is to the right
      fromX = fromBlock.x + fromDimensions.width
      fromY = fromCenterY
      toX = toBlock.x
      toY = toCenterY
    } else {
      // Target is to the left
      fromX = fromBlock.x
      fromY = fromCenterY
      toX = toBlock.x + toDimensions.width
      toY = toCenterY
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      // Target is below
      fromX = fromCenterX
      fromY = fromBlock.y + fromDimensions.height
      toX = toCenterX
      toY = toBlock.y
    } else {
      // Target is above
      fromX = fromCenterX
      fromY = fromBlock.y
      toX = toCenterX
      toY = toBlock.y + toDimensions.height
    }
  }
  
  return { fromX, fromY, toX, toY }
}

/**
 * Stop the current simulation if running.
 */
export const stopSimulation = () => {
  if (currentSimulation) {
    currentSimulation.stop()
    currentSimulation = null
  }
}
