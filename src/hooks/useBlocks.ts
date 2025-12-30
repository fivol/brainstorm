import { useState, useCallback, useRef } from 'react'
import type { Block } from '../utils/blockUtils'
import { getBlockDimensions, resolveCollisions, measureTextWidth } from '../utils/blockUtils'

export const useBlocks = () => {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null)
  const [hoveredBlockId, setHoveredBlockId] = useState<number | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const getBlockDimensionsFn = useCallback((block: Block, isExpanded: boolean) => {
    return getBlockDimensions(block, isExpanded, measureTextWidth)
  }, [])

  const resolveCollisionsFn = useCallback((blocksToResolve: Block[], activeId: number | null, hoveredId: number | null) => {
    return resolveCollisions(blocksToResolve, activeId, hoveredId, getBlockDimensionsFn)
  }, [getBlockDimensionsFn])

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const newBlock: Block = {
        id: Date.now(),
        x,
        y,
        text: '',
        width: 200,
        height: 100,
        isActive: true,
        isCollapsed: false
      }

      setBlocks(prevBlocks => {
        const updated = [...prevBlocks, newBlock]
        return resolveCollisionsFn(updated, newBlock.id, null)
      })
      setActiveBlockId(newBlock.id)
    }
  }, [resolveCollisionsFn])

  const handleBlockClick = useCallback((e: React.MouseEvent, blockId: number) => {
    e.stopPropagation()
    setActiveBlockId(blockId)
    setBlocks(prevBlocks => {
      const updated = prevBlocks.map(block =>
        block.id === blockId ? { ...block, isActive: true, isCollapsed: false } : block
      )
      return resolveCollisionsFn(updated, blockId, hoveredBlockId)
    })
  }, [resolveCollisionsFn, hoveredBlockId])

  const handleTextChange = useCallback((blockId: number, text: string) => {
    setBlocks(prevBlocks => prevBlocks.map(block =>
      block.id === blockId ? { ...block, text } : block
    ))
  }, [])

  const handleBlockBlur = useCallback((blockId: number) => {
    setActiveBlockId(null)
    setBlocks(prevBlocks => {
      const block = prevBlocks.find(b => b.id === blockId)
      if (!block || !block.text.trim()) {
        return prevBlocks.filter(b => b.id !== blockId)
      }
      const updated = prevBlocks.map(b =>
        b.id === blockId
          ? { ...b, isActive: false, isCollapsed: true }
          : b
      )
      return resolveCollisionsFn(updated, null, hoveredBlockId)
    })
  }, [resolveCollisionsFn, hoveredBlockId])

  const handleBlockMouseEnter = useCallback((blockId: number) => {
    setHoveredBlockId(blockId)
    setBlocks(prevBlocks => {
      const updated = prevBlocks.map(block =>
        block.id === blockId && !block.isActive
          ? { ...block, isCollapsed: false }
          : block
      )
      return resolveCollisionsFn(updated, activeBlockId, blockId)
    })
  }, [resolveCollisionsFn, activeBlockId])

  const handleBlockMouseLeave = useCallback((blockId: number) => {
    setHoveredBlockId(null)
    setBlocks(prevBlocks => {
      const updated = prevBlocks.map(b =>
        b.id === blockId && !b.isActive && b.text.trim()
          ? { ...b, isCollapsed: true }
          : b
      )
      return resolveCollisionsFn(updated, activeBlockId, null)
    })
  }, [resolveCollisionsFn, activeBlockId])

  const handleRemoveAll = useCallback(() => {
    setBlocks([])
    setActiveBlockId(null)
    setHoveredBlockId(null)
  }, [])

  return {
    blocks,
    activeBlockId,
    hoveredBlockId,
    canvasRef,
    handleCanvasClick,
    handleBlockClick,
    handleTextChange,
    handleBlockBlur,
    handleBlockMouseEnter,
    handleBlockMouseLeave,
    handleRemoveAll,
    getBlockDimensionsFn
  }
}


