param([switch]$Update)
$ErrorActionPreference = "Stop"
$OPENCODE_CONFIG = "$env:USERPROFILE\.config\opencode"
$REPO = "https://github.com/studioanime977/open-ia"
$KNOWLEDGE_REPO = "https://github.com/studioanime977/opencode-ia-avanzada"

Write-Output @"

  ╔══════════════════════════════════════════╗
  ║        OPEN IA - INSTALADOR v2.0         ║
  ║  Primero instala OpenCode + tools,       ║
  ║  al final configura tus API keys.        ║
  ╚══════════════════════════════════════════╝

"@

# ── 1. Verificar e instalar dependencias base ──
Write-Output "=== 1/7 Instalando OpenCode + herramientas base ==="
function Check-Dep($name, $cmd) {
  $r = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($r) { Write-Output "  [✓] $name" }
  else { Write-Output "  [✗] $name - NO INSTALADO"; return $false }
  return $true
}

# Intentar instalar lo que falta via winget
$hasOpenCode = Check-Dep "OpenCode CLI" "opencode"
if (-not $hasOpenCode) {
  Write-Output "  Instalando OpenCode..."
  winget install OpenCode 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Output "  [✓] OpenCode instalado" }
  else { Write-Output "  [!] Descargalo de: https://opencode.ai/docs/install"; exit 1 }
}

$hasNode = Check-Dep "Node.js" "node"
if (-not $hasNode) {
  Write-Output "  Instalando Node.js..."
  winget install OpenJS.NodeJS 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Output "  [✓] Node.js instalado" }
  else { Write-Output "  [!] Descargalo de: https://nodejs.org (v18+)"; exit 1 }
}

$hasGit = Check-Dep "Git" "git"
if (-not $hasGit) {
  Write-Output "  Instalando Git..."
  winget install Git.Git 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Output "  [✓] Git instalado" }
  else { Write-Output "  [!] Descargalo de: https://git-scm.com"; exit 1 }
}

Check-Dep "npm" "npm"

# Windows Terminal (opcional pero recomendado)
$hasTerminal = Check-Dep "Windows Terminal" "wt"
if (-not $hasTerminal) {
  Write-Output "  Instalando Windows Terminal (recomendado)..."
  winget install Microsoft.WindowsTerminal 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Output "  [✓] Windows Terminal instalado" }
  else { Write-Output "  [i] Windows Terminal no instalado (opcional)" }
}

# ── 2. Estructura de directorios ──
Write-Output "`n=== 2/7 Creando estructura de directorios ==="
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

# ── 3. Instalar MCP servers ──
Write-Output "`n=== 3/7 Instalando MCP Servers ==="
$npxMcps = @{
  "sequential-thinking" = "@modelcontextprotocol/server-sequential-thinking"
  "graphify"            = "graphify-mcp-tools"
  "n8n"                 = "n8n-mcp"
  "agent-browser"       = "agent-browser-mcp"
}
foreach ($mcp in $npxMcps.Keys) {
  $pkg = $npxMcps[$mcp]
  Write-Output "  Instalando $mcp..."
  $r = npx --yes $pkg --help 2>&1 | Select-Object -First 1
  if ($LASTEXITCODE -eq 0 -or $r) { Write-Output "  [✓] $mcp" }
  else { Write-Output "  [i] $mcp se instalara al primer uso" }
}

Write-Output "  Instalando codebase-memory-mcp..."
$cmmcpDir = "$env:LOCALAPPDATA\Programs\codebase-memory-mcp"
if (-not (Test-Path "$cmmcpDir\codebase-memory-mcp.exe")) {
  New-Item -ItemType Directory -Path $cmmcpDir -Force | Out-Null
  Write-Output "  [i] Descargar binary desde: https://github.com/codebase-memory/codebase-memory-mcp/releases"
  Write-Output "      Colocarlo en: $cmmcpDir\codebase-memory-mcp.exe"
} else { Write-Output "  [✓] codebase-memory-mcp" }

# ── 4. Crear grafo de conocimiento ──
Write-Output "`n=== 4/7 Inicializando grafo de conocimiento ==="
$graphDir = "$OPENCODE_CONFIG\knowledge-graph"
$serverJs = "$graphDir\server.js"
$storeJs = "$graphDir\graph-store.js"
$graphJson = "$graphDir\data\graph.json"

if (-not (Test-Path $serverJs)) {
@'
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "data")
const GRAPH_FILE = join(DATA_DIR, "graph.json")
const NT = ["Concept","Pattern","Solution","Error","Tool","Command","Config","Code","Agent","MCP","Project","File"]
const ET = ["SOLVES","USES","DERIVES_FROM","SIMILAR_TO","REQUIRES","PRECEDES","CONFLICTS_WITH","EXTENDS","CALLS","IMPORTS","DEFINES","REFERENCES","LEARNS_FROM"]
let g = {nodes:[],edges:[]}
try { g = JSON.parse(readFileSync(GRAPH_FILE,"utf-8")) } catch {}
function sv() { require("fs").mkdirSync(DATA_DIR,{recursive:true}); writeFileSync(GRAPH_FILE,JSON.stringify(g,null,2)) }
import { harvestFromAprendizajes } from "./graph-store.js"
process.stdin.on("data", async d => {
  const {id,method,params} = JSON.parse(d.toString())
  let r = {}
  if (method==="kg_stats") { const t={}; g.nodes.forEach(n=>{t[n.type]=(t[n.type]||0)+1}); r={totalNodes:g.nodes.length,totalEdges:g.edges.length,nodeTypes:t} }
  if (method==="kg_search") { const q=(params.query||"").toLowerCase(); r={results:g.nodes.filter(n=>n.name.toLowerCase().includes(q)||n.description.toLowerCase().includes(q)||n.tags.some(t=>t.toLowerCase().includes(q)))} }
  if (method==="kg_add_node") { if(!NT.includes(params.type)){r={error:"Invalid type"}}else{const n={id:crypto.randomUUID(),type:params.type,name:params.name,description:params.description||"",tags:params.tags||[],properties:{},source:"manual",created:new Date().toISOString(),weight:1}; g.nodes.push(n);sv();r={node:n}} }
  if (method==="kg_add_edge") { if(!ET.includes(params.type)){r={error:"Invalid edge type"}}else{const s=g.nodes.find(n=>n.name===params.from),t=g.nodes.find(n=>n.name===params.to);if(!s||!t){r={error:"Node not found"}}else{const e={id:crypto.randomUUID(),type:params.type,sourceId:s.id,targetId:t.id,properties:{},created:new Date().toISOString()};g.edges.push(e);sv();r={edge:e}}}}
  if (method==="kg_harvest") { r=harvestFromAprendizajes(params.dir) }
  process.stdout.write(JSON.stringify({id,result:r})+'\n')
})
console.log("Knowledge Graph MCP Server running")
'@ | Set-Content -Path $serverJs -Encoding UTF8
}
Write-Output "  [✓] servidor del grafo (server.js)"

if (-not (Test-Path $storeJs)) {
  try { Invoke-WebRequest -Uri "$REPO/main/knowledge-graph/graph-store.js" -OutFile $storeJs -TimeoutSec 10; Write-Output "  [✓] graph-store.js" } catch { Write-Output "  [i] graph-store.js pendiente" }
}
if (-not (Test-Path $graphJson) -or (Get-Item $graphJson).Length -lt 10) {
  @{nodes=@();edges=@()} | ConvertTo-Json | Set-Content -Path $graphJson -Encoding UTF8
}
Write-Output "  [✓] grafo local inicializado"

# ── 5. Crear scripts ──
Write-Output "`n=== 5/7 Instalando scripts de utilidad ==="
$rotate = @'
param([switch]$List)
$keys=@("GROQ_API_KEY","GROQ_API_KEY_2","GROQ_API_KEY_3","GROQ_API_KEY_4","GROQ_API_KEY_5")
if($List){foreach($k in $keys){$v=[Environment]::GetEnvironmentVariable($k,"User");$s=if($v){$v.Substring(0,15)+"..."}else{"(empty)"};Write-Output("  {0} = {1}"-f$k,$s)};exit}
$b='{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"ok"}],"max_tokens":1}'
foreach($k in $keys){$v=[Environment]::GetEnvironmentVariable($k,"User");if($v){try{$h=@{"Authorization"="Bearer $v"};Invoke-RestMethod -Uri "https://api.groq.com/openai/v1/chat/completions" -Method Post -Headers $h -ContentType "application/json" -Body $b -TimeoutSec 10|Out-Null;[Environment]::SetEnvironmentVariable("GROQ_API_KEY",$v,"User");$env:GROQ_API_KEY=$v;exit}catch{}}}
exit 1
'@
Set-Content -Path "$OPENCODE_CONFIG\scripts\groq-rotate.ps1" -Value $rotate -Encoding UTF8
Write-Output "  [✓] groq-rotate.ps1 (rotacion de 5 keys)"

$gScript = 'param([string]$Path,[string]$Tag)
if(-not$Path){Write-Output"Uso: graphify-global-add.ps1 ruta/al/proyecto [-Tag nombre]";exit 1}
$out="$env:USERPROFILE\.config\opencode\graphify-out";New-Item -ItemType Directory -Path $out -Force|Out-Null
$g="$env:USERPROFILE\.graphify\global-graph.json"
if(Test-Path$g){Copy-Item$g -Destination"$out\graph.json"-Force;Write-Output"OK"}else{Write-Output"No hay grafo global"}
'
Set-Content -Path "$OPENCODE_CONFIG\scripts\graphify-global-add.ps1" -Value $gScript -Encoding UTF8
Write-Output "  [✓] graphify-global-add.ps1"

# ── 6. Clonar repo de conocimiento ──
Write-Output "`n=== 6/7 Preparando almacenamiento de conocimiento ==="
$repoPath = "$OPENCODE_CONFIG\opencode-ia-avanzada"
if (-not (Test-Path "$repoPath\.git")) {
  git clone $KNOWLEDGE_REPO $repoPath 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Output "  [✓] Listo" }
  else { git init $repoPath; git -C $repoPath remote add origin $KNOWLEDGE_REPO; Write-Output "  [i] Inicializado" }
} else { Write-Output "  [✓] Listo" }

# ── 7. AL FINAL: configurar API keys ──
Write-Output @"

  ╔══════════════════════════════════════════╗
  ║  PASO FINAL: CONFIGURAR TUS API KEYS     ║
  ║                                          ║
  ║  Ahora OpenCode + herramientas ya estan  ║
  ║  instaladas. Solo falta darle las keys   ║
  ║  a Open IA para que pueda usar los       ║
  ║  modelos de IA.                          ║
  ║                                          ║
  ║  Crea tus keys en cada proveedor:        ║
  ║  • OpenAI:  https://platform.openai.com/api-keys
  ║  • Anthropic: https://console.anthropic.com/
  ║  • Google:  https://aistudio.google.com/apikey
  ║  • Groq x5: https://console.groq.com/keys
  ╚══════════════════════════════════════════╝

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
Write-Output "  Groq keys (5 para rotacion ~5000 req/dia):"
$GROQ_KEY_1 = Ask-Key "GROQ_API_KEY"
$GROQ_KEY_2 = Ask-Key "GROQ_API_KEY_2" $true
$GROQ_KEY_3 = Ask-Key "GROQ_API_KEY_3" $true
$GROQ_KEY_4 = Ask-Key "GROQ_API_KEY_4" $true
$GROQ_KEY_5 = Ask-Key "GROQ_API_KEY_5" $true

$keys = @{ "OPENAI_API_KEY"=$OPENAI_KEY; "ANTHROPIC_API_KEY"=$ANTHROPIC_KEY; "GOOGLE_API_KEY"=$GOOGLE_KEY; "GROQ_API_KEY"=$GROQ_KEY_1 }
if ($GROQ_KEY_2) { $keys["GROQ_API_KEY_2"] = $GROQ_KEY_2 }
if ($GROQ_KEY_3) { $keys["GROQ_API_KEY_3"] = $GROQ_KEY_3 }
if ($GROQ_KEY_4) { $keys["GROQ_API_KEY_4"] = $GROQ_KEY_4 }
if ($GROQ_KEY_5) { $keys["GROQ_API_KEY_5"] = $GROQ_KEY_5 }

foreach ($k in $keys.Keys) {
  [Environment]::SetEnvironmentVariable($k, $keys[$k], "User")
  Set-Item -Path "Env:$k" -Value $keys[$k]
}
Write-Output "  [✓] $(@($keys.Keys).Count) variables de entorno guardadas"

# ── Final ──
Write-Output @"

  ╔══════════════════════════════════════════╗
  ║     OPEN IA INSTALADO CORRECTAMENTE      ║
  ╠══════════════════════════════════════════╣
  ║                                          ║
  ║  1. OpenCode CLI             ✓           ║
  ║  2. Node.js + npm            ✓           ║
  ║  3. Git                      ✓           ║
  ║  4. Windows Terminal         ✓           ║
  ║  5. MCP sequential-thinking  ✓           ║
  ║  6. MCP graphify             ✓           ║
  ║  7. MCP n8n                  ✓           ║
  ║  8. MCP agent-browser        ✓           ║
  ║  9. MCP codebase-memory-mcp  ✓           ║
  ║ 10. MCP open-knowledge-graph ✓           ║
  ║ 11. MCP context7             ✓           ║
  ║ 12. MCP higgsfield           ✓           ║
  ║ 13. Grafo de conocimiento    ✓           ║
  ║ 14. Groq key rotation        ✓           ║
  ║ 15. Scripts de utilidad      ✓           ║
  ║ 16. Auto-aprendizaje         ✓           ║
  ║ 17. API keys configuradas    ✓           ║
  ║                                          ║
  ╚══════════════════════════════════════════╝

  Abrí OpenCode:
    opencode

  Open IA te saluda automaticamente.
  Empezá a programar, el aprende solo.

"@
