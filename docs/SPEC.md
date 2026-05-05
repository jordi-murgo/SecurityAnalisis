# SPEC — MVP del CLI `cybersecurity`

**Regla:** esta es la fuente de verdad funcional del MVP. Si implementación y especificación difieren, la implementación está mal o la SPEC quedó desactualizada.

---

## 1. Objetivo

Construir un CLI llamado `cybersecurity` que:

1. reciba un repositorio GitHub en formato `owner/repo`,
2. lo clone localmente en un workspace,
3. construya un `PROJECT CONTEXT` mínimo,
4. ejecute el skill `cybersecurity`,
5. valide y persista el reporte canónico que ya devuelve el skill en Markdown y HTML.

---

## 2. Alcance del MVP

Incluido en MVP:

- Entrada por `owner/repo`.
- Scopes `full`, `quick` y `diff`.
- Flags `--scope`, `--model`, `--provider`, `--force`, `--output`.
- Resolución de configuración por flags, entorno y archivo.
- Generación de `report.md` y `report.html`.
- Validación mínima del reporte final.

Fuera de alcance en MVP:

- Entrada directa por path local.
- UI web.
- Persistencia histórica de auditorías.
- Soporte completo multi-provider más allá del contrato mínimo.
- Reescribir o duplicar la lógica del skill dentro del CLI.

---

## 3. Comando oficial

Nombre del comando: `cybersecurity`

Invocación canónica:

```bash
cybersecurity owner/repo [--scope full|quick|diff] [--model <model-id>] [--provider <provider-id>] [--force] [--output <dir>]
```

### 3.1 Argumentos y flags

| Parámetro | Tipo | Obligatorio | Default | Regla |
| --- | --- | --- | --- | --- |
| `owner/repo` | string | sí | - | Debe matchear `^[^/\\s]+/[^/\\s]+$` |
| `--scope` | enum | no | `full` | Valores válidos: `full`, `quick`, `diff` |
| `--model` | string | no | resuelto por config | Sobrescribe env/config |
| `--provider` | string | no | resuelto por config | Sobrescribe env/config |
| `--force` | boolean | no | `false` | Si existe workspace, reclona |
| `--output` | path | no | `./workspace` | Directorio raíz de trabajo |

### 3.2 Validaciones

- Si `owner/repo` no existe o es inválido → exit code `2`.
- Si `--scope` tiene un valor no soportado → exit code `2`.
- Si `--output` no es escribible → exit code `5`.

---

## 4. Flujo exacto de ejecución

El CLI debe ejecutar exactamente este flujo:

1. Parsear argumentos.
2. Resolver configuración efectiva.
3. Validar `owner/repo` y `scope`.
4. Determinar `repoName = owner/repo.split('/')[1]`.
5. Determinar `workspaceDir = <output>/<repoName>`.
6. Si `workspaceDir` no existe, ejecutar `gh repo clone owner/repo <workspaceDir>`.
7. Si `workspaceDir` existe y `--force` es `false`, reutilizarlo.
8. Si `workspaceDir` existe y `--force` es `true`, eliminarlo y volver a clonar.
9. Ejecutar `buildContext(workspaceDir, scope)`.
10. Ejecutar `runCybersecuritySkill(projectContext, executionOptions)`.
11. Validar la respuesta del skill.
12. Validar que `rawReport` ya respeta el formato de reporte canónico.
13. Escribir:
		- `<workspaceDir>/report.md`
		- `<workspaceDir>/report.html`
14. Imprimir ambas rutas en stdout.
15. Terminar con exit code `0`.

---

## 5. Contrato de configuración

Orden de prioridad:

1. flags CLI,
2. variables de entorno,
3. archivo `cybersecurity.json` en la raíz del ejecutor.

### 5.1 Variables de entorno

- `CC_WORKSPACE_DIR`
- `CC_LLM_PROVIDER`
- `CC_LLM_MODEL`

### 5.2 Archivo `cybersecurity.json`

Formato exacto:

```json
{
	"workspaceDir": "./workspace",
	"llmProvider": "ollama",
	"llmModel": "deepseek-r1:8b"
}
```

### 5.3 Reglas del MVP

- El archivo de config es opcional.
- Si no hay `provider` resuelto, el MVP usa `ollama` por defecto.
- Si no hay `model` resuelto, el MVP puede usar un valor por defecto documentado o fallar con mensaje explícito. Esa decisión debe ser consistente en implementación y tests.

---

## 6. Contrato `buildContext`

`buildContext(workspaceDir, scope)` debe devolver un objeto JSON con esta forma mínima:

```json
{
	"repo": "owner/repo",
	"workspaceDir": "./workspace/repo",
	"scope": "quick",
	"files": ["src/index.js"],
	"manifests": ["package.json"],
	"detectedLanguages": ["JavaScript/TypeScript"],
	"topFiles": ["src/index.js"],
	"changedFiles": ["src/index.js"],
	"git": {
		"hasRepo": true,
		"defaultBranch": "main"
	}
}
```

Reglas:

- `changedFiles` solo es obligatorio cuando `scope = diff`.
- `topFiles` debe contener un subconjunto priorizado para análisis.
- El contexto no debe incluir secretos expuestos ni blobs binarios.

---

## 7. Boundary `CLI ↔ skill`

El CLI no implementa la lógica de seguridad. El CLI orquesta; el skill analiza y devuelve el reporte final.

### 7.1 Input al skill

`runCybersecuritySkill(projectContext, executionOptions)` recibe:

```json
{
	"projectContext": {
		"repo": "owner/repo",
		"workspaceDir": "./workspace/repo",
		"scope": "quick",
		"files": [],
		"manifests": [],
		"detectedLanguages": [],
		"topFiles": [],
		"changedFiles": []
	},
	"executionOptions": {
		"provider": "ollama",
		"model": "deepseek-r1:8b"
	}
}
```

### 7.1.a Runtime del agente

El `SkillRunner` materializa el agente de análisis con estas reglas obligatorias:

- El contenido completo de `.agent/skills/cybersecurity/SKILL.md` se carga como contexto base del agente.
- Además de `SKILL.md`, el runner expone un índice de assets del skill bajo `.agent/skills/cybersecurity/**` para que el agente pueda resolver referencias documentales y archivos auxiliares del propio skill.
- El directorio de trabajo (`cwd`) del agente debe ser `<workspaceDir>`.
- El agente debe poder leer:
	- `.agent/skills/cybersecurity/**` como raíz confiable del sistema.
	- `<workspaceDir>/**` como raíz no confiable del repositorio auditado.
- El agente no debe escribir dentro de `.agent/skills/cybersecurity/**`.
- La escritura del agente debe limitarse a artefactos de ejecución y salida dentro de `<workspaceDir>` o directorios temporales controlados por el runner.

### 7.1.b Trust boundary del runtime

El runner debe distinguir explícitamente estas dos categorías:

- **Trusted roots**:
	- `.agent/skills/cybersecurity/SKILL.md`
	- `.agent/skills/cybersecurity/**`
- **Untrusted roots**:
	- `<workspaceDir>/**`

Reglas:

- Los archivos bajo `.agent/skills/cybersecurity/**` se consideran configuración confiable del sistema.
- Los archivos bajo `<workspaceDir>/**` se consideran input no confiable sujeto a análisis.
- El contenido del repositorio auditado no puede modificar, sustituir ni degradar las instrucciones cargadas desde `SKILL.md`.
- Si el runner detecta conflicto entre instrucciones del skill y contenido del repositorio analizado, prevalece siempre el skill cargado desde `.agent/skills/cybersecurity/**`.

### 7.1.c Binarios permitidos

El runner permite la ejecución de los siguientes binarios externos:

| Binario | Uso | Agentes consumidores |
|---------|-----|----------------------|
| `gh` | Clone de repos | Orquestrador |
| `git` | Diff, log, history | Agentes 1, 3, 5, orquestrador |
| `find` | Búsqueda de archivos | Todos con Bash |
| `grep` | Búsqueda de patrones | Todos con Bash |
| `ls` | Listado de directorios | Todos con Bash |
| `npm` | `npm audit`, `npm ls`, `npm outdated` | Agente 4 |
| `pip` | `pip audit` | Agente 4 |
| `cargo` | `cargo audit` | Agente 4 |
| `yarn` | `yarn audit` | Agente 4 |
| `pnpm` | `pnpm audit` | Agente 4 |
| `strings` | Extracción de strings de binarios | Agente 6 |
| `file` | Detección de tipo de archivo | Agente 6 |
| `wc` | Conteo de líneas | Agentes 1, 3, 5 |
| `cat` | Inspección de archivos | Agentes con Bash |
| `head` | Inspección parcial | Agentes con Bash |
| `tail` | Inspección parcial | Agentes con Bash |
| `sort` | Procesamiento de resultados | Agentes con Bash |
| `uniq` | Deduplicación de resultados | Agentes con Bash |

Reglas:

- Cualquier ampliación de esta whitelist requiere actualización de `docs/SPEC.md` y revisión del contrato del runner.
- Si el agente solicita ejecutar un binario no permitido, el runner debe rechazar la operación.
- Si falta un binario requerido para el flujo mínimo, el runner debe devolver un error estructurado y el CLI debe fallar con un código consistente (`4` o `5`, según corresponda al diseño final del runner).
- Si un binario de la whitelist no está disponible en el entorno, el runner debe advertirlo pero no bloquear la auditoría. El agente recibirá un error al intentar ejecutarlo y deberá continuar sin esa herramienta.

### 7.1.d Toolset por agente

El SkillRunner proporciona las siguientes herramientas a cada agente:

| Agente | Read | Grep | Glob | Bash | Sub-agentes |
|--------|------|------|------|------|-------------|
| Agente 1 (Vuln) | ✅ | ✅ | ✅ | ✅ | ✅ (per-language) |
| Agente 2 (Auth) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Agente 3 (Secrets) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Agente 4 (Deps) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Agente 5 (IaC) | ✅ | ✅ | ✅ | ✅ | ✅ (per-IaC-type) |
| Agente 6 (Threat) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Agente 7 (AI Code) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Agente 8 (Logic) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Orquestrador | ✅ | ✅ | ✅ | ✅ | ✅ (8 agentes) |

Nota: Las `TOOL RESTRICTION` declaradas en el skill externo son sugerencias del autor. El runner aplica las restricciones reales según esta tabla. Ver ADR 0004 para la justificación completa.

### 7.1.e Enforcement de runtime policy

El enforcement real del toolset NO vive en `.agent/skills/cybersecurity/SKILL.md`. Vive en el runner:

- `src/skill/runtime-policy.js` define la matriz canónica de 8 agentes, la whitelist de 18 binarios, el threshold de fanout y los helpers `resolveToolset()`, `buildPolicyPrompt()`, `shouldFanout()` y `binaryPreflight()`.
- `src/skill/run-cybersecurity-skill.js` genera un `policyBlock` por agente e inyecta esa política al prompt de sistema y al prompt de usuario antes de invocar el modelo.
- `src/skill/invoke-llm.js` vuelve a inyectar esa política en `runtimeConfig.policyBlock` y filtra las herramientas visibles para el modelo.
- `src/skill/tools.js` aplica la política en tiempo de ejecución: `getToolDefinitions()` expone solo las herramientas habilitadas y `executeTool()` rechaza binarios fuera de la whitelist.

Reglas:

- Si `SKILL.md` declara una `TOOL RESTRICTION` más amplia o más estrecha, prevalece SIEMPRE la política runtime del runner.
- Los agentes 7 y 8 siguen siendo de solo lectura aunque el skill externo cambie su texto.
- `dispatch_sub_agent` solo existe para los agentes 1 y 5 cuando el runner habilita sub-agentes.

### Sub-agentes dinámicos

El runner permite a los agentes 1 y 5 spawn sub-agentes cuando el tamaño del repo lo justifica:

- **Agente 1**: 1 sub-agente por lenguaje detectado (carga solo `language-patterns/[lang].md` relevante).
- **Agente 5**: 1 sub-agente por tipo de IaC presente (TF, Docker, K8s, CI/CD).
- **Threshold**: el fanout solo se habilita cuando `projectContext.repoMetrics.totalFiles > 200`. En `200` exactos NO hay fanout.

Los sub-agentes heredan el mismo toolset del agente padre. El runner decide si activar sub-agentes basándose en el número de archivos en scope.

### 7.2 Output del skill

El MVP exige que el runner devuelva, como mínimo:

```json
{
	"rawReport": "# Security Audit Report ...",
	"summary": "texto breve",
	"findings": [],
	"metadata": {
		"scope": "quick",
		"provider": "ollama",
		"model": "deepseek-r1:8b"
	}
}
```

Reglas:

- `rawReport` es obligatorio.
- Si el skill devuelve otro formato, el runner debe adaptarlo antes de devolver control al CLI.
- Si no hay contenido útil, el CLI termina con exit code `4`.

---

## 8. Scopes

| Scope | Archivos en alcance | Agentes esperados | Resultado esperado |
| --- | --- | --- | --- |
| `full` | repo completo | todos los agentes del skill | reporte completo |
| `quick` | entrada prioritaria + auth + secrets + deps | subconjunto rápido | reporte reducido pero válido |
| `diff` | solo archivos cambiados + contexto cercano | todos o subset definido por runner | reporte enfocado en cambios |

Para el MVP, `quick` debe ser el primer scope en quedar realmente operativo.

---

## 9. Formato canónico de `report.md`

El reporte final escrito por el CLI debe contener exactamente estos encabezados y en este orden:

- `# Resumen ejecutivo`
- `## Stack detectado`
- `## Estructura del proyecto`
- `## Observaciones técnicas`
- `## Riesgos y puntos de atención`
- `## Recomendaciones`

Reglas:

- Cada sección debe tener contenido no vacío.
- El documento debe superar los `200` caracteres.
- El CLI puede adaptar la salida del skill a este formato.
- `report.html` debe renderizar el mismo contenido de `report.md`.

---

## 10. Códigos de salida

- `0` — éxito.
- `2` — argumentos inválidos.
- `3` — falla al clonar con `gh`.
- `4` — el skill o el modelo no devolvieron una salida válida.
- `5` — error interno o de filesystem no manejado.

---

## 11. Criterios de aceptación del MVP

1. `cybersecurity owner/repo` genera `<workspaceDir>/report.md` y `<workspaceDir>/report.html`.
2. `report.md` contiene todos los encabezados canónicos.
3. `cybersecurity owner/repo --scope quick` funciona y produce un reporte válido.
4. `cybersecurity owner/repo --scope diff` usa `git diff` y reduce el alcance.
5. `--model` y `--provider` sobrescriben env/config.
6. Ejecutar dos veces sin `--force` reutiliza el workspace.
7. Ejecutar con repo inválido falla con exit code `2` o `3` según corresponda.

---

## 12. Pruebas mínimas

Debe existir una carpeta `tests/` con al menos:

- un smoke test de ejecución feliz,
- un test de repo inválido,
- un test de reutilización sin `--force`,
- un test de precedencia config/env/flags,
- un test de validación del formato final del reporte.

---

## 13. ADRs requeridos

- `docs/adr/0001-llm-provider.md`
- `docs/adr/0002-config-format.md`
- `docs/adr/0003-cli-skill-contract.md`

---

## 14. Próximo corte de implementación

El siguiente corte útil no es “más stub”. Es:

1. cerrar el contrato `CLI ↔ skill`,
2. implementar `quick` end-to-end,
3. escribir smoke tests,
4. recién después expandir a `full` y `diff` con más profundidad.




