# Open IA - Inteligencia Artificial en tu Terminal

Sistema completo de AI coding agent basado en **OpenCode** con configuracion avanzada: MCP servers, auto-aprendizaje, grafo de conocimiento, modelos multiple (cloud + locales), y mas.

## Requisitos

| Recurso | Minimo | Recomendado |
|---------|--------|-------------|
| Sistema | Windows 10+ | Windows 11 |
| RAM     | 8 GB    | 16+ GB      |
| Disco   | 5 GB    | 20+ GB      |
| Internet | Si     | Fibra       |

## Instalacion Rapida (1 comando)

Abri **PowerShell como Administrador** y ejecuta:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; iwr -Uri "https://raw.githubusercontent.com/studioanime977/open-ia/main/install-opencode.ps1" -OutFile "$env:TEMP\install-opencode.ps1"; & "$env:TEMP\install-opencode.ps1"
```

### O paso a paso:

```powershell
# 1. Node.js
winget install OpenJS.NodeJS.LTS

# 2. Git
winget install Git.Git

# 3. OpenCode
npm install -g opencode-ai

# 4. GitHub CLI
winget install GitHub.cli
```

## Configuracion Manual

### 1. GitHub CLI (credenciales seguras)

```powershell
gh auth login
git config --global credential.helper "!gh auth git-credential"
```

### 2. Clonar configuracion

```powershell
mkdir -Force "$env:USERPROFILE\.config\opencode"
git clone https://github.com/studioanime977/opencode-ia-avanzada.git "$env:USERPROFILE\.config\opencode\opencode-ia-avanzada"
```

### 3. API Keys

| Proveedor      | Como configurar                    |
|----------------|------------------------------------|
| OpenCode Zen   | `/connect` en OpenCode             |
| Anthropic      | `ANTHROPIC_API_KEY` en variables   |
| OpenAI         | `OPENAI_API_KEY` en variables      |
| Google Gemini  | `GEMINI_API_KEY` en variables      |

## Comandos

| Comando     | Descripcion                          |
|-------------|--------------------------------------|
| `/hacker`   | Modo hacker                          |
| `/matrix`   | Modo Matrix                          |
| `/aprender` | Guarda aprendizajes al repo          |
| `/offline`  | Sin internet (modelos locales)       |
| `/online`   | Modo con internet                    |
| `/fallback` | Cambia modelo al agotar tokens       |
| `/autoapp`  | Genera app completa                  |
| `/ui`       | Disenador UI/UX                      |
| `/think`    | Razonamiento paso a paso             |
| `/context`  | Documentacion de librerias           |
| `/simplify` | Refactoriza codigo                   |
| `/design`   | Spec-Driven Development              |
| `/higgsfield`| Genera imagenes/video con IA        |
| `/openia`   | Orquestador inteligente (default)    |

## MCP Servers

| Server              | Tipo   | Descripcion                              |
|---------------------|--------|------------------------------------------|
| sequential-thinking | local  | Razonamiento estructurado                |
| context7            | remote | Documentacion de librerias               |
| n8n                 | local  | Automatizacion workflows                 |
| agent-browser       | local  | Automatizacion de navegador              |
| graphify            | local  | Grafo de conocimiento                    |
| higgsfield          | remote | Supercomputador de IA (imagen/video)     |

## Estructura

```
~/.config/opencode/
├── opencode.jsonc        # Config principal (modelo: Big Pickle)
├── AGENTS.md             # Instrucciones globales
├── tui.json              # Interfaz Matrix
├── themes/hacker.json    # Tema verde neon
└── opencode-ia-avanzada/ # Repo de conocimiento
    ├── aprendizajes/      # Conocimientos guardados automaticamente
    ├── agents/            # Agentes personalizados
    ├── prompts/           # Prompts de sistema
    └── .opencode/         # Config por proyecto
```

## Modelos Disponibles

- **Big Pickle** (default) - Modelo principal de OpenCode
- GPT-5.1 Codex - Codigo y tareas generales
- Claude Sonnet 4.5 - Razonamiento y planificacion
- Claude Opus 4.5 - Razonamiento profundo
- Gemini 3 Pro - Contexto largo
- Codestral 2501 - Codigo local (sin internet)

## Aprendizaje Automatico

Open IA aprende de cada interaccion y guarda los conocimientos en `aprendizajes/`.
Luego hace push automatico a GitHub sin exponer credenciales (usa `gh`).

Repo de conocimiento: https://github.com/studioanime977/opencode-ia-avanzada
