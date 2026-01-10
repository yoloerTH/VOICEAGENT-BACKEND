import axios from 'axios'

export class WebhookService {
  constructor() {
    this.webhookUrl = process.env.N8N_WEBHOOK_URL

    if (!this.webhookUrl) {
      console.warn('N8N_WEBHOOK_URL not configured')
    }
  }

  async sendBooking(bookingData) {
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
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })

      console.log('✅ Booking sent successfully to n8n')
      return { success: true, data: response.data }

    } catch (error) {
      console.error('❌ Failed to send booking to n8n:', error.message)
      console.error('❌ Webhook URL:', this.webhookUrl)
      console.error('❌ Status:', error.response?.status)
      console.error('❌ Response:', error.response?.data)
      throw new Error('Failed to register booking')
    }
  }
}
