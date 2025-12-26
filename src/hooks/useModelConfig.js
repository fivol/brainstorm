import { useState, useEffect, useCallback } from 'react'
import { fetchOpenAIModels, loadModelConfig, saveModelConfig, removeModelConfig } from '../utils/modelUtils'

export const useModelConfig = () => {
  const [currentModel, setCurrentModel] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [openaiModels, setOpenaiModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)

  useEffect(() => {
    const saved = loadModelConfig()
    if (saved) {
      setCurrentModel(saved)
    }
  }, [])

  useEffect(() => {
    if (selectedProvider === 'openai' && apiKey && apiKey.length > 10 && !openaiModels.length && !loadingModels) {
      const timeoutId = setTimeout(async () => {
        setLoadingModels(true)
        const models = await fetchOpenAIModels(apiKey)
        setOpenaiModels(models)
        setLoadingModels(false)
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [apiKey, selectedProvider, openaiModels.length, loadingModels])

  const handleOpenModal = useCallback(() => {
    if (currentModel) {
      setSelectedProvider(currentModel.provider)
      setSelectedModel(currentModel.model)
      setApiKey(currentModel.apiKey)
      if (currentModel.provider === 'openai' && currentModel.apiKey) {
        fetchOpenAIModels(currentModel.apiKey).then(setOpenaiModels)
      }
    }
    setShowModal(true)
  }, [currentModel])

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
    setSelectedProvider('')
    setSelectedModel('')
    setApiKey('')
    setOpenaiModels([])
    setLoadingModels(false)
  }, [])

  const handleSave = useCallback(() => {
    if (!selectedProvider || !selectedModel || !apiKey) {
      alert('Please fill in all fields')
      return
    }

    const config = {
      provider: selectedProvider,
      model: selectedModel,
      apiKey: apiKey
    }

    saveModelConfig(config)
    setCurrentModel(config)
    handleCloseModal()
  }, [selectedProvider, selectedModel, apiKey, handleCloseModal])

  const handleRemove = useCallback(() => {
    if (window.confirm('Remove current model configuration?')) {
      removeModelConfig()
      setCurrentModel(null)
      handleCloseModal()
    }
  }, [handleCloseModal])

  return {
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
  }
}

