import { makeAutoObservable, runInAction } from 'mobx'
import { getBlockDimensions, resolveCollisions, measureTextWidth } from '../utils/blockUtils'

class BlocksStore {
  blocks = []
  activeBlockId = null
  hoveredBlockId = null
  canvasRef = null

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
    })
  }
}

export const blocksStore = new BlocksStore()

