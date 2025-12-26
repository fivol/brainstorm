import React, { useRef, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { blocksStore } from '../../stores'

export const TextBlock = observer(({
  block,
  isExpanded,
  isFullyCollapsed,
  displayWidth,
  displayHeight,
  displayText
}) => {
  const textareaRef = useRef(null)

  useEffect(() => {
    // Set cursor to end of text when block becomes active
    if (block.isActive && textareaRef.current) {
      const textarea = textareaRef.current
      const length = textarea.value.length
      textarea.setSelectionRange(length, length)
    }
  }, [block.isActive])

  return (
    <div
      className={`text-block ${block.isActive ? 'active' : ''} ${isFullyCollapsed ? 'collapsed-circle' : ''}`}
      style={{
        left: `${block.x}px`,
        top: `${block.y}px`,
        ...(isFullyCollapsed || (block.isCollapsed && !isExpanded) ? { width: `${displayWidth}px` } : {}),
        height: `${displayHeight}px`,
      }}
      onClick={(e) => blocksStore.handleBlockClick(e, block.id)}
      onMouseDown={(e) => blocksStore.handleBlockMouseDown(e, block.id)}
      onMouseEnter={() => blocksStore.handleBlockMouseEnter(block.id)}
      onMouseLeave={() => blocksStore.handleBlockMouseLeave(block.id)}
    >
      {block.isActive ? (
        <textarea
          ref={textareaRef}
          value={block.text}
          onChange={(e) => blocksStore.handleTextChange(block.id, e.target.value)}
          onBlur={() => blocksStore.handleBlockBlur(block.id)}
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
})
