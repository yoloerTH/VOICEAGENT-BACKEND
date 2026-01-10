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
    this.keepAliveInterval = null
  }

  async connect() {
    try {
      console.log('Connecting to Deepgram...')

      // Create live transcription connection - optimized for speed and reliability
      this.connection = this.client.listen.live({
        model: 'nova-3',
        language: 'en',
        punctuate: false,  // Disabled for speed (we handle sentences ourselves)
        smart_format: false,  // Disabled for speed (no need for formatting)
        vad_events: true,
        interim_results: true,
        endpointing: 200,  // Reduced from 300ms for faster finalization
        utterance_end_ms: 1000  // End utterance after 1s of silence
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

      // Add warning handler for connection issues
      this.connection.on(LiveTranscriptionEvents.Warning, (warning) => {
        console.warn('⚠️ Deepgram warning:', warning)
      })

      // Monitor connection health with keep-alive
      this.setupKeepAlive()

      // Wait for connection to be ready with timeout
      await Promise.race([
        new Promise((resolve, reject) => {
          const openHandler = () => {
            this.connection.off(LiveTranscriptionEvents.Error, errorHandler)
            resolve()
          }
          const errorHandler = (error) => {
            this.connection.off(LiveTranscriptionEvents.Open, openHandler)
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

  setupKeepAlive() {
    // Send keep-alive signal every 5 seconds to maintain connection
    this.keepAliveInterval = setInterval(() => {
      if (this.connection && this.connection.getReadyState() === 1) {
        try {
          // Send empty buffer to keep connection alive
          this.connection.keepAlive()
        } catch (error) {
          console.warn('Keep-alive failed:', error.message)
        }
      }
    }, 5000)
  }

  disconnect() {
    try {
      // Clear keep-alive interval
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval)
        this.keepAliveInterval = null
      }

      if (this.connection) {
        console.log('Disconnecting from Deepgram...')
        this.connection.finish()
        this.connection = null
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

  // Check if connection is healthy
  isConnected() {
    return this.connection && this.connection.getReadyState() === 1
  }
}
