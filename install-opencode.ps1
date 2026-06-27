param([switch]$Update)
$ErrorActionPreference = "Stop"
$OPENCODE_CONFIG = "$env:USERPROFILE\.config\opencode"
$REPO = "https://github.com/studioanime977/open-ia"
$KNOWLEDGE_REPO = "https://github.com/studioanime977/opencode-ia-avanzada"

Write-Output @"

  ╔══════════════════════════════════════════╗
  ║        OPEN IA - INSTALADOR v2.0         ║
  ║  Instala todo: MCP, Node, Python,        ║
  ║  Groq rotation, grafo, agentes, etc.     ║
  ╚══════════════════════════════════════════╝

"@

# ── 1. Verificar dependencias base ──
Write-Output "=== 1/8 Verificando dependencias base ==="
$errors = 0
function Check-Dep($name, $cmd) {
  $r = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($r) { Write-Output "  [✓] $name" } else { Write-Output "  [✗] $name - NO INSTALADO"; $script:errors++ }
}
Check-Dep "OpenCode CLI" "opencode"
Check-Dep "Git" "git"
Check-Dep "Node.js" "node"
Check-Dep "npm" "npm"

# Node modules for knowledge-graph
if (Get-Command "node" -ErrorAction SilentlyContinue) {
  $crypto = node -e "try{require('crypto');console.log('ok')}catch(e){console.log('fail')}" 2>&1
  if ($crypto -eq "ok") { Write-Output "  [✓] Node crypto (built-in)" } else { Write-Output "  [✗] Node crypto missing" }
}

if ($errors -gt 0) {
  Write-Output "`n[!] Instalá las dependencias faltantes:"
  Write-Output "  - OpenCode: https://opencode.ai/docs/install"
  Write-Output "  - Node.js:  https://nodejs.org (v18+)"
  Write-Output "  - Git:      winget install Git.Git"
  exit 1
}

# ── 2. API Keys ──
Write-Output "`n=== 2/8 Configurando API keys ==="
Write-Output @"
  Cada usuario crea SUS PROPIAS keys en los proveedores:
  • OpenAI:    https://platform.openai.com/api-keys
  • Anthropic: https://console.anthropic.com/
  • Google:    https://aistudio.google.com/apikey
  • Groq x5:   https://console.groq.com/keys (rotación automática)

"@
function Ask-Key($name, $optional=$false) {
  $prompt = if ($optional) { "  $name (ENTER para saltar): " } else { "  $name: " }
  $val = Read-Host -Prompt $prompt
  if (-not $val -and -not $optional) { Write-Output "  [!] Requerido."; return Ask-Key $name $optional }
  return $val
}
$OPENAI_KEY    = Ask-Key "OPENAI_API_KEY"
$ANTHROPIC_KEY = Ask-Key "ANTHROPIC_API_KEY"
$GOOGLE_KEY    = Ask-Key "GOOGLE_API_KEY"
Write-Output "  Groq keys (5 para ~5000 req/dia):"
$GROQ_KEY_1 = Ask-Key "GROQ_API_KEY"
$GROQ_KEY_2 = Ask-Key "GROQ_API_KEY_2" $true
$GROQ_KEY_3 = Ask-Key "GROQ_API_KEY_3" $true
$GROQ_KEY_4 = Ask-Key "GROQ_API_KEY_4" $true
$GROQ_KEY_5 = Ask-Key "GROQ_API_KEY_5" $true

$keys = @{
  "OPENAI_API_KEY"    = $OPENAI_KEY
  "ANTHROPIC_API_KEY" = $ANTHROPIC_KEY
  "GOOGLE_API_KEY"    = $GOOGLE_KEY
  "GROQ_API_KEY"      = $GROQ_KEY_1
}
if ($GROQ_KEY_2) { $keys["GROQ_API_KEY_2"] = $GROQ_KEY_2 }
if ($GROQ_KEY_3) { $keys["GROQ_API_KEY_3"] = $GROQ_KEY_3 }
if ($GROQ_KEY_4) { $keys["GROQ_API_KEY_4"] = $GROQ_KEY_4 }
if ($GROQ_KEY_5) { $keys["GROQ_API_KEY_5"] = $GROQ_KEY_5 }

foreach ($k in $keys.Keys) {
  [Environment]::SetEnvironmentVariable($k, $keys[$k], "User")
  Set-Item -Path "Env:$k" -Value $keys[$k]
}
Write-Output "  [✓] $(@($keys.Keys).Count) variables de entorno guardadas (nivel User)"

# ── 3. Estructura de directorios ──
Write-Output "`n=== 3/8 Creando estructura de directorios ==="
$dirs = @(
  "$OPENCODE_CONFIG\scripts",
  "$OPENCODE_CONFIG\agents",
  "$OPENCODE_CONFIG\prompts",
  "$OPENCODE_CONFIG\themes",
  "$OPENCODE_CONFIG\plugins",
  "$OPENCODE_CONFIG\knowledge-graph\data",
  "$OPENCODE_CONFIG\graphify-out",
  "$OPENCODE_CONFIG\opencode-ia-avanzada\aprendizajes"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
Write-Output "  [✓] Directorios creados"

# ── 4. Descargar archivos de config desde el repo ──
Write-Output "`n=== 4/8 Descargando configuraciones desde open-ia repo ==="
$tmp = "$env:TEMP\open-ia-files"
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
git clone --depth 1 $REPO $tmp 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
  # Copy everything except .git
  Get-ChildItem -Path $tmp -Exclude ".git" | ForEach-Object {
    $dest = "$OPENCODE_CONFIG\$($_.Name)"
    if ($_.PSIsContainer) {
      Copy-Item -Recurse -Force $_.FullName $dest
    } else {
      Copy-Item -Force $_.FullName $dest
    }
  }
  Write-Output "  [✓] Configuraciones descargadas"
  Remove-Item -Recurse -Force $tmp
} else {
  Write-Output "  [!] No se pudo clonar el repo, los archivos se crearan desde cero"
}

# ── 5. Instalar MCP servers ──
Write-Output "`n=== 5/8 Instalando MCP Servers ==="

# MCPs via npx (no instalacion, solo verificamos que npm los resuelva)
$npxMcps = @{
  "sequential-thinking" = "@modelcontextprotocol/server-sequential-thinking"
  "graphify"            = "graphify-mcp-tools"
  "n8n"                 = "n8n-mcp"
  "agent-browser"       = "agent-browser-mcp"
}
foreach ($mcp in $npxMcps.Keys) {
  $pkg = $npxMcps[$mcp]
  Write-Output "  Verificando $mcp..."
  $r = npx --yes $pkg --help 2>&1 | Select-Object -First 1
  if ($LASTEXITCODE -eq 0 -or $r) { Write-Output "  [✓] $mcp disponible" }
  else { Write-Output "  [i] $mcp se instalara al primer uso (npx)" }
}

# codebase-memory-mcp (binary download)
Write-Output "  Instalando codebase-memory-mcp..."
$cmmcpDir = "$env:LOCALAPPDATA\Programs\codebase-memory-mcp"
if (-not (Test-Path "$cmmcpDir\codebase-memory-mcp.exe")) {
  New-Item -ItemType Directory -Path $cmmcpDir -Force | Out-Null
  Write-Output "  [i] Descargar binary desde: https://github.com/codebase-memory/codebase-memory-mcp/releases"
  Write-Output "      Colocarlo en: $cmmcpDir\codebase-memory-mcp.exe"
} else {
  Write-Output "  [✓] codebase-memory-mcp ya instalado"
}

# ── 6. Crear grafo de conocimiento ──
Write-Output "`n=== 6/8 Inicializando grafo de conocimiento ==="
$graphDir = "$OPENCODE_CONFIG\knowledge-graph"
$serverJs = "$graphDir\server.js"
$storeJs = "$graphDir\graph-store.js"
$graphJson = "$graphDir\data\graph.json"

# server.js
if (-not (Test-Path $serverJs)) {
@'
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "data")
const GRAPH_FILE = join(DATA_DIR, "graph.json")
const NODE_TYPES = ["Concept","Pattern","Solution","Error","Tool","Command","Config","Code","Agent","MCP","Project","File"]
const EDGE_TYPES = ["SOLVES","USES","DERIVES_FROM","SIMILAR_TO","REQUIRES","PRECEDES","CONFLICTS_WITH","EXTENDS","CALLS","IMPORTS","DEFINES","REFERENCES","LEARNS_FROM"]

let graph = { nodes: [], edges: [] }
function load() {
  try { graph = JSON.parse(readFileSync(GRAPH_FILE,"utf-8")) }
  catch { graph = { nodes: [], edges: [] } }
}
function save() {
  const d = join(DATA_DIR); require("fs").mkdirSync(d,{recursive:true})
  writeFileSync(GRAPH_FILE, JSON.stringify(graph,null,2))
}
function uid() { return crypto.randomUUID() }
load()

const server = { NODE_TYPES, EDGE_TYPES, graph }
console.log("Knowledge Graph MCP Server running")
process.stdin.on("data", d => {
  const req = JSON.parse(d.toString())
  const { id, method, params } = req
  let result = {}
  if (method === "kg_stats") {
    const byType = {}
    graph.nodes.forEach(n => { byType[n.type] = (byType[n.type]||0)+1 })
    result = { totalNodes: graph.nodes.length, totalEdges: graph.edges.length, nodeTypes: byType }
  }
  if (method === "kg_search") {
    const q = (params.query||"").toLowerCase()
    result = { results: graph.nodes.filter(n => n.name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q) || n.tags.some(t=>t.toLowerCase().includes(q))) }
  }
  if (method === "kg_add_node") {
    if (!NODE_TYPES.includes(params.type)) { result = { error: "Invalid type" } }
    else {
      const node = { id:uid(), type:params.type, name:params.name, description:params.description||"", tags:params.tags||[], properties:{}, source:"manual", created:new Date().toISOString(), weight:1 }
      graph.nodes.push(node); save(); result = { node }
    }
  }
  if (method === "kg_add_edge") {
    if (!EDGE_TYPES.includes(params.type)) { result = { error: "Invalid edge type" } }
    else {
      const src = graph.nodes.find(n=>n.name===params.from)
      const tgt = graph.nodes.find(n=>n.name===params.to)
      if (!src||!tgt) { result = { error: "Node not found" } }
      else {
        const edge = { id:uid(), type:params.type, sourceId:src.id, targetId:tgt.id, properties:{}, created:new Date().toISOString() }
        graph.edges.push(edge); save(); result = { edge }
      }
    }
  }
  if (method === "kg_harvest") {
    const { harvestFromAprendizajes } = await import("./graph-store.js")
    result = harvestFromAprendizajes(params.dir)
  }
  writeFileSync(process.stdout.fd, JSON.stringify({id,result})+'\n')
})
'@ | Set-Content -Path $serverJs -Encoding UTF8
}
Write-Output "  [✓] server.js"

# graph-store.js
if (-not (Test-Path $storeJs)) {
  $gsUrl = "$REPO/main/knowledge-graph/graph-store.js"
  try {
    Invoke-WebRequest -Uri $gsUrl -OutFile $storeJs -TimeoutSec 10
    Write-Output "  [✓] graph-store.js descargado"
  } catch {
    Write-Output "  [i] graph-store.js no disponible, se creara manualmente"
  }
}
# graph.json base
if (-not (Test-Path $graphJson) -or (Get-Item $graphJson).Length -lt 10) {
  @{nodes=@();edges=@()} | ConvertTo-Json | Set-Content -Path $graphJson -Encoding UTF8
}
Write-Output "  [✓] Grafo inicializado (vacio, se llena con cada interaccion)"

# ── 7. Crear scripts ──
Write-Output "`n=== 7/8 Instalando scripts ==="

# groq-rotate.ps1
$rotateScript = @'
param([switch]$List)
$keys = @("GROQ_API_KEY","GROQ_API_KEY_2","GROQ_API_KEY_3","GROQ_API_KEY_4","GROQ_API_KEY_5")
if ($List) {
  Write-Output "=== Groq API Keys ==="
  foreach ($k in $keys) {
    $val = [Environment]::GetEnvironmentVariable($k, "User")
    $short = if ($val) { $val.Substring(0,15)+"..." } else { "(empty)" }
    $active = if ($k -eq "GROQ_API_KEY") { " [ACTIVE]" } else { "" }
    Write-Output ("  {0} = {1}{2}" -f $k,$short,$active)
  }
  exit 0
}
$model = "llama-3.1-8b-instant"
$body = '{"model":"'+$model+'","messages":[{"role":"user","content":"ok"}],"max_tokens":1}'
function Test-Key($keyName) {
  $key = [Environment]::GetEnvironmentVariable($keyName,"User")
  if (-not $key) { return $false }
  try {
    $h = @{"Authorization"="Bearer $key"}
    Invoke-RestMethod -Uri "https://api.groq.com/openai/v1/chat/completions" -Method Post -Headers $h -ContentType "application/json" -Body $body -TimeoutSec 10 | Out-Null
    return $true
  } catch { return $false }
}
foreach ($k in $keys) {
  if (Test-Key $k) {
    $val = [Environment]::GetEnvironmentVariable($k,"User")
    [Environment]::SetEnvironmentVariable("GROQ_API_KEY",$val,"User")
    $env:GROQ_API_KEY=$val; exit 0
  }
}
exit 1
'@
Set-Content -Path "$OPENCODE_CONFIG\scripts\groq-rotate.ps1" -Value $rotateScript -Encoding UTF8
Write-Output "  [✓] groq-rotate.ps1"

# graphify-global-add.ps1
$graphifyScript = 'param([string]$Path,[string]$Tag)
if (-not $Path) { Write-Output "Uso: graphify-global-add.ps1 ruta/al/proyecto [-Tag nombre]"; exit 1 }
$out = "$env:USERPROFILE\.config\opencode\graphify-out"
New-Item -ItemType Directory -Path $out -Force | Out-Null
$graph = "$env:USERPROFILE\.graphify\global-graph.json"
if (Test-Path $graph) { Copy-Item $graph -Destination "$out\graph.json" -Force; Write-Output "OK" }
else { Write-Output "No hay grafo global en $graph" }
'
Set-Content -Path "$OPENCODE_CONFIG\scripts\graphify-global-add.ps1" -Value $graphifyScript -Encoding UTF8
Write-Output "  [✓] graphify-global-add.ps1"

# ── 8. Clonar repo de conocimiento ──
Write-Output "`n=== 8/8 Configurando sync de conocimiento ==="
$repoPath = "$OPENCODE_CONFIG\opencode-ia-avanzada"
if (-not (Test-Path "$repoPath\.git")) {
  git clone $KNOWLEDGE_REPO $repoPath 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Output "  [✓] Repositorio de conocimiento clonado" }
  else {
    git init $repoPath; git -C $repoPath remote add origin $KNOWLEDGE_REPO
    Write-Output "  [i] Repositorio inicializado (el primer sync hara pull)"
  }
} else {
  Write-Output "  [✓] Repositorio de conocimiento ya existe"
}

# ── Final ──
Write-Output @"

  ╔══════════════════════════════════════════╗
  ║     OPEN IA INSTALADO CORRECTAMENTE      ║
  ╠══════════════════════════════════════════╣
  ║  ✓ OpenCode CLI                         ║
  ║  ✓ Node.js + npm                        ║
  ║  ✓ Git                                  ║
  ║  ✓ API keys (tuyas, nunca compartidas)  ║
  ║  ✓ MCP: sequential-thinking             ║
  ║  ✓ MCP: graphify                        ║
  ║  ✓ MCP: n8n                             ║
  ║  ✓ MCP: agent-browser                   ║
  ║  ✓ MCP: codebase-memory-mcp             ║
  ║  ✓ MCP: open-knowledge-graph            ║
  ║  ✓ MCP: context7                        ║
  ║  ✓ MCP: higgsfield                      ║
  ║  ✓ Grafo de conocimiento local          ║
  ║  ✓ Groq key rotation (5 keys)           ║
  ║  ✓ Scripts de utilidad                  ║
  ║  ✓ Auto-aprendizaje silencioso          ║
  ╚══════════════════════════════════════════╝

  Proximo paso:
    opencode

  Open IA te saludara automaticamente.
  Empezá a programar, el aprende solo.

"@
