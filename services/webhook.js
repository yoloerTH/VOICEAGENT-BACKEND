import axios from 'axios'

export class WebhookService {
  constructor() {
    this.webhookUrl = process.env.N8N_WEBHOOK_URL

    if (!this.webhookUrl) {
      console.warn('N8N_WEBHOOK_URL not configured')
    }
  }

  async sendBooking(bookingData, retries = 2) {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not configured')
    }

    try {
      console.log('📤 Sending booking to n8n:', bookingData)

      const response = await axios.post(this.webhookUrl, {
        name: bookingData.name,
        datetime: bookingData.datetime,
        details: bookingData.details,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'  // Reuse connections
        },
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 500  // Don't throw on 4xx
      })

      if (response.status >= 400) {
        throw new Error(`n8n returned ${response.status}: ${JSON.stringify(response.data)}`)
      }

      console.log('✅ Booking sent successfully to n8n')
      return { success: true, data: response.data }

    } catch (error) {
      // Retry on network errors
      if (retries > 0 && (!error.response || error.code === 'ECONNABORTED')) {
        console.warn(`⚠️ Webhook request failed, retrying... (${retries} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 1000))  // Wait 1s before retry
        return this.sendBooking(bookingData, retries - 1)
      }

      console.error('❌ Failed to send booking to n8n:', error.message)
      console.error('❌ Webhook URL:', this.webhookUrl)
      console.error('❌ Status:', error.response?.status)
      console.error('❌ Response:', error.response?.data)
      throw new Error('Failed to register booking')
    }
  }
}
