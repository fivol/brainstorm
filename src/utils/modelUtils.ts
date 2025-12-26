export interface Model {
  id: string
  name: string
}

export interface RecommendedModel {
  id: string
  name: string
  label: string
  description: string
}

export interface ModelConfig {
  provider: string
  model: string
  apiKey: string
}

export const RECOMMENDED_MODELS: RecommendedModel[] = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', label: 'Budget', description: 'Cheapest, good for simple tasks' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', label: 'Best Value', description: 'Great price/performance balance' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', label: 'Powerful', description: 'Strong performance, mid-range price' },
  { id: 'gpt-4o', name: 'GPT-4o', label: 'Premium', description: 'Strongest, most capable' }
]

export const fetchOpenAIModels = async (apiKey: string): Promise<Model[]> => {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      // Filter for chat completion models only
      const chatModels = data.data
        .filter((model: { id: string }) => {
          const id = model.id
          return id.startsWith('gpt-') && 
                 !id.includes('embedding') && 
                 !id.includes('instruct') &&
                 !id.includes(':') &&
                 (id.includes('gpt-3.5-turbo') || 
                  id.includes('gpt-4') || 
                  id.includes('gpt-4o'))
        })
        .map((model: { id: string }) => ({
          id: model.id,
          name: model.id
        }))
        .sort((a: Model, b: Model) => {
          const aIndex = RECOMMENDED_MODELS.findIndex(m => m.id === a.id)
          const bIndex = RECOMMENDED_MODELS.findIndex(m => m.id === b.id)
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
          if (aIndex !== -1) return -1
          if (bIndex !== -1) return 1
          return a.id.localeCompare(b.id)
        })
      return chatModels
    } else {
      return RECOMMENDED_MODELS.map(m => ({ id: m.id, name: m.name }))
    }
  } catch (error) {
    console.error('Failed to fetch OpenAI models:', error)
    return RECOMMENDED_MODELS.map(m => ({ id: m.id, name: m.name }))
  }
}

export const saveModelConfig = (config: ModelConfig): void => {
  localStorage.setItem('aiModelConfig', JSON.stringify(config))
}

export const loadModelConfig = (): ModelConfig | null => {
  const savedModel = localStorage.getItem('aiModelConfig')
  if (savedModel) {
    try {
      return JSON.parse(savedModel) as ModelConfig
    } catch (e) {
      console.error('Failed to parse saved model config:', e)
      return null
    }
  }
  return null
}

export const removeModelConfig = (): void => {
  localStorage.removeItem('aiModelConfig')
}

