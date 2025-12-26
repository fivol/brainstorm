import React from 'react'
import './App.css'
import { Canvas } from './components/Canvas'
import { FloatingButtons } from './components/FloatingButtons'
import { ModelModal } from './components/ModelModal'
import { useBlocks } from './hooks/useBlocks'
import { useModelConfig } from './hooks/useModelConfig'

function App() {
  const {
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
  } = useBlocks()

  const {
    currentModel,
    showModal,
    selectedProvider,
    selectedModel,
    apiKey,
    openaiModels,
    loadingModels,
    setSelectedProvider,
    setSelectedModel,
    setApiKey,
    handleOpenModal,
    handleCloseModal,
    handleSave,
    handleRemove
  } = useModelConfig()

  const handleProviderChange = (e) => {
    setSelectedProvider(e.target.value)
    setSelectedModel('')
  }

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value)
  }

  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId)
  }

  return (
    <>
      <Canvas
        blocks={blocks}
        activeBlockId={activeBlockId}
        hoveredBlockId={hoveredBlockId}
        canvasRef={canvasRef}
        getBlockDimensions={getBlockDimensionsFn}
        onCanvasClick={handleCanvasClick}
        onBlockClick={handleBlockClick}
        onTextChange={handleTextChange}
        onBlockBlur={handleBlockBlur}
        onBlockMouseEnter={handleBlockMouseEnter}
        onBlockMouseLeave={handleBlockMouseLeave}
      />
      <FloatingButtons
        hasModel={!!currentModel}
        hasBlocks={blocks.length > 0}
        onModelClick={handleOpenModal}
        onRemoveAllClick={handleRemoveAll}
      />
      {showModal && (
        <ModelModal
          currentModel={currentModel}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          apiKey={apiKey}
          openaiModels={openaiModels}
          loadingModels={loadingModels}
          onProviderChange={handleProviderChange}
          onModelChange={handleModelChange}
          onModelSelect={handleModelSelect}
          onApiKeyChange={(e) => setApiKey(e.target.value)}
          onClose={handleCloseModal}
          onSave={handleSave}
          onRemove={handleRemove}
        />
      )}
    </>
  )
}

export default App
