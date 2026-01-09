/**
 * Sentence Boundary Detection Utility
 * Detects complete sentences in streaming text for real-time TTS generation
 */

export class SentenceDetector {
  constructor() {
    this.buffer = ''
    this.completeSentences = []
    // Sentence ending punctuation
    this.sentenceEnders = /[.!?]+/
    // Minimum characters for a valid sentence
    this.minSentenceLength = 10
  }

  /**
   * Add streaming text chunk and detect complete sentences
   * @param {string} chunk - New text chunk from LLM stream
   * @returns {string[]} Array of complete sentences detected
   */
  addChunk(chunk) {
    this.buffer += chunk
    const sentences = this.extractSentences()
    return sentences
  }

  /**
   * Extract complete sentences from buffer
   * @returns {string[]} Complete sentences
   */
  extractSentences() {
    const sentences = []

    // Look for sentence boundaries
    let match
    const regex = new RegExp(this.sentenceEnders, 'g')
    let lastIndex = 0

    while ((match = regex.exec(this.buffer)) !== null) {
      const endIndex = match.index + match[0].length
      const sentence = this.buffer.substring(lastIndex, endIndex).trim()

      // Only accept sentences longer than minimum length
      if (sentence.length >= this.minSentenceLength) {
        sentences.push(sentence)
        lastIndex = endIndex
      }
    }

    // Remove extracted sentences from buffer
    if (lastIndex > 0) {
      this.buffer = this.buffer.substring(lastIndex).trim()
    }

    return sentences
  }

  /**
   * Get any remaining text in buffer (for final flush)
   * @returns {string} Remaining text
   */
  getRemainder() {
    const remainder = this.buffer.trim()
    this.buffer = ''
    return remainder
  }

  /**
   * Reset the detector for a new response
   */
  reset() {
    this.buffer = ''
    this.completeSentences = []
  }

  /**
   * Check if buffer has potential incomplete sentence
   * @returns {boolean}
   */
  hasIncomplete() {
    return this.buffer.trim().length > 0
  }
}
