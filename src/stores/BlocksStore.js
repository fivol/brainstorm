import { makeAutoObservable, runInAction } from 'mobx'
import { getBlockDimensions, resolveCollisions, measureTextWidth } from '../utils/blockUtils'
import { calculateHierarchicalLayout, getLayoutBounds } from '../utils/layoutUtils'

class BlocksStore {
  blocks = []
  activeBlockId = null
  hoveredBlockId = null
  canvasRef = null
  connections = [] // Array of { from: blockId, to: blockId }
  connectingFrom = null // blockId when user is dragging to create connection
  tempArrowEnd = null // { x, y } for temporary arrow while dragging
  justFinishedConnecting = false // Flag to prevent canvas click after connection
  
  // Canvas pan and zoom
  panX = 0 // Canvas pan offset X
  panY = 0 // Canvas pan offset Y
  scale = 1 // Canvas zoom scale
  isPanning = false // Whether user is currently panning
  panStartX = 0 // Starting X position when panning starts
  panStartY = 0 // Starting Y position when panning starts
  panStartOffsetX = 0 // Canvas offset X when panning starts
  panStartOffsetY = 0 // Canvas offset Y when panning starts
  
  // Layout settings
  autoLayoutEnabled = true // Whether to auto-arrange blocks on connection changes
  isAnimating = false // Whether blocks are currently animating to new positions

  constructor() {
    makeAutoObservable(this)
    // Listen for window resize
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleWindowResize.bind(this))
    }
  }

  // Handle window resize - recalculate layout
  handleWindowResize() {
    if (this.autoLayoutEnabled && this.connections.length > 0) {
      this.applyHierarchicalLayout()
    }
  }

  setCanvasRef(ref) {
    this.canvasRef = ref
  }

  getBlockDimensionsFn(block, isExpanded) {
    return getBlockDimensions(block, isExpanded, measureTextWidth)
  }

  resolveCollisionsFn(blocksToResolve, activeId, hoveredId) {
    return resolveCollisions(blocksToResolve, activeId, hoveredId, this.getBlockDimensionsFn.bind(this))
  }

  handleCanvasClick(e) {
    // Don't create new nodes when connecting or just finished connecting
    if (this.connectingFrom || this.justFinishedConnecting || this.isPanning) {
      this.justFinishedConnecting = false
      return
    }
    
    // Check if click is on canvas or canvas-content (not on a block)
    const target = e.target
    
    // Check if clicked on a block
    const clickedOnBlock = target.closest && target.closest('.text-block')
    if (clickedOnBlock) {
      return
    }
    
    // Check if clicked on canvas-content or its children (arrows, etc.)
    const clickedOnCanvasContent = target.closest && target.closest('.canvas-content')
    const isCanvasRef = target === this.canvasRef
    
    if (clickedOnCanvasContent || isCanvasRef) {
      const rect = this.canvasRef.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const { x, y } = this.screenToCanvas(screenX, screenY)

      const newBlock = {
        id: Date.now(),
        x,
        y,
        text: '',
        width: 200,
        height: 100,
        isActive: true,
        isCollapsed: false
      }

      runInAction(() => {
        const updated = [...this.blocks, newBlock]
        this.blocks = this.resolveCollisionsFn(updated, newBlock.id, null)
        this.activeBlockId = newBlock.id
      })
    }
  }

  handleBlockClick(e, blockId) {
    e.stopPropagation()
    
    // Don't make block editable when connecting
    if (this.connectingFrom) {
      return
    }
    
    runInAction(() => {
      this.activeBlockId = blockId
      const updated = this.blocks.map(block =>
        block.id === blockId ? { ...block, isActive: true, isCollapsed: false } : block
      )
      this.blocks = this.resolveCollisionsFn(updated, blockId, this.hoveredBlockId)
    })
  }

  handleTextChange(blockId, text) {
    runInAction(() => {
      this.blocks = this.blocks.map(block =>
        block.id === blockId ? { ...block, text } : block
      )
    })
  }

  handleBlockBlur(blockId) {
    runInAction(() => {
      this.activeBlockId = null
      const block = this.blocks.find(b => b.id === blockId)
      if (!block || !block.text.trim()) {
        this.blocks = this.blocks.filter(b => b.id !== blockId)
        // Remove all connections involving this block
        this.connections = this.connections.filter(
          conn => conn.from !== blockId && conn.to !== blockId
        )
        return
      }
      const updated = this.blocks.map(b =>
        b.id === blockId
          ? { ...b, isActive: false, isCollapsed: true }
          : b
      )
      this.blocks = this.resolveCollisionsFn(updated, null, this.hoveredBlockId)
    })
  }

  handleBlockMouseEnter(blockId) {
    runInAction(() => {
      this.hoveredBlockId = blockId
      const updated = this.blocks.map(block =>
        block.id === blockId && !block.isActive
          ? { ...block, isCollapsed: false }
          : block
      )
      this.blocks = this.resolveCollisionsFn(updated, this.activeBlockId, blockId)
    })
  }

  handleBlockMouseLeave(blockId) {
    runInAction(() => {
      this.hoveredBlockId = null
      const updated = this.blocks.map(b =>
        b.id === blockId && !b.isActive && b.text.trim()
          ? { ...b, isCollapsed: true }
          : b
      )
      this.blocks = this.resolveCollisionsFn(updated, this.activeBlockId, null)
    })
  }

  handleRemoveAll() {
    runInAction(() => {
      this.blocks = []
      this.activeBlockId = null
      this.hoveredBlockId = null
      this.connections = []
      this.connectingFrom = null
      this.tempArrowEnd = null
    })
  }

  handleBlockMouseDown(e, blockId) {
    // Don't start connection if panning
    if (this.isPanning) {
      return
    }

    // Only start connection if not clicking on textarea or if block is not active
    const block = this.blocks.find(b => b.id === blockId)
    if (e.target.tagName !== 'TEXTAREA' && (!block || !block.isActive)) {
      e.preventDefault()
      e.stopPropagation()
      runInAction(() => {
        this.connectingFrom = blockId
      })
    }
  }

  handleCanvasMouseMove(e) {
    // Handle panning
    if (this.isPanning) {
      this.updatePan(e)
      return
    }

    // Handle connection dragging
    if (this.connectingFrom && this.canvasRef) {
      const rect = this.canvasRef.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      // Convert to canvas coordinates (accounting for transform)
      const canvasCoords = this.screenToCanvas(screenX, screenY)
      runInAction(() => {
        this.tempArrowEnd = {
          x: canvasCoords.x,
          y: canvasCoords.y
        }
      })
    }
  }

  handleCanvasMouseUp(e) {
    // Stop panning
    if (this.isPanning) {
      this.stopPan()
      return
    }

    if (this.connectingFrom && this.canvasRef) {
      const rect = this.canvasRef.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const { x, y } = this.screenToCanvas(screenX, screenY)

      // Find which block (if any) the mouse was released over
      const targetBlock = this.blocks.find(block => {
        const isExpanded = block.isActive || block.id === this.hoveredBlockId
        const { width, height } = this.getBlockDimensionsFn(block, isExpanded)
        return (
          x >= block.x &&
          x <= block.x + width &&
          y >= block.y &&
          y <= block.y + height &&
          block.id !== this.connectingFrom
        )
      })

      runInAction(() => {
        if (targetBlock) {
          // Check if connection already exists
          const connectionExists = this.connections.some(
            conn => conn.from === this.connectingFrom && conn.to === targetBlock.id
          )
          
          // Check if reverse connection exists (bidirectional)
          const reverseExists = this.connections.some(
            conn => conn.from === targetBlock.id && conn.to === this.connectingFrom
          )
          
          if (!connectionExists) {
            // If reverse exists, remove it and add both directions
            if (reverseExists) {
              this.connections = this.connections.filter(
                conn => !(conn.from === targetBlock.id && conn.to === this.connectingFrom)
              )
            }
            // Add the new connection
            this.connections.push({
              from: this.connectingFrom,
              to: targetBlock.id
            })
            
            // Apply hierarchical layout after new connection
            if (this.autoLayoutEnabled) {
              // Delay slightly to allow the connection to be rendered first
              setTimeout(() => {
                this.applyHierarchicalLayout()
              }, 50)
            }
          }
          // Set flag to prevent canvas click from creating new block
          this.justFinishedConnecting = true
          // Reset flag after a short delay to allow normal clicks again
          setTimeout(() => {
            runInAction(() => {
              this.justFinishedConnecting = false
            })
          }, 100)
        }
        this.connectingFrom = null
        this.tempArrowEnd = null
      })
    }
  }

  removeConnection(fromId, toId) {
    runInAction(() => {
      this.connections = this.connections.filter(
        conn => !(conn.from === fromId && conn.to === toId)
      )
      // Recalculate layout after connection removal
      if (this.autoLayoutEnabled) {
        this.applyHierarchicalLayout()
      }
    })
  }

  // Apply hierarchical layout to all blocks
  applyHierarchicalLayout() {
    if (this.blocks.length === 0) return
    
    const canvasWidth = window.innerWidth
    const canvasHeight = window.innerHeight
    
    const positionMap = calculateHierarchicalLayout(
      this.blocks,
      this.connections,
      canvasWidth,
      canvasHeight
    )
    
    runInAction(() => {
      this.isAnimating = true
      this.blocks = this.blocks.map(block => {
        const newPos = positionMap.get(block.id)
        if (newPos) {
          return {
            ...block,
            x: newPos.x,
            y: newPos.y
          }
        }
        return block
      })
      
      // Clear animation flag after transition completes
      setTimeout(() => {
        runInAction(() => {
          this.isAnimating = false
        })
      }, 500)
    })
  }

  // Toggle auto layout
  toggleAutoLayout() {
    runInAction(() => {
      this.autoLayoutEnabled = !this.autoLayoutEnabled
      if (this.autoLayoutEnabled && this.connections.length > 0) {
        this.applyHierarchicalLayout()
      }
    })
  }

  // Manually trigger layout
  reorganizeLayout() {
    this.applyHierarchicalLayout()
  }

  // Fit all blocks in viewport
  fitToViewport() {
    if (this.blocks.length === 0) return
    
    const bounds = getLayoutBounds(
      new Map(this.blocks.map(b => [b.id, { x: b.x, y: b.y }])),
      this.blocks
    )
    
    if (bounds.width === 0 || bounds.height === 0) return
    
    const padding = 100
    const viewportWidth = window.innerWidth - padding * 2
    const viewportHeight = window.innerHeight - padding * 2
    
    const scaleX = viewportWidth / bounds.width
    const scaleY = viewportHeight / bounds.height
    const newScale = Math.min(scaleX, scaleY, 2) // Cap at 2x zoom
    
    runInAction(() => {
      this.scale = Math.max(0.1, newScale)
      this.panX = padding - bounds.minX * this.scale
      this.panY = padding - bounds.minY * this.scale
    })
  }

  // Convert screen coordinates to canvas coordinates
  screenToCanvas(x, y) {
    return {
      x: (x - this.panX) / this.scale,
      y: (y - this.panY) / this.scale
    }
  }

  // Convert canvas coordinates to screen coordinates
  canvasToScreen(x, y) {
    return {
      x: x * this.scale + this.panX,
      y: y * this.scale + this.panY
    }
  }

  // Start panning
  startPan(e, spacePressed = false) {
    // Only pan with space key + drag, middle mouse button, or right mouse button
    const canPan = spacePressed || e.button === 1 || e.button === 2
    
    if (!canPan) {
      return false
    }

    // Don't pan if connecting or clicking on blocks
    if (this.connectingFrom || (e.target && e.target.closest && e.target.closest('.text-block'))) {
      return false
    }

    e.preventDefault()
    runInAction(() => {
      this.isPanning = true
      this.panStartX = e.clientX
      this.panStartY = e.clientY
      this.panStartOffsetX = this.panX
      this.panStartOffsetY = this.panY
    })
    return true
  }

  // Update pan position
  updatePan(e) {
    if (!this.isPanning) return

    const deltaX = e.clientX - this.panStartX
    const deltaY = e.clientY - this.panStartY

    runInAction(() => {
      this.panX = this.panStartOffsetX + deltaX
      this.panY = this.panStartOffsetY + deltaY
    })
  }

  // Stop panning
  stopPan() {
    runInAction(() => {
      this.isPanning = false
    })
  }

  // Handle zoom
  handleZoom(e, zoomPoint = null) {
    // Check if this is a two-finger pan gesture (touchpad two-finger drag)
    // On macOS trackpad: two-finger pan sends wheel events with deltaX/deltaY
    // Pinch zoom sends deltaY with ctrl/meta key
    if (e.type === 'wheel' && !e.ctrlKey && !e.metaKey) {
      // If there's horizontal movement (deltaX), treat as two-finger pan
      if (Math.abs(e.deltaX) > 0) {
        this.handleTwoFingerPan(e)
        if (e.cancelable) {
          e.preventDefault()
        }
        return
      }
      // Pure vertical scroll (deltaY only) = zoom
    }

    // Prevent default scrolling (only if event is not passive)
    if (e.cancelable) {
      e.preventDefault()
    }

    // Get zoom point (mouse position or center of canvas)
    let pointX, pointY
    if (zoomPoint) {
      pointX = zoomPoint.x
      pointY = zoomPoint.y
    } else if (this.canvasRef) {
      const rect = this.canvasRef.getBoundingClientRect()
      pointX = e.clientX - rect.left
      pointY = e.clientY - rect.top
    } else {
      pointX = window.innerWidth / 2
      pointY = window.innerHeight / 2
    }

    // Calculate zoom delta
    let delta = 0
    if (e.type === 'wheel') {
      // Check for pinch gesture (Ctrl key on macOS, or touchpad pinch)
      if (e.ctrlKey || e.metaKey) {
        // Pinch zoom - make it more responsive
        delta = -e.deltaY * 0.02
      } else {
        // Normal scroll zoom - increase sensitivity
        delta = -e.deltaY * (e.deltaMode === 1 ? 0.1 : e.deltaMode === 2 ? 2 : 0.002)
      }
    } else if (e.type === 'gesturechange' || e.type === 'gestureend') {
      // Handle pinch gesture (if supported)
      delta = (e.scale - 1) * 0.2
    }

    // Calculate zoom factor (more aggressive for better responsiveness)
    const zoomFactor = 1 + delta * 0.3
    const newScale = Math.max(0.1, Math.min(5, this.scale * zoomFactor))

    // Calculate the point in canvas coordinates before zoom
    const canvasPoint = this.screenToCanvas(pointX, pointY)

    // Update scale
    runInAction(() => {
      this.scale = newScale
    })

    // Adjust pan to keep the zoom point fixed
    const newScreenPoint = this.canvasToScreen(canvasPoint.x, canvasPoint.y)
    runInAction(() => {
      this.panX += pointX - newScreenPoint.x
      this.panY += pointY - newScreenPoint.y
    })
  }

  // Handle two-finger panning (touchpad gesture)
  handleTwoFingerPan(e) {
    // Only pan if not connecting
    if (this.connectingFrom) {
      return
    }

    // Use deltaX and deltaY for panning
    const deltaX = -e.deltaX
    const deltaY = -e.deltaY

    runInAction(() => {
      this.panX += deltaX
      this.panY += deltaY
    })
  }

  // Reset pan and zoom
  resetView() {
    runInAction(() => {
      this.panX = 0
      this.panY = 0
      this.scale = 1
    })
  }
}

export const blocksStore = new BlocksStore()

