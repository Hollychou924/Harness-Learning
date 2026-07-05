import assert from 'node:assert/strict'
import {
  resolveModelConfigForSave,
  sanitizeModelConfigForRenderer,
  validateModelConfig,
  type ModelConfig
} from './model-config.js'

const saved: ModelConfig = {
  providerId: 'openai',
  model: 'gpt-4.1',
  apiKey: 'sk-saved-user-key',
  apiBaseUrl: 'https://api.openai.com',
  apiFormat: 'openai',
  contextLimit: 128000
}

assert.deepEqual(sanitizeModelConfigForRenderer(saved), {
  ...saved,
  apiKey: '',
  hasSavedApiKey: true
})

assert.equal(resolveModelConfigForSave({ ...saved, apiKey: '' }, [saved]).apiKey, saved.apiKey)
assert.equal(resolveModelConfigForSave({ ...saved, model: 'gpt-4.1-mini', apiKey: '' }, [saved]).apiKey, saved.apiKey)
assert.equal(resolveModelConfigForSave({ ...saved, apiKey: 'sk-new-user-key' }, [saved]).apiKey, 'sk-new-user-key')

assert.ok(validateModelConfig({ apiKey: '帮我写一份报告' }))
assert.ok(validateModelConfig({ apiKey: 'sk-user key' }))
assert.equal(validateModelConfig({ apiKey: 'sk-valid-user-key' }), null)
