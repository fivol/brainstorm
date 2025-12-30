export const RECOMMENDED_MODELS = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', label: 'Budget', description: 'Cheapest, good for simple tasks' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', label: 'Best Value', description: 'Great price/performance balance' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', label: 'Powerful', description: 'Strong performance, mid-range price' },
  { id: 'gpt-4o', name: 'GPT-4o', label: 'Premium', description: 'Strongest, most capable' }
]

export const fetchOpenAIModels = async (apiKey) => {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      const chatModels = data.data
        .filter((model) => {
          const id = model.id
          return id.startsWith('gpt-') && 
                 !id.includes('embedding') && 
                 !id.includes('instruct') &&
                 !id.includes(':') &&
                 (id.includes('gpt-3.5-turbo') || 
                  id.includes('gpt-4') || 
                  id.includes('gpt-4o'))
        })
        .map((model) => ({
          id: model.id,
          name: model.id
        }))
        .sort((a, b) => {
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

export const saveModelConfig = (config) => {
  localStorage.setItem('aiModelConfig', JSON.stringify(config))
}

export const loadModelConfig = () => {
  const savedModel = localStorage.getItem('aiModelConfig')
  if (savedModel) {
    try {
      return JSON.parse(savedModel)
    } catch (e) {
      console.error('Failed to parse saved model config:', e)
      return null
    }
  }
  return null
}

export const removeModelConfig = () => {
  localStorage.removeItem('aiModelConfig')
}


