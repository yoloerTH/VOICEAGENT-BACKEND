import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

export class DeepgramService {
  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY
    if (!this.apiKey) {
      throw new Error('DEEPGRAM_API_KEY is not set')
    }

    this.client = createClient(this.apiKey)
    this.connection = null
    this.transcriptCallback = null
    this.errorCallback = null
    this.audioSent = false
    this.keepaliveInterval = null
  }

  async connect() {
    try {
      console.log('Connecting to Deepgram...')

      // Create live transcription connection - optimized for speed
      this.connection = this.client.listen.live({
        model: 'nova-3',
        language: 'en',
        punctuate: false,  // Disabled for speed (we don't need it for triggering)
        smart_format: false,  // Disabled for speed (removes formatting overhead)
        vad_events: true,
        interim_results: true,
        endpointing: 150,  // Aggressive: 150ms silence before finalizing
        encoding: 'linear16',  // Explicit encoding for better performance
        sample_rate: 16000,  // Match frontend sample rate
        channels: 1  // Mono audio
      })

      // Setup event handlers
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Deepgram connection opened successfully')
      })

      this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        try {
          const transcript = data.channel?.alternatives?.[0]?.transcript

          if (transcript && transcript.trim() !== '') {
            // Pass full data object for aggressive triggering logic
            if (this.transcriptCallback) {
              this.transcriptCallback({
                text: transcript,
                is_final: data.is_final,
                speech_final: data.speech_final,
                confidence: data.channel?.alternatives?.[0]?.confidence || 0
              })
            }
          }
        } catch (error) {
          console.error('Error processing transcript:', error)
        }
      })

      this.connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('❌ Deepgram WebSocket error:', error)
        if (this.errorCallback) {
          this.errorCallback(error)
        }
      })

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed')
      })

      this.connection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
        console.log('Deepgram metadata:', metadata)
      })

      // Wait for connection to be ready with timeout
      await Promise.race([
        new Promise((resolve, reject) => {
          const openHandler = () => {
            if (this.connection) {
              this.connection.off(LiveTranscriptionEvents.Error, errorHandler)
            }
            resolve()
          }
          const errorHandler = (error) => {
            if (this.connection) {
              this.connection.off(LiveTranscriptionEvents.Open, openHandler)
            }
            reject(error)
          }

          this.connection.once(LiveTranscriptionEvents.Open, openHandler)
          this.connection.once(LiveTranscriptionEvents.Error, errorHandler)
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Deepgram connection timeout after 10s')), 10000)
        )
      ])

      console.log('✅ Deepgram connection established successfully')

      // Start keepalive to prevent connection from closing during silence
      // Send empty buffer every 5 seconds to keep connection alive
      this.keepaliveInterval = setInterval(() => {
        if (this.connection && this.connection.getReadyState() === 1) {
          // Send small silence packet (1 sample of silence)
          const silencePacket = Buffer.alloc(2) // 2 bytes = 1 sample at 16-bit
          this.connection.send(silencePacket)
        }
      }, 5000) // Every 5 seconds

    } catch (error) {
      console.error('❌ Failed to connect to Deepgram:', error)

      if (error.message && error.message.includes('400')) {
        console.error('Deepgram 400 Error - Possible causes:')
        console.error('1. Model "nova-3" not available on your plan')
        console.error('2. Invalid parameters for your tier')
        console.error('3. API key permissions issue')
      }

      throw new Error(`Deepgram connection failed: ${error.message || 'Unknown error'}`)
    }
  }

  send(audioData) {
    try {
      if (this.connection && this.connection.getReadyState() === 1) {
        this.connection.send(audioData)
        // Log first time audio is sent
        if (!this.audioSent) {
          console.log('📤 Started sending audio to Deepgram')
          this.audioSent = true
        }
      } else {
        console.warn('Deepgram connection not ready, state:', this.connection?.getReadyState())
      }
    } catch (error) {
      console.error('Error sending audio to Deepgram:', error)
    }
  }

  disconnect() {
    try {
      // Clear keepalive interval first
      if (this.keepaliveInterval) {
        clearInterval(this.keepaliveInterval)
        this.keepaliveInterval = null
      }

      // Store reference and clear immediately to prevent race conditions
      const connection = this.connection
      this.connection = null

      if (connection) {
        console.log('Disconnecting from Deepgram...')
        try {
          connection.finish()
        } catch (err) {
          console.warn('Error calling finish on Deepgram connection:', err.message)
        }
      }
    } catch (error) {
      console.error('Error disconnecting from Deepgram:', error)
    }
  }

  onTranscript(callback) {
    this.transcriptCallback = callback
  }

  onError(callback) {
    this.errorCallback = callback
  }
}
