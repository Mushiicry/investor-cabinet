const DEFAULT_BASE_URL = 'https://investor-cabinet.vercel.app'

const baseUrl = (process.env.INVESTOR_SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
const bearerToken = process.env.INVESTOR_SMOKE_BEARER_TOKEN || ''

const endpoints = [
  { name: 'main', path: '/api/investor' },
  { name: 'wife', path: '/api/investor-wife' },
]

const requiredLiveKeys = ['success', 'overview', 'portfolio']

const readResponseBody = async (response) => {
  const text = await response.text()

  try {
    return { text, json: JSON.parse(text) }
  } catch {
    return { text, json: null }
  }
}

const describeBody = (body) => {
  if (body.json) {
    return JSON.stringify(body.json).slice(0, 320)
  }

  return body.text.replace(/\s+/g, ' ').slice(0, 320)
}

const checkPrivateResponse = (name, response, body) => {
  if (response.status !== 401) {
    throw new Error(
      `${name}: expected 401 Unauthorized without bearer token, got ${response.status} ${response.statusText}: ${describeBody(body)}`,
    )
  }

  const error = body.json?.error
  if (error !== 'Unauthorized') {
    throw new Error(`${name}: expected JSON error "Unauthorized", got: ${describeBody(body)}`)
  }
}

const checkLiveResponse = (name, response, body) => {
  if (!response.ok) {
    throw new Error(`${name}: expected 2xx with bearer token, got ${response.status} ${response.statusText}: ${describeBody(body)}`)
  }

  if (!body.json) {
    throw new Error(`${name}: expected JSON response, got: ${describeBody(body)}`)
  }

  const missingKeys = requiredLiveKeys.filter((key) => !(key in body.json))
  if (missingKeys.length) {
    throw new Error(`${name}: response is missing keys: ${missingKeys.join(', ')}`)
  }
}

const smokeEndpoint = async ({ name, path }) => {
  const headers = { accept: 'application/json' }
  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`
  }

  const response = await fetch(`${baseUrl}${path}`, { headers })
  const body = await readResponseBody(response)

  if (bearerToken) {
    checkLiveResponse(name, response, body)
    console.log(`ok ${name}: authenticated response ${response.status}`)
    return
  }

  checkPrivateResponse(name, response, body)
  console.log(`ok ${name}: unauthenticated request rejected with ${response.status}`)
}

for (const endpoint of endpoints) {
  await smokeEndpoint(endpoint)
}
