# ============================================================
# OPEN IA - Instalador Automático para Windows
# ============================================================
# Este script instala y configura todo lo necesario:
#   - OpenCode (AI coding agent)
#   - Node.js + npm
#   - GitHub CLI (gh) con auth segura
#   - MCP Servers (context7, sequential-thinking, n8n, etc.)
#   - Tema Matrix / Hacker
#   - Repositorio de conocimiento opencode-ia-avanzada
# ============================================================

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Instalando Open IA..."

Write-Host ""
Write-Host "██████████████████████████████████████████████████" -ForegroundColor Green
Write-Host "██                                          ██" -ForegroundColor Green
Write-Host "██   OPEN IA - INSTALADOR AUTOMATICO v1.0   ██" -ForegroundColor Green
Write-Host "██                                          ██" -ForegroundColor Green
Write-Host "██████████████████████████████████████████████████" -ForegroundColor Green
Write-Host ""

# ---- PASO 1: Node.js ----
Write-Host "[1/6] Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVer = node --version
    Write-Host "  [+] Node.js detectado: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  [-] Node.js no encontrado. Instalando..." -ForegroundColor Red
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Program Files\nodejs\"
    Write-Host "  [+] Node.js instalado" -ForegroundColor Green
}

# ---- PASO 2: Git ----
Write-Host "[2/6] Verificando Git..." -ForegroundColor Yellow
try {
    $gitVer = git --version
    Write-Host "  [+] Git detectado: $gitVer" -ForegroundColor Green
} catch {
    Write-Host "  [-] Git no encontrado. Instalando..." -ForegroundColor Red
    winget install Git.Git --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Program Files\Git\cmd\"
    Write-Host "  [+] Git instalado (reinicie la terminal)" -ForegroundColor Green
}

# ---- PASO 3: OpenCode ----
Write-Host "[3/6] Instalando OpenCode (AI coding agent)..." -ForegroundColor Yellow
npm install -g opencode-ai
Write-Host "  [+] OpenCode instalado globalmente" -ForegroundColor Green

# ---- PASO 4: GitHub CLI ----
Write-Host "[4/6] Instalando GitHub CLI..." -ForegroundColor Yellow
try {
    $ghVer = gh --version 2>$null
    Write-Host "  [+] GitHub CLI detectado: $ghVer" -ForegroundColor Green
} catch {
    winget install GitHub.cli --accept-source-agreements --accept-package-agreements
    $env:Path += ";C:\Program Files\GitHub CLI\"
    Write-Host "  [+] GitHub CLI instalado" -ForegroundColor Green
}

# ---- PASO 5: Clonar config de Open IA ----
Write-Host "[5/6] Descargando configuracion Open IA..." -ForegroundColor Yellow
$configDir = "$env:USERPROFILE\.config\opencode"

if (-not (Test-Path -LiteralPath "$configDir\opencode-ia-avanzada")) {
    New-Item -ItemType Directory -Path "$configDir" -Force | Out-Null
    # Clonar repositorio de conocimiento
    git clone https://github.com/studioanime977/opencode-ia-avanzada.git "$configDir\opencode-ia-avanzada"
    Write-Host "  [+] Configuracion descargada" -ForegroundColor Green
} else {
    Write-Host "  [*] Configuracion ya existe, actualizando..." -ForegroundColor Cyan
    Push-Location "$configDir\opencode-ia-avanzada"
    git pull
    Pop-Location
    Write-Host "  [+] Configuracion actualizada" -ForegroundColor Green
}

# Copiar archivos de config al directorio global
if (Test-Path -LiteralPath "$configDir\opencode-ia-avanzada\opencode.jsonc") {
    Copy-Item "$configDir\opencode-ia-avanzada\opencode.jsonc" "$configDir\opencode.jsonc" -Force
    Write-Host "  [+] opencode.jsonc copiado" -ForegroundColor Green
}
if (Test-Path -LiteralPath "$configDir\opencode-ia-avanzada\AGENTS.md") {
    Copy-Item "$configDir\opencode-ia-avanzada\AGENTS.md" "$configDir\AGENTS.md" -Force
    Write-Host "  [+] AGENTS.md copiado" -ForegroundColor Green
}
if (Test-Path -LiteralPath "$configDir\opencode-ia-avanzada\tui.json") {
    Copy-Item "$configDir\opencode-ia-avanzada\tui.json" "$configDir\tui.json" -Force
    Write-Host "  [+] tui.json copiado" -ForegroundColor Green
}
if (Test-Path -LiteralPath "$configDir\opencode-ia-avanzada\themes") {
    Copy-Item "$configDir\opencode-ia-avanzada\themes\*" "$configDir\themes\" -Recurse -Force
    Write-Host "  [+] Themes copiados" -ForegroundColor Green
}

# ---- PASO 6: Preparar MCP Servers (npx installs) ----
Write-Host "[6/6] Preparando MCP Servers..." -ForegroundColor Yellow
Write-Host "  [*] Los MCP servers se instalaran al primer uso de OpenCode:" -ForegroundColor Cyan
Write-Host "      - sequential-thinking (npx @modelcontextprotocol/server-sequential-thinking)" -ForegroundColor Gray
Write-Host "      - n8n (npx n8n-mcp)" -ForegroundColor Gray
Write-Host "      - agent-browser (npx agent-browser-mcp)" -ForegroundColor Gray
Write-Host "      - graphify (npx graphify-mcp-tools)" -ForegroundColor Gray

# ---- CONFIGURAR GIT SEGURO ----
Write-Host ""
Write-Host "████ CONFIGURACION FINAL ████" -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANTE: Autenticacion segura con GitHub" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor White
Write-Host "1. Cierra y abre UNA NUEVA TERMINAL" -ForegroundColor Cyan
Write-Host "2. Ejecuta: gh auth login" -ForegroundColor Green
Write-Host "   (Se abrira el navegador para autenticarte con GitHub)" -ForegroundColor Gray
Write-Host "3. Luego ejecuta: git config --global credential.helper '!gh auth git-credential'" -ForegroundColor Green
Write-Host ""

Write-Host "████ RESUMEN ████" -ForegroundColor Yellow
Write-Host "  [+] Node.js    - $(node --version 2>$null)" -ForegroundColor Green
Write-Host "  [+] Git        - $(git --version 2>$null)" -ForegroundColor Green
Write-Host "  [+] OpenCode   - $(opencode --version 2>$null)" -ForegroundColor Green
Write-Host "  [+] Config     - $configDir" -ForegroundColor Green
Write-Host ""

Write-Host "Para iniciar OpenCode, escribe: opencode" -ForegroundColor Green
Write-Host "Para ayuda en OpenCode, escribe: /help" -ForegroundColor Green
Write-Host ""
