import React from 'react'

interface FloatingButtonsProps {
  hasModel: boolean
  hasBlocks: boolean
  onModelClick: () => void
  onRemoveAllClick: () => void
}

export const FloatingButtons: React.FC<FloatingButtonsProps> = ({
  hasModel,
  hasBlocks,
  onModelClick,
  onRemoveAllClick
}) => {
  return (
    <div className="floating-buttons">
      <button 
        className="floating-button model-button"
        onClick={(e) => {
          e.stopPropagation()
          onModelClick()
        }}
      >
        {hasModel ? 'Change Model' : 'Add Model'}
      </button>
      <button 
        className="floating-button remove-all-button"
        onClick={(e) => {
          e.stopPropagation()
          if (hasBlocks && window.confirm('Remove all blocks?')) {
            onRemoveAllClick()
          }
        }}
      >
        Remove All
      </button>
    </div>
  )
}

