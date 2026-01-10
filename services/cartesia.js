import fetch from 'node-fetch'

export class CartesiaService {
  constructor() {
    this.apiKey = process.env.CARTESIA_API_KEY
    if (!this.apiKey) {
      throw new Error('CARTESIA_API_KEY is not set')
    }

    this.apiUrl = 'https://api.cartesia.ai/tts/bytes'
    this.voiceId = process.env.CARTESIA_VOICE_ID || 'e07c00bc-4134-4eae-9ea4-1a55fb45746b'
  }

  async textToSpeech(text, retries = 2) {
    try {
      console.log('Generating speech with Cartesia...')

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)  // 15 second timeout

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Cartesia-Version': '2025-04-16',
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'  // Reuse connections
        },
        body: JSON.stringify({
          model_id: 'sonic-3',
          transcript: text,
          voice: {
            mode: 'id',
            id: this.voiceId
          },
          output_format: {
            container: 'wav',
            encoding: 'pcm_s16le',
            sample_rate: 16000
          }
        }),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Cartesia API error (${response.status}): ${errorText}`)
      }

      // Get audio as buffer
      const audioBuffer = await response.arrayBuffer()

      // Convert to base64 for transmission
      const base64Audio = Buffer.from(audioBuffer).toString('base64')

      console.log(`✅ Cartesia audio generated: ${text.substring(0, 50)}...`)
      return base64Audio

    } catch (error) {
      // Handle timeout and network errors with retry
      if (retries > 0 && (error.name === 'AbortError' || error.code === 'ECONNRESET')) {
        console.warn(`⚠️ Cartesia request failed, retrying... (${retries} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 1000))  // Wait 1s before retry
        return this.textToSpeech(text, retries - 1)
      }

      console.error('❌ Cartesia error:', error.message)
      throw new Error('Failed to generate speech')
    }
  }
}
