import { makeAutoObservable, runInAction } from 'mobx'
import { getBlockDimensions, resolveCollisions, measureTextWidth } from '../utils/blockUtils'

class BlocksStore {
  blocks = []
  activeBlockId = null
  hoveredBlockId = null
  canvasRef = null
  connections = [] // Array of { from: blockId, to: blockId }
  connectingFrom = null // blockId when user is dragging to create connection
  tempArrowEnd = null // { x, y } for temporary arrow while dragging

  constructor() {
    makeAutoObservable(this)
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
    // Don't create new nodes when connecting
    if (this.connectingFrom) {
      return
    }
    
    if (e.target === this.canvasRef) {
      const rect = this.canvasRef.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

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
    if (this.connectingFrom && this.canvasRef) {
      const rect = this.canvasRef.getBoundingClientRect()
      runInAction(() => {
        this.tempArrowEnd = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
      })
    }
  }

  handleCanvasMouseUp(e) {
    if (this.connectingFrom && this.canvasRef) {
      const rect = this.canvasRef.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

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
          }
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
    })
  }
}

export const blocksStore = new BlocksStore()

