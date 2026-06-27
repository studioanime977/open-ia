<div align="center">

# ⎈ Open IA

**El asistente de IA que aprende solo, mientras programás.**

[![OpenCode](https://img.shields.io/badge/OpenCode-4.0-6C31DD?style=flat-square)](https://opencode.ai)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/studioanime977/open-ia/pulls)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Made with Love](https://img.shields.io/badge/made%20with-%E2%9D%A4-red?style=flat-square)](https://github.com/studioanime977)
[![Ko-Fi](https://img.shields.io/badge/☕-Café-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/studioanime977)

[Empezar](#⚡-instalación-en-2-pasos) • [Documentación](#arquitectura) • [Comandos](#comandos) • [Contribuir](#contribuir)

---


[![Ko-Fi](https://img.shields.io/badge/Invítame_un_café-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/studioanime977)

</div>

## ⚡ ¿Qué es Open IA?

Open IA es un **orquestador inteligente** que vive dentro de [OpenCode](https://opencode.ai).  
No es un chat común: **aprende de cada interacción**, construye un grafo de conocimiento que se vuelve más inteligente con cada uso, y orquesta múltiples modelos de IA (OpenAI, Anthropic, Google, Groq, locales) según la tarea.

```
Usuario → OpenCode → Open IA → ¿lo conozco? → sí → respondo
                               → no → busco en internet
                               → no → pregunto al grafo
                               → no → no invento, lo digo
```

> **Nunca inventa.** Si no encuentra información, lo dice.

---

## ⚡ Instalación en 2 pasos

### 1. Ejecutá el instalador

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/studioanime977/open-ia/main/install-opencode.ps1" -OutFile "$env:TEMP\install-opencode.ps1"
& "$env:TEMP\install-opencode.ps1"
```

### 2. Iniciá OpenCode

```powershell
opencode
```

> El instalador te va a pedir **tus API keys** al final.  
> Son **solo tuyas** — se guardan como variables de entorno, no se comparten, no se suben a ningún lado.

<details>
<summary><b>📦 Dependencias que instala automáticamente</b></summary>

| Dependencia | Versión | Propósito |
|---|---|---|
| [OpenCode](https://opencode.ai) | última | CLI principal |
| [Node.js](https://nodejs.org) | 18+ | Servidor del grafo de conocimiento |
| [Git](https://git-scm.com) | 2.x | Control de versiones y sync |
| [Windows Terminal](https://github.com/microsoft/terminal) | 1.x | Ctrl+C/V, pestañas, temas |

</details>

<details>
<summary><b>🔑 APIs que necesitás crear</b></summary>

| Proveedor | URL |
|---|---|
| [OpenAI](https://platform.openai.com/api-keys) | GPT-5, GPT-5.1 Codex, GPT-4o, o3 |
| [Anthropic](https://console.anthropic.com/) | Claude Opus 4.5, Sonnet 4.5, Haiku 4 |
| [Google](https://aistudio.google.com/apikey) | Gemini 3 Pro, Gemini 3 Flash |
| [Groq ×5](https://console.groq.com/keys) | Llama 4, Qwen 3, Groq Compound + rotación automática |

</details>

---

## 🧠 Auto-aprendizaje silencioso

Open IA aprende solo. No hace preguntas, no pide permiso.

| Evento | Qué hace | Qué ves |
|---|---|---|
| Resolvés un bug | Extrae solución → la guarda como nodo en el grafo | `✓ Grafo actualizado` |
| Encontrás un patrón | Crea nodo `Pattern` con tags y descripción | `✓ Grafo actualizado` |
| Escribís una config | Crea nodo `Config` con el detalle | `✓ Grafo actualizado` |
| Detecta un error | Crea nodo `Error` + edge `SOLVES` a la solución | `✓ Grafo actualizado` |

Solo ves `✓ Grafo actualizado localmente`. En segundo plano, Open IA construye un **grafo de conocimiento** que vincula conceptos, soluciones, errores y patrones.

---

## 🏗️ Arquitectura

```
~/.config/opencode/
├── opencode.jsonc           # Configuración principal
├── AGENTS.md                # Instrucciones globales
├── agents/                  # Agentes especializados
│   ├── openia.md            #   Open IA (orquestador)
│   ├── android-dev.md       #   Desarrollo Android
│   ├── web-dev.md           #   Desarrollo Web
│   ├── auto-learn.md        #   Auto-aprendizaje
│   ├── smart-fallback.md    #   Fallback inteligente
│   └── knowledge-graph.md   #   Grafo de conocimiento
├── knowledge-graph/         # Servidor MCP del grafo
│   ├── server.js            #   MCP server (stdin/stdout)
│   ├── graph-store.js       #   Motor de nodos + edges
│   └── data/graph.json      #   Datos persistentes
├── scripts/                 # Utilidades
│   ├── groq-rotate.ps1      #   Rotación de 5 keys Groq
│   └── graphify-global-add.ps1
└── opencode-ia-avanzada/    # Backup de aprendizajes
```

### MCP Servers

| Servidor | Tipo | Función |
|---|---|---|
| **open-knowledge-graph** | local | Grafo de conocimiento propio (9 tools) |
| **codebase-memory-mcp** | local | Grafo de código, 158 lenguajes |
| **graphify** | local | Grafo AST global de proyectos |
| **sequential-thinking** | local | Razonamiento estructurado |
| **n8n** | local | Workflows low-code |
| **agent-browser** | local | Automatización de navegador |
| **context7** | remoto | Documentación de librerías |
| **higgsfield** | remoto | Generación de imágenes/video |
| **github** | local | API de GitHub |

---

## 🎮 Comandos

| Comando | Descripción | Modelo |
|---|---|---|
| `/think` | Razonamiento estructurado paso a paso | Claude Sonnet 4.5 |
| `/hacker` | Modo hacker | Claude Sonnet 4.5 |
| `/matrix` | Modo Matrix | GPT-5 |
| `/kg` | Consulta al grafo de conocimiento | Big Pickle |
| `/scan` | Web Security Scanner | Gemini 3 Flash |
| `/spec` | Spec-Driven Development | Claude Sonnet 4.5 |
| `/design` | Diseño guiado por especificaciones | Claude Sonnet 4.5 |
| `/higgsfield` | Generar imágenes/video | Big Pickle |
| `/simplify` | Code Simplifier | Big Pickle |
| `/ui` | Modo diseñador UI/UX | Big Pickle |
| `/context` | Documentación de librerías | Big Pickle |
| `/offline` | Modo sin internet | Codestral 2501 |
| `/online` | Modo con internet | Big Pickle |
| `/fallback` | Fallback automático | Claude Opus 4.5 |
| `/aprender` | Forzar aprendizaje | Claude Sonnet 4.5 |
| `/autoapp` | Generar app completa | Big Pickle |

---

## 🤖 Modelos disponibles

### Groq Cloud (5000 req/día con 5 keys)

| Modelo | Contexto |
|---|---|
| **Llama 4 Scout 17B** | 131K |
| **Llama 3.3 70B** | 131K |
| **Qwen 3 32B** | 131K |
| **Groq Compound** | 131K |
| **GPT OSS 120B** | 131K |

### OpenAI

| Modelo | Contexto |
|---|---|
| **GPT-5** | 200K |
| **GPT-5.1 Codex** | 200K |
| **GPT-4o** | 128K |
| **o3** | 200K |

### Anthropic

| Modelo | Contexto |
|---|---|
| **Claude Opus 4.5** | 200K |
| **Claude Sonnet 4.5** | 200K |
| **Claude Haiku 4** | 200K |

### Google

| Modelo | Contexto |
|---|---|
| **Gemini 3 Pro** | 2M |
| **Gemini 3 Flash** | 1M |

### Locales (sin internet)

| Modelo | Contexto |
|---|---|
| **Qwen 3 235B** | 131K |
| **DeepSeek R1 671B** | 131K |
| **Codestral 2501** | 256K |

---

## 🔄 Groq Key Rotation

Cada key de Groq tiene ~1000 req/día. Open IA maneja **5 keys** en rotación automática:

```
GROQ_API_KEY   → key principal
GROQ_API_KEY_2 → respaldo 1
GROQ_API_KEY_3 → respaldo 2
GROQ_API_KEY_4 → respaldo 3
GROQ_API_KEY_5 → respaldo 4
```

Si falla una (HTTP 429), rota a la siguiente automáticamente.  
Si las 5 fallan, cambia de proveedor. **No ves nada, es transparente.**

---

## 🔒 Privacidad

- **Tus API keys son tuyas** — variables de entorno de Windows, no archivos, no se suben
- **100% local** — los MCP servers corren en tu máquina
- **No guarda datos sensibles** — API keys, tokens, contraseñas nunca se persisten

---

## 💻 Editores compatibles

| Editor | Estado |
|---|---|
| VS Code | ✅ Completa |
| Cursor | ✅ Completa |
| Windsurf | ✅ Completa |
| Neovim | ✅ Completa |
| JetBrains IDEs | ✅ Completa |
| Terminal directo | ✅ Completa |

---

## 🤝 Contribuir

¿Encontraste un bug? ¿Tenés una idea? ¿Algo no te funciona?  
Abrí un issue con la plantilla que corresponda:

| Template | Para qué |
|---|---|
| [🐛 Reportar bug](https://github.com/studioanime977/open-ia/issues/new?template=bug-report.md) | Algo no funciona |
| [💡 Solicitar feature](https://github.com/studioanime977/open-ia/issues/new?template=feature-request.md) | Una idea o mejora |
| [🔧 Problema de config](https://github.com/studioanime977/open-ia/issues/new?template=config-issue.md) | Open IA no arranca o se porta mal |
| [❓ Pregunta / Duda](https://github.com/studioanime977/open-ia/issues/new?template=question.md) | Algo no entendés |

O mandá un PR directo, sos bienvenido.

---

## ☕ Invítame un café

Si Open IA te sirve para laburar, estudiarrrr o tus proyectos, invitame un café:

[![Ko-Fi](https://img.shields.io/badge/Invitame_un_café-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/studioanime977)

Hasta acá llegamos sin pedir nada. Si querés colaborar, bienvenido sea 🙌

---

<div align="center">

**Hecho con ❤️ para la comunidad dev en español**

[Open IA](https://github.com/studioanime977/open-ia) • [OpenCode](https://opencode.ai) • [Reportar bug](https://github.com/studioanime977/open-ia/issues/new?template=bug-report.md) • [☕ Café](https://ko-fi.com/studioanime977)

</div>
