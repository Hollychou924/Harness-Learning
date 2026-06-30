const DASH_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return }
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) { res.status(500).json({ error: 'missing_api_key' }); return }
  const body = req.body || {}
  const topic = body.topic || ''
  const messages = body.messages || [{ role: 'user', content: `研究一下${topic}` }]
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-DashScope-SSE': 'enable'
  }

  const step1Payload = { model: 'qwen-deep-research', input: { messages } }
  const resp1 = await fetch(DASH_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(step1Payload) })
  if (!resp1.ok) { res.status(resp1.status).json({ error: 'step1_failed' }); return }
  const reader1 = resp1.body.getReader()
  const decoder = new TextDecoder()
  let clarification = ''
  while (true) {
    const { value, done } = await reader1.read()
    if (done) break
    const text = decoder.decode(value)
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const jsonStr = line.slice(5).trim()
        if (jsonStr === '[DONE]') continue
        try {
          const obj = JSON.parse(jsonStr)
          const output = obj.output
          if (output && output.message && output.message.content) clarification += output.message.content
        } catch {}
      }
    }
  }
  if (!clarification) clarification = '直接开始研究'

  const step2Messages = [
    { role: 'user', content: messages[0].content },
    { role: 'assistant', content: clarification },
    { role: 'user', content: '直接开始研究' }
  ]
  const step2Payload = { model: 'qwen-deep-research', input: { messages: step2Messages } }
  const resp2 = await fetch(DASH_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(step2Payload) })
  if (!resp2.ok) { res.status(resp2.status).json({ error: 'step2_failed' }); return }
  const reader2 = resp2.body.getReader()
  let finalText = ''
  let refs = []
  while (true) {
    const { value, done } = await reader2.read()
    if (done) break
    const chunk = decoder.decode(value)
    const lines = chunk.split(/\r?\n/)
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const js = line.slice(5).trim()
        if (js === '[DONE]') continue
        try {
          const obj = JSON.parse(js)
          const output = obj.output
          if (output && output.message) {
            const m = output.message
            if (m.content) finalText += m.content
            if (m.phase === 'answer' && m.extra && m.extra.deep_research && m.extra.deep_research.references) refs = m.extra.deep_research.references
          }
        } catch {}
      }
    }
  }
  res.status(200).json({ report: finalText, references: refs })
}
