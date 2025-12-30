import { useState, useCallback, useRef } from 'react'
import { getBlockDimensions, resolveCollisions, measureTextWidth } from '../utils/blockUtils'

export const useBlocks = () => {
  const [blocks, setBlocks] = useState([])
  const [activeBlockId, setActiveBlockId] = useState(null)
  const [hoveredBlockId, setHoveredBlockId] = useState(null)
  const canvasRef = useRef(null)

  const getBlockDimensionsFn = useCallback((block, isExpanded) => {
    return getBlockDimensions(block, isExpanded, measureTextWidth)
  }, [])

  const resolveCollisionsFn = useCallback((blocksToResolve, activeId, hoveredId) => {
    return resolveCollisions(blocksToResolve, activeId, hoveredId, getBlockDimensionsFn)
  }, [getBlockDimensionsFn])

  const handleCanvasClick = useCallback((e) => {
    if (e.target === canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
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

      setBlocks(prevBlocks => {
        const updated = [...prevBlocks, newBlock]
        return resolveCollisionsFn(updated, newBlock.id, null)
      })
      setActiveBlockId(newBlock.id)
    }
  }, [resolveCollisionsFn])

  const handleBlockClick = useCallback((e, blockId) => {
    e.stopPropagation()
    setActiveBlockId(blockId)
    setBlocks(prevBlocks => {
      const updated = prevBlocks.map(block =>
        block.id === blockId ? { ...block, isActive: true, isCollapsed: false } : block
      )
      return resolveCollisionsFn(updated, blockId, hoveredBlockId)
    })
  }, [resolveCollisionsFn, hoveredBlockId])

  const handleTextChange = useCallback((blockId, text) => {
    setBlocks(prevBlocks => prevBlocks.map(block =>
      block.id === blockId ? { ...block, text } : block
    ))
  }, [])

  const handleBlockBlur = useCallback((blockId) => {
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

  const handleBlockMouseEnter = useCallback((blockId) => {
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

  const handleBlockMouseLeave = useCallback((blockId) => {
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


