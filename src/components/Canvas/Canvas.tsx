import React, { useMemo } from 'react'
import { TextBlock } from '../TextBlock'
import type { Block } from '../../utils/blockUtils'

interface CanvasProps {
  blocks: Block[]
  activeBlockId: number | null
  hoveredBlockId: number | null
  canvasRef: React.RefObject<HTMLDivElement>
  getBlockDimensions: (block: Block, isExpanded: boolean) => { width: number; height: number }
  onCanvasClick: (e: React.MouseEvent<HTMLDivElement>) => void
  onBlockClick: (e: React.MouseEvent, blockId: number) => void
  onTextChange: (blockId: number, text: string) => void
  onBlockBlur: (blockId: number) => void
  onBlockMouseEnter: (blockId: number) => void
  onBlockMouseLeave: (blockId: number) => void
}

export const Canvas: React.FC<CanvasProps> = ({
  blocks,
  activeBlockId,
  hoveredBlockId,
  canvasRef,
  getBlockDimensions,
  onCanvasClick,
  onBlockClick,
  onTextChange,
  onBlockBlur,
  onBlockMouseEnter,
  onBlockMouseLeave
}) => {
  const renderedBlocks = useMemo(() => {
    return blocks.map(block => {
      const isExpanded = block.isActive || block.id === hoveredBlockId
      const isFullyCollapsed = block.isCollapsed && !isExpanded && block.text.length > 50
      const { width: displayWidth, height: displayHeight } = getBlockDimensions(block, isExpanded)
      
      let displayText = block.text
      if (isFullyCollapsed) {
        displayText = block.text.charAt(0).toUpperCase() || ''
      } else if (!isExpanded && block.text.trim()) {
        const firstLine = block.text.split('\n')[0]
        displayText = firstLine.length > 50 ? firstLine.substring(0, 50) : firstLine
      }

      return (
        <TextBlock
          key={block.id}
          block={block}
          isExpanded={isExpanded}
          isFullyCollapsed={isFullyCollapsed}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
          displayText={displayText}
          onBlockClick={onBlockClick}
          onTextChange={onTextChange}
          onBlockBlur={onBlockBlur}
          onMouseEnter={onBlockMouseEnter}
          onMouseLeave={onBlockMouseLeave}
        />
      )
    })
  }, [blocks, hoveredBlockId, activeBlockId, getBlockDimensions, onBlockClick, onTextChange, onBlockBlur, onBlockMouseEnter, onBlockMouseLeave])

  return (
    <div 
      ref={canvasRef}
      className="canvas" 
      onClick={onCanvasClick}
    >
      {renderedBlocks}
    </div>
  )
}


