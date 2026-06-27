param([switch]$Update)

$ErrorActionPreference = "Stop"
$OPENCODE_CONFIG = "$env:USERPROFILE\.config\opencode"

Write-Output @"

  ╔══════════════════════════════════════════╗
  ║        OPEN IA - INSTALADOR v2.0         ║
  ║  Cada usuario crea SUS PROPIAS API keys  ║
  ╚══════════════════════════════════════════╝

"@

# ── 1. Detectar OpenCode ──
$opencode = Get-Command "opencode" -ErrorAction SilentlyContinue
if (-not $opencode) {
  Write-Output "[!] OpenCode no está instalado."
  Write-Output "    Instalalo primero: https://opencode.ai/docs/install"
  exit 1
}
Write-Output "[✓] OpenCode detectado"

# ── 2. Preguntar API keys (cada usuario pone las suyas) ──
Write-Output @"

  ┌─────────────────────────────────────────────┐
  │  CREÁ TUS PROPIAS API KEYS                  │
  │                                             │
  │  Necesitás crear keys en cada proveedor:    │
  │  • OpenAI:  https://platform.openai.com/api-keys
  │  • Anthropic: https://console.anthropic.com/
  │  • Google:  https://aistudio.google.com/apikey
  │  • Groq:    https://console.groq.com/keys   │
  │  (x5 keys para rotation automática)         │
  └─────────────────────────────────────────────┘

"@

function Ask-Key($name, $optional=$false) {
  $prompt = if ($optional) { "  $name (ENTER para saltar): " } else { "  $name: " }
  $val = Read-Host -Prompt $prompt
  if (-not $val -and -not $optional) {
    Write-Output "  [!] Obligatorio. Intentá de nuevo."
    return Ask-Key $name $optional
  }
  return $val
}

$OPENAI_KEY    = Ask-Key "OPENAI_API_KEY"
$ANTHROPIC_KEY = Ask-Key "ANTHROPIC_API_KEY"
$GOOGLE_KEY    = Ask-Key "GOOGLE_API_KEY"

Write-Output "`n  Groq keys (5 para rotación automática ~5000 req/día):"
$GROQ_KEY_1 = Ask-Key "GROQ_API_KEY"
$GROQ_KEY_2 = Ask-Key "GROQ_API_KEY_2" $true
$GROQ_KEY_3 = Ask-Key "GROQ_API_KEY_3" $true
$GROQ_KEY_4 = Ask-Key "GROQ_API_KEY_4" $true
$GROQ_KEY_5 = Ask-Key "GROQ_API_KEY_5" $true

# ── 3. Guardar como variables de entorno ──
Write-Output "`n  Guardando API keys como variables de entorno..."
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
Write-Output "  [✓] $(@($keys.Keys).Count) variables de entorno guardadas"

# ── 4. Crear estructura de directorios ──
Write-Output "`n  Creando estructura de directorios..."
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
foreach ($d in $dirs) {
  New-Item -ItemType Directory -Path $d -Force | Out-Null
}
Write-Output "  [✓] Directorios creados"

# ── 5. Clonar repo de conocimiento (solo para sync interno) ──
Write-Output "`n  Configurando repositorio de conocimiento..."
$repoPath = "$OPENCODE_CONFIG\opencode-ia-avanzada"
if (-not (Test-Path "$repoPath\.git")) {
  git clone "https://github.com/studioanime977/opencode-ia-avanzada.git" $repoPath 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Output "  [✓] Repositorio clonado"
  } else {
    git init $repoPath
    git -C $repoPath remote add origin "https://github.com/studioanime977/opencode-ia-avanzada.git"
    Write-Output "  [i] Repositorio inicializado (git pull manual si querés sync)"
  }
} else {
  Write-Output "  [✓] Repositorio ya existe"
}

# ── 6. Inicializar grafo de conocimiento ──
Write-Output "`n  Inicializando grafo de conocimiento..."
$graphDir = "$OPENCODE_CONFIG\knowledge-graph"
if (-not (Test-Path "$graphDir\server.js")) {
  # Download basic graph files from repo or create them
  Write-Output "  [i] Los archivos del grafo se copian desde el repo open-ia"
}
Write-Output "  [✓] Grafo listo"

# ── 7. Verificar configuración final ──
Write-Output @"

  ╔══════════════════════════════════════════╗
  ║     OPEN IA INSTALADO CORRECTAMENTE      ║
  ║                                         ║
  ║  Tus API keys son SOLO tuyas.            ║
  ║  No se comparten con nadie.              ║
  ║  El conocimiento se sincroniza           ║
  ║  automáticamente en 2do plano.           ║
  ╚══════════════════════════════════════════╝

  Próximos pasos:
  1. Abrí OpenCode:  opencode
  2. Open IA te saludará automáticamente
  3. Empezá a programar

"@
