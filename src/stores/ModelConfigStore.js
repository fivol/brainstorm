import { makeAutoObservable, runInAction } from 'mobx'
import { fetchOpenAIModels, loadModelConfig, saveModelConfig, removeModelConfig } from '../utils/modelUtils'

class ModelConfigStore {
  currentModel = null
  showModal = false
  selectedProvider = ''
  selectedModel = ''
  apiKey = ''
  openaiModels = []
  loadingModels = false
  fetchTimeoutId = null

  constructor() {
    makeAutoObservable(this)
    this.loadSavedConfig()
  }

  loadSavedConfig() {
    const saved = loadModelConfig()
    if (saved) {
      runInAction(() => {
        this.currentModel = saved
      })
    }
  }

  fetchModels() {
    if (this.fetchTimeoutId) {
      clearTimeout(this.fetchTimeoutId)
    }

    if (this.selectedProvider === 'openai' && this.apiKey && this.apiKey.length > 10 && !this.openaiModels.length && !this.loadingModels) {
      this.fetchTimeoutId = setTimeout(async () => {
        runInAction(() => {
          this.loadingModels = true
        })
        
        const models = await fetchOpenAIModels(this.apiKey)
        
        runInAction(() => {
          this.openaiModels = models
          this.loadingModels = false
        })
      }, 500)
    }
  }

  setSelectedProvider(value) {
    runInAction(() => {
      this.selectedProvider = value
      this.selectedModel = ''
      this.openaiModels = []
      this.loadingModels = false
    })
    this.fetchModels()
  }

  setSelectedModel(value) {
    this.selectedModel = value
  }

  setApiKey(value) {
    this.apiKey = value
    this.fetchModels()
  }

  handleOpenModal() {
    if (this.currentModel) {
      runInAction(() => {
        this.selectedProvider = this.currentModel.provider
        this.selectedModel = this.currentModel.model
        this.apiKey = this.currentModel.apiKey
      })
      if (this.currentModel.provider === 'openai' && this.currentModel.apiKey) {
        fetchOpenAIModels(this.currentModel.apiKey).then(models => {
          runInAction(() => {
            this.openaiModels = models
          })
        })
      }
    }
    this.showModal = true
  }

  handleCloseModal() {
    runInAction(() => {
      this.showModal = false
      this.selectedProvider = ''
      this.selectedModel = ''
      this.apiKey = ''
      this.openaiModels = []
      this.loadingModels = false
    })
    if (this.fetchTimeoutId) {
      clearTimeout(this.fetchTimeoutId)
    }
  }

  handleSave() {
    if (!this.selectedProvider || !this.selectedModel || !this.apiKey) {
      alert('Please fill in all fields')
      return
    }

    const config = {
      provider: this.selectedProvider,
      model: this.selectedModel,
      apiKey: this.apiKey
    }

    saveModelConfig(config)
    runInAction(() => {
      this.currentModel = config
    })
    this.handleCloseModal()
  }

  handleRemove() {
    if (window.confirm('Remove current model configuration?')) {
      removeModelConfig()
      runInAction(() => {
        this.currentModel = null
      })
      this.handleCloseModal()
    }
  }
}

export const modelConfigStore = new ModelConfigStore()

