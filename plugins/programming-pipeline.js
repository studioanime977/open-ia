// Programming Pipeline — Claude Code-style software development flow
// 6 stages: analyze → design → implement → test → review → deploy
// Full project context awareness, multi-file editing, git integration

class ProgrammingPipeline {
  constructor() {
    this.stages = ['analyze', 'design', 'implement', 'test', 'review', 'deploy']
    this.currentStage = null
    this.context = { files: [], projectType: null, language: null, deps: [] }
    this.history = []
  }

  async analyze(projectDir, files) {
    this.context.projectDir = projectDir
    this.context.files = files || []
    const analysis = {
      projectType: this.detectProjectType(),
      framework: this.detectFramework(),
      language: this.detectLanguage(),
      entryPoints: this.findEntryPoints(),
      dependencies: this.scanDependencies(),
      configs: this.findConfigs(),
      tests: this.findTests(),
      structure: this.analyzeStructure()
    }
    this.history.push({ stage: 'analyze', result: analysis })
    return analysis
  }

  detectProjectType() {
    const files = this.context.files.map(f => f.toLowerCase())
    if (files.some(f => f.includes('package.json'))) return 'node'
    if (files.some(f => f.includes('cargo.toml'))) return 'rust'
    if (files.some(f => f.includes('go.mod'))) return 'go'
    if (files.some(f => f.includes('requirements.txt') || f.includes('setup.py'))) return 'python'
    if (files.some(f => f.includes('.csproj') || f.includes('.sln'))) return 'dotnet'
    if (files.some(f => f.includes('pom.xml') || f.includes('build.gradle'))) return 'java'
    if (files.some(f => f.includes('composer.json'))) return 'php'
    return 'unknown'
  }

  detectFramework() {
    const files = this.context.files.map(f => f.toLowerCase())
    const pkg = files.find(f => f.endsWith('package.json'))
    if (pkg) {
      const idx = this.context.files.findIndex(f => f.toLowerCase().endsWith('package.json'))
      if (idx >= 0) {
        const fullPath = this.context.files[idx]
        try {
          const fs = require('fs')
          const content = fs.readFileSync(fullPath, 'utf-8')
          const json = JSON.parse(content)
          const deps = { ...json.dependencies, ...json.devDependencies }
          if (deps.next) return 'nextjs'
          if (deps.react) return 'react'
          if (deps.vue) return 'vue'
          if (deps.angular) return 'angular'
          if (deps.express) return 'express'
          if (deps.nest) return 'nestjs'
          if (deps['@sveltejs/kit']) return 'sveltekit'
        } catch {}
      }
    }
    if (files.some(f => f.includes('next.config'))) return 'nextjs'
    if (files.some(f => f.includes('astro.config'))) return 'astro'
    if (files.some(f => f.includes('remix.config'))) return 'remix'
    if (files.some(f => f.includes('vue.config'))) return 'vue'
    if (files.some(f => f.includes('angular.json'))) return 'angular'
    return 'unknown'
  }

  detectLanguage() {
    const files = this.context.files
    const exts = files.map(f => {
      const dot = f.lastIndexOf('.')
      return dot >= 0 ? f.substring(dot) : ''
    })
    const counts = {}
    for (const ext of exts) {
      counts[ext] = (counts[ext] || 0) + 1
    }
    const mappings = {
      '.ts': 'typescript', '.tsx': 'typescript+react',
      '.js': 'javascript', '.jsx': 'react',
      '.py': 'python', '.rs': 'rust', '.go': 'go',
      '.java': 'java', '.kt': 'kotlin', '.swift': 'swift',
      '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c',
      '.rb': 'ruby', '.php': 'php',
      '.vue': 'vue', '.svelte': 'svelte'
    }
    let best = { lang: 'unknown', count: 0 }
    for (const [ext, lang] of Object.entries(mappings)) {
      if ((counts[ext] || 0) > best.count) {
        best = { lang, count: counts[ext] }
      }
    }
    return best.lang
  }

  findEntryPoints() {
    return this.context.files.filter(f => {
      const name = f.split(/[/\\]/).pop().toLowerCase()
      return ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js',
        'server.ts', 'server.js', 'index.tsx', 'index.jsx', '_app.tsx',
        'main.py', 'main.go', 'main.rs', 'index.html'].includes(name)
    })
  }

  scanDependencies() {
    const configFiles = this.context.files.filter(f => {
      const name = f.split(/[/\\]/).pop().toLowerCase()
      return ['package.json', 'requirements.txt', 'go.mod', 'cargo.toml',
        'Gemfile', 'Pipfile', 'composer.json', 'build.gradle', 'pom.xml'].includes(name)
    })
    return configFiles
  }

  findConfigs() {
    return this.context.files.filter(f => {
      const name = f.split(/[/\\]/).pop().toLowerCase()
      return name.startsWith('.') || name.includes('config') || name.includes('rc.')
        || ['tsconfig.json', 'webpack.config.js', 'vite.config.ts', 'next.config.js',
            'tailwind.config.js', 'postcss.config.js', '.env', '.env.local',
            'docker-compose.yml', 'Dockerfile', 'Makefile'].includes(name)
    })
  }

  findTests() {
    return this.context.files.filter(f => {
      const name = f.split(/[/\\]/).pop().toLowerCase()
      return name.includes('test') || name.includes('spec') || name.includes('.test.')
        || name.includes('.spec.') || name.includes('__tests__') || name.includes('e2e')
    })
  }

  analyzeStructure() {
    const dirs = new Set()
    for (const f of this.context.files) {
      const parts = f.split(/[/\\]/)
      if (parts.length > 1) {
        dirs.add(parts[0])
        if (parts.length > 2) dirs.add(parts.slice(0, 2).join('/'))
      }
    }
    const patterns = {
      hasSrc: [...dirs].some(d => d === 'src' || d.startsWith('src/')),
      hasComponents: [...dirs].some(d => d.includes('component')),
      hasPages: [...dirs].some(d => d.includes('page')),
      hasApi: [...dirs].some(d => d.includes('api')),
      hasUtils: [...dirs].some(d => d.includes('util') || d.includes('helper') || d.includes('lib')),
      hasStyles: [...dirs].some(d => d.includes('style') || d.includes('css') || d.includes('theme')),
      hasAssets: [...dirs].some(d => d.includes('asset') || d.includes('public') || d.includes('static')),
      hasTests: [...dirs].some(d => d.includes('test') || d.includes('__tests__') || d.includes('spec')),
      totalDirs: dirs.size
    }
    return patterns
  }

  async design(analysis) {
    const design = {
      architecture: this.suggestArchitecture(analysis),
      components: this.suggestComponents(analysis),
      dataFlow: this.suggestDataFlow(analysis),
      patterns: this.suggestPatterns(analysis),
      fileStructure: this.suggestFileStructure(analysis)
    }
    this.history.push({ stage: 'design', result: design })
    return design
  }

  suggestArchitecture(analysis) {
    if (analysis.framework === 'nextjs') return 'nextjs-app-router'
    if (analysis.framework === 'react') return 'react-spa'
    if (analysis.framework === 'express') return 'layered-api'
    if (analysis.framework === 'nestjs') return 'modular-nest'
    return analysis.projectType === 'node' ? 'microservices' : 'monolithic'
  }

  suggestComponents(analysis) {
    if (analysis.framework === 'react' || analysis.framework === 'nextjs') {
      return ['UI Components', 'Layout Components', 'Page Components', 'HOCs', 'Hooks', 'Services', 'Context/State']
    }
    if (analysis.projectType === 'node') {
      return ['Routes', 'Controllers', 'Services', 'Models', 'Middleware', 'Validators', 'Tests']
    }
    return ['Core', 'Utils', 'Config', 'Tests']
  }

  suggestDataFlow(analysis) {
    if (analysis.language?.includes('react')) {
      return { pattern: 'unidirectional', state: 'react-context', api: 'react-query' }
    }
    return { pattern: 'layered', state: 'in-memory', api: 'rest' }
  }

  suggestPatterns(analysis) {
    const patterns = ['modular-design', 'dependency-injection']
    if (analysis.framework === 'react' || analysis.framework === 'nextjs') {
      patterns.push('compound-components', 'custom-hooks')
    }
    if (analysis.projectType === 'node') {
      patterns.push('middleware-chain', 'repository-pattern')
    }
    if (analysis.framework === 'nestjs') {
      patterns.push('decorator-pattern', 'provider-pattern')
    }
    return patterns
  }

  suggestFileStructure(analysis) {
    if (analysis.framework === 'nextjs') {
      return ['app/', 'app/api/', 'components/', 'lib/', 'styles/', 'public/', 'types/']
    }
    if (analysis.framework === 'react') {
      return ['src/', 'src/components/', 'src/pages/', 'src/hooks/', 'src/services/', 'src/utils/', 'src/styles/']
    }
    if (analysis.projectType === 'node') {
      return ['src/', 'src/routes/', 'src/controllers/', 'src/services/', 'src/models/', 'src/middleware/', 'tests/']
    }
    return ['src/', 'tests/', 'config/', 'docs/']
  }

  async implement(design, fileChanges) {
    const implementation = {
      filesToCreate: [],
      filesToModify: [],
      filesToDelete: [],
      order: this.createEditOrder(fileChanges),
      parallelEdits: this.canParallelize(fileChanges)
    }
    this.history.push({ stage: 'implement', result: implementation })
    return implementation
  }

  createEditOrder(changes) {
    if (!changes || changes.length === 0) return []
    const deps = new Map()
    for (const change of changes) {
      deps.set(change.path, change.dependsOn || [])
    }
    const ordered = []
    const visited = new Set()
    const visit = (path) => {
      if (visited.has(path)) return
      visited.add(path)
      for (const dep of deps.get(path) || []) {
        if (deps.has(dep)) visit(dep)
      }
      ordered.push(path)
    }
    for (const change of changes) visit(change.path)
    return ordered
  }

  canParallelize(changes) {
    if (!changes || changes.length < 2) return []
    const independent = []
    for (let i = 0; i < changes.length; i++) {
      const deps = changes[i].dependsOn || []
      const hasDepsInChanges = deps.some(d => changes.some(c => c.path === d))
      if (!hasDepsInChanges) {
        independent.push(changes[i].path)
      }
    }
    return independent
  }

  async test(implementation) {
    const testPlan = {
      unitTests: this.generateUnitTests(),
      integrationTests: this.generateIntegrationTests(),
      e2eTests: this.generateE2ETests(),
      coverage: { target: 80, current: 0 }
    }
    const testCommands = this.getTestCommands()
    return { plan: testPlan, commands: testCommands }
  }

  generateUnitTests() {
    return [
      { target: 'core functions', type: 'unit', framework: 'jest' },
      { target: 'api endpoints', type: 'integration', framework: 'supertest' }
    ]
  }

  generateIntegrationTests() {
    return [{ target: 'data flow', type: 'integration', framework: 'jest' }]
  }

  generateE2ETests() {
    return [{ target: 'critical paths', type: 'e2e', framework: 'playwright' }]
  }

  getTestCommands() {
    const projectType = this.context.projectType
    const commands = {
      node: ['npm test', 'npx jest', 'npx vitest run'],
      python: ['python -m pytest', 'python -m unittest discover'],
      go: ['go test ./...'],
      rust: ['cargo test'],
      unknown: ['npm test', 'pytest', 'go test ./...']
    }
    return commands[projectType] || commands.unknown
  }

  async review(implementation) {
    const review = {
      codeQuality: { score: 0, issues: [], strengths: [] },
      security: { vulnerabilities: [], recommendations: [] },
      performance: { bottlenecks: [], optimizations: [] },
      bestPractices: { followed: [], missing: [] }
    }
    this.history.push({ stage: 'review', result: review })
    return review
  }

  async deploy(review) {
    const deployPlan = {
      steps: [
        { name: 'build', command: this.getBuildCommand() },
        { name: 'test', command: 'npm test' },
        { name: 'package', command: this.getPackageCommand() },
        { name: 'deploy', command: this.getDeployCommand() }
      ],
      environment: 'development',
      verification: ['health-check', 'smoke-tests']
    }
    this.history.push({ stage: 'deploy', result: deployPlan })
    return deployPlan
  }

  getBuildCommand() {
    const p = this.context.projectType
    if (p === 'node') return 'npm run build'
    if (p === 'rust') return 'cargo build --release'
    if (p === 'go') return 'go build ./...'
    if (p === 'python') return 'python setup.py build'
    return 'npm run build'
  }

  getPackageCommand() {
    return 'npm pack'
  }

  getDeployCommand() {
    return 'npm run start'
  }

  getStatus() {
    return {
      currentStage: this.currentStage,
      stagesCompleted: this.history.map(h => h.stage),
      projectType: this.context.projectType,
      filesAnalyzed: this.context.files.length,
      historyLength: this.history.length
    }
  }

  reset() {
    this.currentStage = null
    this.context = { files: [], projectType: null, language: null, deps: [] }
    this.history = []
  }
}

module.exports = { ProgrammingPipeline }
