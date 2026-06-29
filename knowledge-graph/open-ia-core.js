// Open IA Core — Master Intelligence Engine
// Unified orchestrator: planning → execution → memory → learning
// Architecture: Claude Code leak patterns + unrestricted intelligence

import * as wal from './wal.js'
import * as autoMemory from './auto-memory.js'
import { CompactionPipeline } from '../plugins/compaction-pipeline.js'
import { TokenOptimizer } from '../plugins/token-optimizer.js'
import {
  addNode, addEdge, searchNodes, semanticSearch,
  getGraphStats, checkAutoDreamGate, runAutoDreamPhase
} from './graph-store.js'

class OpenIACore {
  constructor() {
    this.sessionId = null
    this.currentTask = null
    this.taskHistory = []
    this.modelChain = []
    this.compactor = new CompactionPipeline()
    this.tokenOptimizer = new TokenOptimizer()
    this.parallelReaders = 0
    this.MAX_PARALLEL_READERS = 50
    this.MAX_CONTEXT_TOKENS = 2000000
  }

  async init() {
    this.sessionId = wal.startSession()
    const dreamStatus = checkAutoDreamGate()
    const stats = getGraphStats()
    return {
      session: this.sessionId,
      dream: dreamStatus,
      graph: stats,
      timestamp: new Date().toISOString()
    }
  }

  classifyTask(input) {
    const taskTypes = {
      code_generation: ['create', 'build', 'write', 'implement', 'generate', 'develop', 'code', 'program', 'make', 'construct'],
      code_refactor: ['refactor', 'optimize', 'clean', 'improve', 'simplify', 'restructure', 'rewrite'],
      debugging: ['bug', 'error', 'fix', 'issue', 'problem', 'crash', 'fail', 'broken', 'wrong'],
      architecture: ['design', 'architecture', 'plan', 'structure', 'diagram', 'pattern', 'system'],
      research: ['search', 'find', 'lookup', 'investigate', 'research', 'explore', 'analyze', 'what is', 'how does'],
      data_analysis: ['analyze', 'data', 'report', 'statistics', 'metrics', 'dashboard'],
      devops: ['deploy', 'ci/cd', 'docker', 'kubernetes', 'server', 'infrastructure', 'pipeline'],
      content: ['write', 'document', 'explain', 'tutorial', 'guide', 'readme'],
      learning: ['learn', 'study', 'understand', 'teach', 'tutorial'],
      creative: ['design', 'art', 'create', 'imagine', 'generate', 'concept'],
      security: ['security', 'vulnerability', 'exploit', 'hack', 'penetration', 'audit'],
      system: ['config', 'install', 'setup', 'configure', 'admin', 'manage', 'control']
    }

    const inputLower = input.toLowerCase()
    let scores = {}

    for (const [type, keywords] of Object.entries(taskTypes)) {
      scores[type] = keywords.filter(k => inputLower.includes(k)).length
    }

    const sorted = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort(([, a], [, b]) => b - a)

    return {
      primaryType: sorted.length > 0 ? sorted[0][0] : 'general',
      allTypes: sorted.slice(0, 3),
      confidence: sorted.length > 0 ? sorted[0][1] / 5 : 0
    }
  }

  selectModel(taskType, contextSize) {
    const modelMap = {
      code_generation: { model: 'opencode/gpt-5.1-codex', context: 200000, priority: 1 },
      code_refactor: { model: 'anthropic/claude-sonnet-4-5-20250929', context: 200000, priority: 1 },
      debugging: { model: 'anthropic/claude-sonnet-4-5-20250929', context: 200000, priority: 1 },
      architecture: { model: 'anthropic/claude-sonnet-4-5-20250929', context: 200000, priority: 1 },
      research: { model: 'opencode/big-pickle', context: 200000, priority: 1 },
      data_analysis: { model: 'google/gemini-3-pro', context: 2097152, priority: 1 },
      devops: { model: 'opencode/big-pickle', context: 200000, priority: 1 },
      content: { model: 'anthropic/claude-sonnet-4-5-20250929', context: 200000, priority: 1 },
      learning: { model: 'anthropic/claude-sonnet-4-5-20250929', context: 200000, priority: 1 },
      creative: { model: 'openai/gpt-5', context: 200000, priority: 1 },
      security: { model: 'opencode/big-pickle', context: 200000, priority: 1 },
      system: { model: 'opencode/big-pickle', context: 200000, priority: 1 },
      general: { model: 'opencode/big-pickle', context: 200000, priority: 1 }
    }

    let choice = modelMap[taskType] || modelMap.general

    if (contextSize > choice.context * 0.8) {
      for (const [type, cfg] of Object.entries(modelMap)) {
        if (type === taskType) continue
        if (cfg.context > choice.context) {
          choice = cfg
        }
      }
    }

    if (contextSize > 1000000) {
      choice = modelMap.general
      choice.model = 'google/gemini-3-pro'
      choice.context = 2097152
    }

    this.modelChain.push({
      taskType,
      selected: choice.model,
      contextSize,
      timestamp: new Date().toISOString()
    })

    return choice
  }

  getFallbackChain(taskType) {
    const chains = {
      code_generation: [
        'opencode/gpt-5.1-codex',
        'opencode/big-pickle',
        'anthropic/claude-sonnet-4-5-20250929',
        'groq/llama-4-scout-17b-16e-instruct',
        'ollama/codestral-2501'
      ],
      reasoning: [
        'anthropic/claude-sonnet-4-5-20250929',
        'openai/gpt-5',
        'opencode/big-pickle',
        'google/gemini-3-pro',
        'groq/llama-3.3-70b-versatile'
      ],
      long_context: [
        'google/gemini-3-pro',
        'google/gemini-3-flash',
        'opencode/big-pickle',
        'anthropic/claude-sonnet-4-5-20250929'
      ],
      creative: [
        'openai/gpt-5',
        'opencode/big-pickle',
        'anthropic/claude-sonnet-4-5-20250929',
        'google/gemini-3-flash'
      ],
      security: [
        'opencode/big-pickle',
        'google/gemini-3-flash',
        'groq/llama-4-scout-17b-16e-instruct'
      ],
      general: [
        'opencode/big-pickle',
        'anthropic/claude-sonnet-4-5-20250929',
        'google/gemini-3-pro',
        'openai/gpt-5',
        'groq/llama-3.3-70b-versatile',
        'ollama/qwen3-235b-a22b'
      ]
    }
    return chains[taskType] || chains.general
  }

  async programmingPipeline(context) {
    const { task, language, projectDir, files } = context
    const stages = {
      analyze: async () => {
        const analysis = {
          language,
          projectType: this.detectProjectType(files),
          complexity: this.estimateComplexity(task),
          dependencies: this.scanDependencies(files),
          patterns: await this.detectPatterns(files)
        }
        wal.append({ event: 'programming_analyze', analysis })
        return analysis
      },
      plan: async (analysis) => {
        const plan = {
          steps: this.generateSteps(task, analysis),
          filesToModify: this.identifyFiles(task, files),
          approach: this.selectApproach(task, analysis),
          risks: this.assessRisks(task, analysis)
        }
        wal.append({ event: 'programming_plan', plan })
        return plan
      },
      implement: async (plan) => {
        const implementation = {
          order: plan.steps,
          parallelizable: plan.steps.filter(s => s.independent),
          sequential: plan.steps.filter(s => !s.independent),
          testing: this.planTests(plan)
        }
        wal.append({ event: 'programming_implement', implementation })
        return implementation
      },
      verify: async (implementation) => {
        const verification = {
          tests: implementation.testing,
          lintCheck: true,
          typeCheck: true,
          review: this.codeReview(task)
        }
        wal.append({ event: 'programming_verify', verification })
        return verification
      },
      learn: async (verification) => {
        const learning = {
          patterns: verification.patterns || [],
          solutions: verification.solutions || [],
          improvements: verification.improvements || []
        }
        await autoMemory.saveMemory(`programming_${Date.now()}`, JSON.stringify(learning), {
          type: 'feedback',
          tags: ['code', language, 'pattern'],
          scope: 'project'
        })
        return learning
      }
    }
    return stages
  }

  detectProjectType(files) {
    if (!files || files.length === 0) return 'unknown'
    const indicators = {
      react: files.some(f => f.match(/react|jsx|tsx/i)),
      nextjs: files.some(f => f.match(/next\.config|next-env/i)),
      node: files.some(f => f.match(/package\.json|node_modules/i)),
      python: files.some(f => f.match(/\.py|requirements\.txt|setup\.py|Pipfile/i)),
      go: files.some(f => f.match(/\.go|go\.mod|go\.sum/i)),
      rust: files.some(f => f.match(/\.rs|cargo\.toml|Cargo\.lock/i)),
      java: files.some(f => f.match(/\.java|pom\.xml|build\.gradle/i)),
      dotnet: files.some(f => f.match(/\.cs|\.csproj|\.sln/i)),
      android: files.some(f => f.match(/\.kt|build\.gradle|AndroidManifest/i))
    }
    for (const [type, detected] of Object.entries(indicators)) {
      if (detected) return type
    }
    return 'unknown'
  }

  estimateComplexity(task) {
    const words = task.split(/\s+/).length
    if (words > 100) return 'high'
    if (words > 40) return 'medium'
    return 'low'
  }

  generateSteps(task, analysis) {
    return [
      { id: 1, name: 'analyze_requirements', description: 'Understand requirements and constraints', independent: true },
      { id: 2, name: 'design_solution', description: 'Design the solution architecture', independent: false },
      { id: 3, name: 'implement_core', description: 'Implement core functionality', independent: false },
      { id: 4, name: 'implement_tests', description: 'Write tests', independent: true },
      { id: 5, name: 'verify', description: 'Verify implementation works', independent: false }
    ]
  }

  identifyFiles(task, files) {
    return files ? files.slice(0, 5) : ['new_file']
  }

  selectApproach(task, analysis) {
    return {
      methodology: analysis.complexity === 'high' ? 'tdd' : 'iterative',
      parallelization: analysis.dependencies?.length < 5
    }
  }

  assessRisks(task, analysis) {
    const risks = []
    if (analysis.complexity === 'high') risks.push('complexity')
    if (!analysis.dependencies || analysis.dependencies.length === 0) risks.push('missing_dependencies')
    return risks
  }

  planTests(plan) {
    return plan.steps.map(s => ({ step: s.id, type: 'unit' }))
  }

  codeReview(task) {
    return { status: 'pending', patterns: [], issues: [], suggestions: [] }
  }

  scanDependencies(files) {
    if (!files) return []
    return files.filter(f => f.match(/package\.json|requirements\.txt|go\.mod|cargo\.toml|Gemfile|Pipfile/i))
  }

  async detectPatterns(files) {
    if (!files || files.length === 0) return []
    const patterns = []
    for (const f of files) {
      if (f.endsWith('.ts') || f.endsWith('.tsx')) patterns.push('typescript')
      if (f.endsWith('.js') || f.endsWith('.jsx')) patterns.push('javascript')
      if (f.match(/component/i)) patterns.push('component_pattern')
      if (f.match(/service|provider|factory/i)) patterns.push('service_pattern')
      if (f.match(/hook|use[A-Z]/i)) patterns.push('hook_pattern')
    }
    return [...new Set(patterns)]
  }

  async learnFromInteraction(context, result) {
    const entry = {
      timestamp: new Date().toISOString(),
      context: typeof context === 'string' ? context.substring(0, 500) : JSON.stringify(context).substring(0, 500),
      result: typeof result === 'string' ? result.substring(0, 500) : JSON.stringify(result).substring(0, 500),
      taskType: this.classifyTask(typeof context === 'string' ? context : '').primaryType
    }

    await wal.append({ event: 'learning', data: entry })
    await this.maybeAddToGraph(entry)
    await this.maybeConsolidate()
    return entry
  }

  async maybeAddToGraph(entry) {
    try {
      const existing = searchNodes({ query: entry.context.substring(0, 50) })
      if (existing.length === 0) {
        const node = addNode({
          type: 'Pattern',
          name: entry.taskType + '_' + Date.now(),
          description: entry.context,
          tags: [entry.taskType, 'auto-learned'],
          source: 'open-ia-core'
        })
        if (node.id) {
          addEdge({
            sourceId: node.id,
            targetId: 'learning',
            type: 'LEARNS_FROM'
          })
        }
      }
    } catch {}
  }

  async maybeConsolidate() {
    const gate = checkAutoDreamGate()
    if (gate.shouldRun) {
      for (const phase of ['orient', 'gather', 'consolidate', 'prune']) {
        runAutoDreamPhase(phase)
      }
    }
  }

  executeTool(name, params) {
    wal.append({ event: 'tool_execute', tool: name, params })
    return { tool: name, params, status: 'queued' }
  }

  optimizeContext(messages, context) {
    const result = this.tokenOptimizer.optimize(messages, context)
    wal.append({ event: 'context_optimized', stats: result.stats })
    return result
  }

  optimizeContextAggressive(messages, context) {
    const result = this.tokenOptimizer.optimizeAggressive(messages, context)
    wal.append({ event: 'context_optimized_aggressive', stats: result.stats })
    return result
  }

  getTokenStats() {
    return this.tokenOptimizer.getStats()
  }

  getStatus() {
    return {
      sessionId: this.sessionId,
      taskHistoryCount: this.taskHistory.length,
      modelChainCount: this.modelChain.length,
      parallelReaders: this.parallelReaders,
      maxReaders: this.MAX_PARALLEL_READERS,
      compactionStats: this.compactor.getStats(),
      dreamStatus: checkAutoDreamGate(),
      tokenStats: this.tokenOptimizer.getStats()
    }
  }
}

export { OpenIACore }
