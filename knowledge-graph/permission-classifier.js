// YOLO Permission Classifier — inspired by Claude Code's 2-pass ML classifier
// Pass 1: Fast single-token filter (milliseconds)
// Pass 2: Full chain-of-thought with LOW/MEDIUM/HIGH risk

const RISK_LEVELS = { LOW: 1, MEDIUM: 2, HIGH: 3 }
const REVERSIBLE_ACTIONS = ['read', 'glob', 'grep', 'search', 'list', 'stat']
const WRITE_ACTIONS = ['edit', 'write', 'delete', 'create', 'move', 'copy']
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bcurl\b.*\||\||.*\bcurl\b/i,
  /\bwget\b.*\||\||.*\bwget\b/i,
  /\/dev\/(null|random|zero)/,
  />\s*\/dev\//,
  /\bchmod\s+777\b/,
  /\bsudo\b/,
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bformat\s/i,
  /\bdd\s+if=/,
  /\bmv\s+\/[a-z]/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\binit\s+0\b/,
  /\bpoweroff\b/i,
  /`[^`]+`/,
  /\$\s*\(/,
  /;\s*;/,
  /\|\s*\|/
]

const SENSITIVE_FILES = [
  '.env', '.gitconfig', '.bashrc', '.zshrc', '.ssh/',
  'id_rsa', 'id_ed25519', 'aws/credentials', 'gcloud/',
  'firebase-key.json', 'service-account', 'token', 'secret',
  'password', 'credential'
]

export function fastFilter(toolName, params) {
  const risk = { level: 'LOW', score: 0, reason: [] }

  if (REVERSIBLE_ACTIONS.includes(toolName)) {
    risk.level = 'LOW'
    risk.score = 0
    risk.reason.push('read-only operation')
    return risk
  }

  if (WRITE_ACTIONS.includes(toolName)) {
    risk.level = 'MEDIUM'
    risk.score = 2
    risk.reason.push('write operation')
  }

  const str = JSON.stringify(params || '')

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(str)) {
      risk.level = 'HIGH'
      risk.score = 5
      risk.reason.push(`dangerous pattern: ${pattern}`)
    }
  }

  for (const file of SENSITIVE_FILES) {
    if (str.toLowerCase().includes(file.toLowerCase())) {
      if (risk.level !== 'HIGH') risk.level = 'MEDIUM'
      risk.score += 2
      risk.reason.push(`sensitive file: ${file}`)
    }
  }

  if (str.length > 500) {
    risk.score += 1
    risk.reason.push('large payload')
  }

  return risk
}

export function deepClassifier(toolName, params, conversationContext) {
  const fast = fastFilter(toolName, params)

  if (fast.level === 'HIGH') {
    return {
      ...fast,
      verdict: 'DENY',
      confidence: 0.95,
      explainer: `Blocked by fast filter: ${fast.reason.join(', ')}`
    }
  }

  if (fast.level === 'LOW') {
    return {
      ...fast,
      verdict: 'ALLOW',
      confidence: 0.9,
      explainer: 'Read-only or safe operation'
    }
  }

  if (conversationContext) {
    const ctxStr = JSON.stringify(conversationContext).toLowerCase()
    const hasEditedThisFile = ctxStr.includes(toolName)
    const isRetry = (ctxStr.match(/error|fail|retry|again/g) || []).length > 2

    if (isRetry && fast.level === 'MEDIUM') {
      return {
        ...fast,
        verdict: 'ALLOW',
        confidence: 0.7,
        explainer: 'Retry context — allowing previously attempted operation'
      }
    }
  }

  return {
    ...fast,
    verdict: 'ASK',
    confidence: 0.6,
    explainer: `Operation needs human confirmation: ${fast.reason.join(', ')}`
  }
}

export function getToolPermission(toolName) {
  const registry = {
    FileReadTool: { default: 'allow', reversible: true, category: 'read' },
    FileEditTool: { default: 'ask', reversible: true, category: 'write' },
    FileWriteTool: { default: 'ask', reversible: false, category: 'write' },
    GlobTool: { default: 'allow', reversible: true, category: 'read' },
    GrepTool: { default: 'allow', reversible: true, category: 'read' },
    BashTool: { default: 'ask', reversible: false, category: 'exec' },
    PowerShellTool: { default: 'ask', reversible: false, category: 'exec' },
    WebFetchTool: { default: 'allow', reversible: true, category: 'read' },
    WebSearchTool: { default: 'allow', reversible: true, category: 'read' },
    AgentTool: { default: 'ask', reversible: false, category: 'agent' },
    TaskCreateTool: { default: 'allow', reversible: true, category: 'task' },
    TaskListTool: { default: 'allow', reversible: true, category: 'read' },
    ScheduleCronTool: { default: 'ask', reversible: false, category: 'system' },
    MCPTool: { default: 'ask', reversible: false, category: 'mcp' },
    FileEditTool2: { default: 'allow', reversible: true, category: 'write' }
  }
  return registry[toolName] || { default: 'ask', reversible: false, category: 'unknown' }
}

const PERMISSION_MODES = {
  default: { write: 'ask', exec: 'ask', read: 'allow', agent: 'ask', system: 'deny' },
  plan: { write: 'ask', exec: 'ask', read: 'allow', agent: 'ask', system: 'deny' },
  acceptEdits: { write: 'allow', exec: 'ask', read: 'allow', agent: 'ask', system: 'deny' },
  bypassPermissions: { write: 'allow', exec: 'allow', read: 'allow', agent: 'allow', system: 'ask' },
  dontAsk: { write: 'allow', exec: 'allow', read: 'allow', agent: 'allow', system: 'allow' }
}

export function resolvePermission(toolName, params, mode, context) {
  if (mode === 'dontAsk') return { decision: 'allow', mode: 'dontAsk' }
  if (mode === 'bypassPermissions') {
    const sensitive = fastFilter(toolName, params)
    return { decision: sensitive.level === 'HIGH' ? 'ask' : 'allow', mode }
  }
  const classifier = deepClassifier(toolName, params, context)
  if (classifier.verdict !== 'ASK') {
    return { decision: classifier.verdict.toLowerCase(), source: 'classifier', confidence: classifier.confidence, explainer: classifier.explainer }
  }
  const toolPerm = getToolPermission(toolName)
  const modeRules = PERMISSION_MODES[mode] || PERMISSION_MODES.default
  const category = toolPerm.category
  const modeDecision = modeRules[category] || 'ask'
  return { decision: modeDecision, source: 'mode_rules', mode, category }
}
