import React from 'react'
import { observer } from 'mobx-react-lite'
import { blocksStore, modelConfigStore } from '../../stores'

export const FloatingButtons = observer(() => {
  return (
    <div className="floating-buttons">
      <button 
        className="floating-button model-button"
        onClick={(e) => {
          e.stopPropagation()
          modelConfigStore.handleOpenModal()
        }}
      >
        {modelConfigStore.currentModel ? 'Change Model' : 'Add Model'}
      </button>
      <button 
        className="floating-button remove-all-button"
        onClick={(e) => {
          e.stopPropagation()
          if (blocksStore.blocks.length > 0 && window.confirm('Remove all blocks?')) {
            blocksStore.handleRemoveAll()
          }
        }}
      >
        Remove All
      </button>
    </div>
  )
})
