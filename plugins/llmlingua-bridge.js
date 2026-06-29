// LLMLingua Bridge — 20x Prompt Compression
// Intenta usar LLMLingua (Python) si está instalado, fallback a JS nativo
// Basado en microsoft/LLMLingua: EMNLP'23, ACL'24

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

class LLMLinguaBridge {
  constructor() {
    this.pythonAvailable = false
    this.llmlinguaAvailable = false
    this.compressionStats = { totalTokens: 0, compressedTokens: 0, totalCalls: 0 }
    this._checkAvailability()
  }

  _checkAvailability() {
    try {
      execSync('python --version 2>nul', { stdio: 'pipe', timeout: 3000, shell: 'powershell' })
      this.pythonAvailable = true
      try {
        execSync('python -c "import llmlingua; print(1)" 2>nul', { stdio: 'pipe', timeout: 5000, shell: 'powershell' })
        this.llmlinguaAvailable = true
      } catch {}
    } catch {}
  }

  isAvailable() { return this.pythonAvailable && this.llmlinguaAvailable }
  isPythonAvailable() { return this.pythonAvailable }

  compressWithPython(text, options = {}) {
    if (!this.isAvailable()) return null
    const ratio = options.ratio || 0.05
    const tmpFile = path.join(os.tmpdir(), 'llmlingua_input_' + Date.now() + '.json')

    const payload = JSON.stringify({
      text: text,
      rate: ratio,
      target_token: options.targetTokens || null,
      force_tokens: options.forceTokenIds || [],
      condition_in_question: options.conditionInQuestion || false,
      condition_compare: options.conditionCompare || false,
      context_length: options.contextLength || -1
    })
    fs.writeFileSync(tmpFile, payload, 'utf-8')

    const script = `
import json, sys
with open(r'''${tmpFile.replace(/\\/g, '/')}''', 'r') as f:
    data = json.load(f)
try:
    from llmlingua import PromptCompressor
    compressor = PromptCompressor()
    result = compressor.compress_prompt(
        data['text'],
        rate=data['rate'],
        target_token=data['target_token'],
        force_tokens=data['force_tokens'],
        condition_in_question=data['condition_in_question'],
        condition_compare=data['condition_compare'],
        context_length=data['context_length']
    )
    print(json.dumps({
        "compressed_prompt": result["compressed_prompt"],
        "origin_tokens": result["origin_tokens"],
        "compressed_tokens": result["compressed_tokens"],
        "ratio": result["ratio"]
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`
    try {
      const result = execSync(`python -c "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        stdio: 'pipe',
        timeout: 60000,
        encoding: 'utf-8',
        shell: 'powershell'
      })
      try { fs.unlinkSync(tmpFile) } catch {}
      const parsed = JSON.parse(result.trim())
      if (parsed.error) throw new Error(parsed.error)
      this.compressionStats.totalCalls++
      this.compressionStats.totalTokens += parsed.origin_tokens || 0
      this.compressionStats.compressedTokens += parsed.compressed_tokens || 0
      return parsed
    } catch (e) {
      try { fs.unlinkSync(tmpFile) } catch {}
      return { error: e.message, fallback: true }
    }
  }

  compressNative(text, options = {}) {
    const compressionRatio = options.ratio || 0.05
    const preserveUrls = options.preserveUrls !== false
    const preserveCode = options.preserveCode !== false
    const preserveNumbers = options.preserveNumbers !== false

    const tokens = this._tokenize(text)
    const originalLength = tokens.length
    const targetLength = Math.max(10, Math.floor(originalLength * compressionRatio))

    const stopwords = new Set([
      'the','a','an','is','are','was','were','be','been',
      'has','have','had','do','does','did','will','would',
      'could','should','may','might','can','shall','to',
      'of','in','for','on','with','at','by','from',
      'this','that','these','those','it','its','and','or',
      'but','not','no','yes','so','if','then','else',
      'as','than','very','just','also','too','about'
    ])

    const scored = tokens.map((token, i) => {
      let score = 1.0

      if (token.match(/^[A-Z][a-z]+/)) score += 2.0
      if (token.match(/^(function|class|const|let|var|import|export|def|return)$/)) score += 3.0
      if (token.match(/^[A-Z_]{2,}$/)) score += 2.0
      if (preserveUrls && token.match(/^https?:\/\//)) score += 5.0
      if (token.match(/^\/[a-z]/)) score += 2.0
      if (preserveNumbers && token.match(/^\d+$/)) score += 1.5
      if (preserveCode) {
        if (token.match(/^[{}()[\]]$/)) score += 2.0
        if (token.match(/^[=+\-*\/%<>!&|^~]$/)) score += 1.5
      }

      const pos = i / originalLength
      if (pos < 0.1) score += 2.0
      if (pos > 0.95) score += 2.0

      const freq = tokens.filter(t => t === token).length
      score += 1.0 / (freq / originalLength + 0.01)

      if (stopwords.has(token.toLowerCase())) score -= 2.0

      return { token, score, index: i }
    })

    scored.sort((a, b) => b.score - a.score)
    const kept = scored.slice(0, targetLength)
    kept.sort((a, b) => a.index - b.index)
    const compressedText = kept.map(t => t.token).join(' ')

    this.compressionStats.totalCalls++
    this.compressionStats.totalTokens += originalLength
    this.compressionStats.compressedTokens += kept.length

    return {
      compressed_prompt: compressedText,
      origin_tokens: originalLength,
      compressed_tokens: kept.length,
      ratio: kept.length / originalLength,
      method: 'native-js'
    }
  }

  compress(text, options = {}) {
    if (this.isAvailable()) {
      const result = this.compressWithPython(text, options)
      if (result && !result.fallback) {
        return { ...result, method: 'llmlingua-python' }
      }
    }
    return this.compressNative(text, options)
  }

  compressBatch(texts, options = {}) {
    return texts.map(t => this.compress(t, options))
  }

  _tokenize(text) {
    if (!text) return []
    const tokens = []
    const parts = text.split(/(\s+)/)
    for (const part of parts) {
      if (part.trim().length === 0) continue
      const subtokens = part.match(/[A-Za-z_]+|\d+|\S/g)
      if (subtokens) tokens.push(...subtokens)
      else tokens.push(part)
    }
    return tokens
  }

  getStats() {
    const total = this.compressionStats.totalTokens
    return {
      ...this.compressionStats,
      avgRatio: total > 0 ? (this.compressionStats.compressedTokens / total) : 1,
      pythonAvailable: this.pythonAvailable,
      llmlinguaAvailable: this.llmlinguaAvailable,
      savingsPercent: total > 0 ? Math.round((1 - this.compressionStats.compressedTokens / total) * 100) : 0
    }
  }
}

module.exports = { LLMLinguaBridge }
