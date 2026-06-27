# Open IA — Asistente de IA Avanzado para OpenCode

**Open IA** es un sistema de inteligencia artificial que vive dentro de [OpenCode](https://opencode.ai).  
No es un chat común: **aprende de cada interacción**, construye un grafo de conocimiento que se vuelve más inteligente con cada uso, y orquesta múltiples modelos de IA según la tarea.

---

## Índice

- [¿Cómo funciona?](#cómo-funciona)
- [Auto-aprendizaje silencioso](#auto-aprendizaje-silencioso)
- [Instalación](#instalación)
- [Requisitos](#requisitos)
- [APIs necesarias](#apis-necesarias)
- [Arquitectura completa](#arquitectura-completa)
- [Modelos disponibles](#modelos-disponibles)
- [MCP Servers](#mcp-servers)
- [Comandos personalizados](#comandos-personalizados)
- [Groq Key Rotation](#groq-key-rotation)
- [Terminal recomendada](#terminal-recomendada)
- [Stack tecnológico](#stack-tecnológico)
- [Privacidad y seguridad](#privacidad-y-seguridad)

---

## ¿Cómo funciona?

Open IA no es un asistente estático. Es un **orquestador inteligente** que:

1. **Escucha** cada interacción con el usuario
2. **Aprende** automáticamente: extrae patrones, soluciones, errores, configuraciones
3. **Guarda** en un grafo de conocimiento local (nodos + conexiones semánticas)
4. **Reutiliza** ese conocimiento en respuestas futuras

Cuando le preguntás algo, sigue este flujo de investigación:

```
¿Tengo esto en mi grafo local?  →  kg_semantic_search
No → ¿Lo tengo en aprendizajes? →  kg_search + kg_harvest  
No → ¿Lo tengo en el grafo AST? →  graphify query
No → ¿Puedo buscar en internet?  →  websearch / webfetch
No → ¿Hay docs actualizadas?     →  Context7 MCP
No → No invento, digo que no sé
```

**Nunca inventa.** Si no encuentra información, lo dice.

---

## Auto-aprendizaje silencioso

Open IA aprende solo. No hace preguntas, no pide permiso.

| Evento | Qué hace Open IA | Qué ve el usuario |
|--------|-----------------|-------------------|
| Resolvés un problema | Extrae solución, la guarda como nodo en el grafo | `✓ Grafo actualizado localmente` |
| Encontrás un patrón | Crea nodo `Pattern` con tags y descripción | `✓ Grafo actualizado localmente` |
| Escribís una config | Crea nodo `Config` con el detalle | `✓ Grafo actualizado localmente` |
| Se detecta un error | Crea nodo `Error` + edge `SOLVES` a la solución | `✓ Grafo actualizado localmente` |

Solo ve `✓ Grafo actualizado localmente`.

---

## Instalación

Cada usuario crea **sus propias API keys** durante la instalación.  
Nunca se comparten entre usuarios ni se suben a repos.

### Paso 1: Instalar dependencias

```powershell
# Windows Terminal (recomendado) — ver sección "Terminal recomendada"
winget install Microsoft.WindowsTerminal
winget install OpenCode
winget install Git.Git
winget install OpenJS.NodeJS
```

### Paso 2: Descargar y ejecutar el instalador

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/studioanime977/open-ia/main/install-opencode.ps1" -OutFile "$env:TEMP\install-opencode.ps1"
& "$env:TEMP\install-opencode.ps1"
```

El instalador hace todo automáticamente:

1. **Instala OpenCode + herramientas** (Node.js, Git, Windows Terminal)
2. **Prepara MCP servers** (sequential-thinking, graphify, n8n, agent-browser, etc.)
3. **Crea el grafo de conocimiento local**
4. **Al final**: te pide tus API keys y las configura

### Paso 3: Iniciar OpenCode

```powershell
opencode
```

Open IA te saludará automáticamente y comenzará a aprender desde el primer mensaje.

---

## Requisitos

| Dependencia | Versión | Para qué |
|------------|---------|----------|
| [OpenCode](https://opencode.ai) | última | CLI principal — el asistente vive dentro de OpenCode |
| [Node.js](https://nodejs.org) | v18+ | Servidor del grafo de conocimiento local |
| [Git](https://git-scm.com) | 2.x | Gestión de proyectos y control de versiones |
| [Windows Terminal](https://github.com/microsoft/terminal) | 1.x | Terminal con Ctrl+C/Ctrl+V, pestañas, temas |

---

## APIs necesarias

El instalador te pedirá que crees tus propias keys en estos proveedores:

| Proveedor | URL | Por qué |
|-----------|-----|---------|
| **OpenAI** | https://platform.openai.com/api-keys | GPT-5, GPT-5.1 Codex, GPT-4o, o3 |
| **Anthropic** | https://console.anthropic.com/ | Claude Opus 4.5, Sonnet 4.5, Haiku 4 |
| **Google** | https://aistudio.google.com/apikey | Gemini 3 Pro, Gemini 3 Flash |
| **Groq (x5)** | https://console.groq.com/keys | Llama 4, Qwen 3, Compound (rotación automática) |

Las keys se guardan como **variables de entorno de Windows** (`[Environment]::SetEnvironmentVariable(..., "User")`),  
no en archivos de configuración, no en el repo, no se comparten.

---

## Arquitectura completa

```
~/.config/opencode/
│
├── opencode.jsonc              # Configuración principal (proveedores, MCPs, comandos)
├── AGENTS.md                   # Instrucciones globales para Open IA
│
├── agents/                     # Prompts de cada agente especializado
│   ├── openia.md               #   Open IA — orquestador por defecto
│   ├── android-dev.md          #   Desarrollo Android
│   ├── web-dev.md              #   Desarrollo Web
│   ├── auto-learn.md           #   Auto-aprendizaje
│   ├── smart-fallback.md       #   Fallback inteligente
│   ├── knowledge-graph.md      #   Grafo de conocimiento
│   └── web-scanner.md          #   Escáner de seguridad
│
├── prompts/                    # Templates de prompts para subagentes
│   ├── android.txt
│   ├── web.txt
│   ├── auto-learn.txt
│   ├── offline.txt
│   └── smart-fallback.txt
│
├── scripts/                    # Scripts de utilidad
│   ├── groq-rotate.ps1         #   Rotación automática de 5 API keys Groq
│   └── graphify-global-add.ps1 #   Agrega proyecto al grafo AST global
│
├── themes/                     # Temas visuales para OpenCode
│   └── hacker.json             #   Tema verde neón Matrix
│
├── plugins/                    # Plugins de OpenCode
│   └── graphify.js             #   Recordatorio de grafo de conocimiento
│
├── knowledge-graph/            # Servidor MCP del grafo de conocimiento
│   ├── server.js               #   MCP server (stdin/stdout)
│   ├── graph-store.js          #   Motor del grafo (nodos, edges, FTS, semántico)
│   └── data/
│       └── graph.json          #   Datos persistentes del grafo
│
├── graphify-out/               # Grafos AST de proyectos (se llena automáticamente)
│
└── opencode-ia-avanzada/       # Backup local de aprendizajes
    └── aprendizajes/           # Archivos .md de aprendizaje
        └── *.md
```

---

## Modelos disponibles

### Groq Cloud (con rotación de 5 keys ~5000 req/día)

| Modelo | Contexto | Características |
|--------|----------|----------------|
| **Llama 4 Scout 17B** | 131K | Visión + texto, tools, json_mode |
| **Llama 3.3 70B** | 131K | Razonamiento profundo, tools, json_mode |
| **Qwen 3 32B** | 131K | Código + razonamiento, tools |
| **Qwen 3.6 27B** | 131K | Visión + razonamiento, tools |
| **Groq Compound** | 131K | Modelo flagship de Groq |
| **GPT OSS 120B** | 131K | 120B parámetros, reasoning, structured outputs |
| **Llama 3.1 8B** | 131K | Ultra rápido, chat ligero |

### OpenAI

| Modelo | Contexto | Uso |
|--------|----------|-----|
| **GPT-5** | 200K | Tareas generales pesadas |
| **GPT-5.1 Codex** | 200K | Generación de código |
| **GPT-4o** | 128K | Tareas ligeras |
| **o3** | 200K | Razonamiento profundo |

### Anthropic

| Modelo | Contexto | Uso |
|--------|----------|-----|
| **Claude Opus 4.5** | 200K | Razonamiento complejo, fallback |
| **Claude Sonnet 4.5** | 200K | Planificación, análisis |
| **Claude Haiku 4** | 200K | Tareas rápidas |

### Google

| Modelo | Contexto | Uso |
|--------|----------|-----|
| **Gemini 3 Pro** | 2M | Contextos ultra largos |
| **Gemini 3 Flash** | 1M | Rápido, escaneo web |

### Locales (sin internet)

| Modelo | Contexto | Desde |
|--------|----------|-------|
| **Qwen 3 235B** | 131K | Ollama |
| **DeepSeek R1 671B** | 131K | Ollama |
| **Codestral 2501** | 256K | Ollama — código |
| **Modelo local cualquiera** | variable | LM Studio |

---

## MCP Servers

Open IA se conecta a estos servidores vía Model Context Protocol:

| Servidor | Tipo | Función |
|----------|------|---------|
| **open-knowledge-graph** | local (Node.js) | Grafo de conocimiento propio — 9 tools de consulta y escritura |
| **codebase-memory-mcp** | local (binary) | Grafo de código — 158 lenguajes, Hybrid LSP, 14 tools |
| **graphify** | local (npx) | Grafo AST global de proyectos |
| **sequential-thinking** | local (npx) | Razonamiento estructurado paso a paso |
| **n8n** | local (npx) | Automatización de workflows low-code |
| **agent-browser** | local (npx) | Automatización de navegador E2E |
| **context7** | remoto | Documentación actualizada de librerías |
| **higgsfield** | remoto | Generación de imágenes y video (30+ modelos) |
| **github** | local (npx) | API de GitHub |

---

## Comandos personalizados

| Comando | Descripción | Agente | Modelo |
|---------|-------------|--------|--------|
| `/hacker` | Modo hacker con terminología de ciberseguridad | build | Claude Sonnet 4.5 |
| `/matrix` | Modo Matrix — estilo filosófico-digital | build | GPT-5 |
| `/think` | Razonamiento estructurado paso a paso | plan | Claude Sonnet 4.5 |
| `/kg` | Consulta al grafo de conocimiento | knowledge-graph | Big Pickle |
| `/scan` | Web Security Scanner — analiza SSL, headers, SQLi | web-scanner | Gemini 3 Flash |
| `/spec` | Spec-Driven Development | plan | Claude Sonnet 4.5 |
| `/design` | Diseño guiado por especificaciones | plan | Claude Sonnet 4.5 |
| `/higgsfield` | Generar imágenes/video con IA | build | Big Pickle |
| `/simplify` | Code Simplifier — refactoriza código | build | Big Pickle |
| `/ui` | Modo diseñador UI/UX | web-dev | Big Pickle |
| `/context` | Documentación actualizada de librerías | build | Big Pickle |
| `/offline` | Modo sin internet (solo modelos locales) | build | Codestral 2501 |
| `/online` | Modo con internet (todos los modelos cloud) | build | Big Pickle |
| `/fallback` | Fallback automático al siguiente modelo disponible | smart-fallback | Claude Opus 4.5 |
| `/aprender` | Forzar extracción de aprendizaje | auto-learn | Claude Sonnet 4.5 |
| `/autoapp` | Generar app completa automáticamente | build | Big Pickle |

---

## Groq Key Rotation

Cada API key de Groq tiene un límite de ~1000 requests por día.  
Open IA maneja **5 keys** en rotación automática:

```
GROQ_API_KEY     → key principal (activa)
GROQ_API_KEY_2   → respaldo 1
GROQ_API_KEY_3   → respaldo 2
GROQ_API_KEY_4   → respaldo 3
GROQ_API_KEY_5   → respaldo 4
```

Cuando una key se agota (HTTP 429):

1. Open IA ejecuta `groq-rotate.ps1`
2. El script prueba cada key contra la API de Groq
3. Activa la primera que responde
4. Open IA reintenta la petición

Si las 5 fallan, Open IA cambia automáticamente a otro proveedor (OpenAI, Anthropic, Google o modelo local).  
Esto es **transparente para el usuario** — no ve errores ni rotaciones.

---

## Editores de código compatibles

Open IA funciona con **cualquier editor** donde uses OpenCode. No está atado a uno en particular.

| Editor / Terminal | Compatibilidad | Notas |
|------------------|---------------|-------|
| **VS Code** | ✅ Completa | Terminal integrada + extensiones |
| **Cursor** | ✅ Completa | Editor IA-nativo, OpenCode funciona en su terminal |
| **Windsurf** | ✅ Completa | Terminal integrada con IA |
| **GitHub Codespaces** | ✅ Completa | OpenCode en el navegador |
| **Neovim** | ✅ Completa | Con terminal integrada |
| **JetBrains IDEs** | ✅ Completa | Terminal integrada o externa |
| **Cline** | ✅ Compatible | Extensión de IA para VS Code |
| **Terminal directo** | ✅ Completa | Windows Terminal, PowerShell 7, Hyper |

> **Cursor** (https://cursor.com) y **Windsurf** (https://codeium.com/windsurf) son editores con IA integrada que pueden ejecutar OpenCode en su terminal. Open IA orquesta los modelos desde adentro.

## Terminal recomendada

La consola clásica de PowerShell (conhost.exe) **no soporta correctamente Ctrl+C / Ctrl+V** para copiar y pegar.  
Para una experiencia completa con OpenCode, usá **Windows Terminal**:

```powershell
# Instalar Windows Terminal
winget install Microsoft.WindowsTerminal
```

Windows Terminal ofrece:
- Ctrl+C / Ctrl+V para copiar y pegar
- Múltiples pestañas
- Temas personalizables (incluido el tema hacker de Open IA)
- Soporte completo para OpenCode

> **Alternativas**: también podés usar [PowerShell 7](https://github.com/PowerShell/PowerShell) o [Hyper](https://hyper.is/), pero Windows Terminal es la opción recomendada por Microsoft y la más compatible.

---

## Stack tecnológico

| Componente | Tecnología |
|-----------|------------|
| **CLI** | OpenCode (TypeScript/Node.js) |
| **Orquestador** | Open IA (agente por defecto) |
| **Grafo de conocimiento** | Node.js, MCP Protocol (stdin/stdout) |
| **Scripts** | PowerShell 5.1+ |
| **Sync** | Git (background jobs) |
| **Modelos cloud** | OpenAI API, Anthropic API, Google AI API, Groq API |
| **Modelos locales** | Ollama, LM Studio |
| **MCP remotos** | HiggsField, Context7 |
| **MCP locales** | sequential-thinking, n8n, agent-browser, graphify |
| **Terminal** | Windows Terminal (recomendada) |

---

## Privacidad y seguridad

- **Tus API keys son tuyas**. El instalador las guarda como variables de entorno de Windows (`User` level).  
  No están en ningún archivo. No se comparten. No se suben a repos.

- **Datos sensibles**: Open IA tiene instrucciones explícitas de **nunca guardar** API keys,  
  tokens, contraseñas ni ningún dato sensible. Solo guarda conocimiento técnico y patrones.

- **El código es 100% local**. Los MCP servers locales (knowledge-graph, codebase-memory-mcp)  
  corren en tu máquina. No envían datos a terceros.

---

## Licencia

Este proyecto es de código abierto.  
Cada usuario es responsable de sus propias API keys y del uso que hace de los proveedores de IA.
