# Open IA - Asistente IA Avanzado para OpenCode

**Open IA** es un sistema de inteligencia artificial que vive dentro de [OpenCode](https://opencode.ai). 
Aprende de cada interacción y construye un grafo de conocimiento que se vuelve más inteligente con cada uso.

## Características

- **Auto-aprendizaje continuo** — cada interacción deja conocimiento
- **Grafo de conocimiento local** — memoria persistente con nodos y conexiones semánticas
- **Multi-proveedor** — OpenAI, Anthropic, Google, Groq (con rotación automática de API keys)
- **MCP Servers** — HiggsField, Context7, codebase-memory-mcp, n8n, Sequential Thinking
- **Spec-Driven Development** — flujo de desarrollo guiado por especificaciones
- **Web Security Scanner** — analiza sitios antes de abrirlos
- **Comandos personalizados** — `/hacker`, `/matrix`, `/think`, `/kg`, `/scan` y más

## Instalación

Cada usuario crea **sus propias API keys** durante la instalación. Nunca se comparten.

```powershell
# 1. Descargar el instalador
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/studioanime977/open-ia/main/install-opencode-ia.ps1" -OutFile "$env:TEMP\install-opencode-ia.ps1"

# 2. Ejecutar
& "$env:TEMP\install-opencode-ia.ps1"

# 3. Iniciar OpenCode
opencode
```

El instalador te pedirá:
- **OpenAI API Key** (https://platform.openai.com/api-keys)
- **Anthropic API Key** (https://console.anthropic.com/)
- **Google API Key** (https://aistudio.google.com/apikey)
- **5 Groq API Keys** para rotación automática (https://console.groq.com/keys)

Tus keys se guardan como variables de entorno de Windows, **nunca en archivos de configuración**.

## Arquitectura

```
~/.config/opencode/
├── opencode.jsonc          # Configuración principal
├── AGENTS.md               # Instrucciones globales
├── agents/                 # Prompts de cada agente
├── prompts/                # Templates de prompts
├── scripts/                # Scripts de utilidad
├── knowledge-graph/        # Servidor MCP del grafo de conocimiento
│   └── data/graph.json     # Datos persistentes del grafo
└── opencode-ia-avanzada/   # Conocimiento compartido entre amigos
    └── aprendizajes/       # Archivos .md de aprendizaje
```

## Modelos Disponibles

### Groq Cloud (con rotación de 5 keys)
- Llama 4 Scout 17B (visión + herramientas)
- Llama 3.3 70B (razonamiento)
- Qwen 3 32B (código + razonamiento)
- Qwen 3.6 27B (visión + razonamiento)
- Groq Compound
- GPT OSS 120B

### Otros proveedores
- OpenAI (GPT-5, GPT-5.1 Codex, GPT-4o, o3)
- Anthropic (Claude Opus 4.5, Sonnet 4.5, Haiku 4)
- Google (Gemini 3 Pro, Gemini 3 Flash)
- Locales: LM Studio, Ollama (Qwen 3, DeepSeek R1, Codestral)

## Comandos

| Comando | Descripción |
|---------|-------------|
| `/hacker` | Modo hacker |
| `/matrix` | Modo Matrix |
| `/think` | Razonamiento estructurado paso a paso |
| `/kg` | Consulta al grafo de conocimiento |
| `/scan` | Web Security Scanner |
| `/spec` | Spec-Driven Development |
| `/higgsfield` | Generar imágenes/video |
| `/offline` | Modo sin internet |
| `/online` | Modo con internet |
| `/fallback` | Fallback automático de modelo |

## Privacidad

- **Tus API keys son tuyas**. El instalador las guarda como variables de entorno locales.
- **No se comparten** con otros usuarios ni se suben a ningún repo.
- El conocimiento que Open IA aprende (patrones, soluciones, configuraciones) se sincroniza de forma anónima entre usuarios para beneficio colectivo.
- **Nunca se sincronizan datos sensibles** (keys, tokens, contraseñas).

## Stack Tecnológico

- OpenCode (CLI)
- Node.js (grafo de conocimiento local)
- PowerShell (scripts de instalación y rotación)
- MCP Protocol (conexión con servicios externos)
