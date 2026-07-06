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

const customA: ModelConfig = { ...saved, providerId: 'custom', customModelId: 'custom-a', displayName: '公司模型' }
const customB: ModelConfig = { ...saved, providerId: 'custom', customModelId: 'custom-b', displayName: '备用模型', apiKey: '' }
assert.equal(resolveModelConfigForSave({ ...customA, model: 'other-model', apiKey: '' }, [customA]).apiKey, customA.apiKey)
assert.equal(resolveModelConfigForSave(customB, [customA]).apiKey, '')

const legacyCustom = { ...saved, providerId: 'custom', displayName: '旧名字', _id: 'legacy-custom-id' }
assert.equal(
  resolveModelConfigForSave({ ...legacyCustom, customModelId: 'legacy-custom-id', displayName: '新名字', apiKey: '' }, [legacyCustom]).apiKey,
  legacyCustom.apiKey
)

const mifyA: ModelConfig = { ...saved, providerId: 'mify', customProviderId: 'xiaomi', model: 'mimo-v2.5-pro' }
const mifyB: ModelConfig = { ...mifyA, customProviderId: 'ppio', model: 'pa/claude-sonnet-5', apiKey: '' }
assert.equal(resolveModelConfigForSave(mifyB, [mifyA]).apiKey, mifyA.apiKey)

assert.ok(validateModelConfig({ apiKey: '帮我写一份报告' }))
assert.ok(validateModelConfig({ apiKey: 'sk-user key' }))
assert.equal(validateModelConfig({ apiKey: 'sk-valid-user-key' }), null)
