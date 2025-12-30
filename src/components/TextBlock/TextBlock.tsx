import React from 'react'
import type { Block } from '../../utils/blockUtils'

interface TextBlockProps {
  block: Block
  isExpanded: boolean
  isFullyCollapsed: boolean
  displayWidth: number
  displayHeight: number
  displayText: string
  onBlockClick: (e: React.MouseEvent, blockId: number) => void
  onTextChange: (blockId: number, text: string) => void
  onBlockBlur: (blockId: number) => void
  onMouseEnter: (blockId: number) => void
  onMouseLeave: (blockId: number) => void
}

export const TextBlock: React.FC<TextBlockProps> = ({
  block,
  isExpanded,
  isFullyCollapsed,
  displayWidth,
  displayHeight,
  displayText,
  onBlockClick,
  onTextChange,
  onBlockBlur,
  onMouseEnter,
  onMouseLeave
}) => {
  return (
    <div
      className={`text-block ${block.isActive ? 'active' : ''} ${isFullyCollapsed ? 'collapsed-circle' : ''}`}
      style={{
        left: `${block.x}px`,
        top: `${block.y}px`,
        ...(isFullyCollapsed || (block.isCollapsed && !isExpanded) ? { width: `${displayWidth}px` } : {}),
        height: `${displayHeight}px`,
      }}
      onClick={(e) => onBlockClick(e, block.id)}
      onMouseEnter={() => onMouseEnter(block.id)}
      onMouseLeave={() => onMouseLeave(block.id)}
    >
      {block.isActive ? (
        <textarea
          value={block.text}
          onChange={(e) => onTextChange(block.id, e.target.value)}
          onBlur={() => onBlockBlur(block.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.target.blur()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.target.blur()
            }
          }}
          autoFocus
          className="text-input"
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      ) : (
        <div className="text-display">
          {isFullyCollapsed ? (
            <span className="circle-letter">{displayText}</span>
          ) : (
            displayText || 'Click to edit'
          )}
        </div>
      )}
    </div>
  )
}


