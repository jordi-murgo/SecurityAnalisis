---
status: accepted
date: 2026-04-29
authors: ["security-team"]
---

# ADR 0003 — Contrato entre CLI, skill y reporte

## Contexto

El principal gap del proyecto no es el parseo de argumentos. Es la frontera entre:

- el CLI que orquesta,
- el skill `cybersecurity` que analiza,
- y el formateador que escribe el reporte final.

Sin este contrato, una implementación automática tiende a duplicar lógica, mezclar responsabilidades o acoplar el CLI al formato interno del skill.

## Decisión

1. El CLI **no** implementa reglas de análisis de seguridad.
2. El CLI construye un `projectContext` y lo entrega al skill.
3. El skill devuelve el **reporte final en Markdown canónico** dentro de `rawReport`.
4. El CLI valida ese Markdown y lo persiste; no recompone findings ni reescribe el contenido del análisis.
5. El reporte final escrito al disco pertenece semánticamente al skill, aunque lo materializa el CLI.

## Runtime contract

Además del contrato lógico entre `CLI`, `skill` y `reporte`, el MVP fija este contrato de runtime para el agente que ejecuta el skill:

1. El runner carga `.agent/skills/cybersecurity/SKILL.md` como contexto base del agente.
2. El runner expone también un índice de assets del skill bajo `.agent/skills/cybersecurity/**` para que el agente pueda localizar referencias y archivos auxiliares del propio skill.
3. El `cwd` del agente es siempre `<workspaceDir>`, es decir, el repositorio auditado ya clonado localmente.
4. El agente puede leer dos raíces distintas:
  - `.agent/skills/cybersecurity/**` como raíz confiable.
  - `<workspaceDir>/**` como raíz no confiable.
5. El agente no escribe en `.agent/skills/cybersecurity/**`.
6. El agente solo puede escribir artefactos de salida o temporales controlados dentro de `<workspaceDir>` o rutas temporales controladas por el runner.
7. El runtime del MVP limita la ejecución de binarios a esta whitelist:
  - `gh`
  - `git`
  - `find`
  - `grep`
  - `ls`

## Contrato mínimo de entrada

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

## Contrato mínimo de salida

```json
{
  "rawReport": "# Resumen ejecutivo\n\n...",
  "summary": "texto breve opcional",
  "metadata": {
    "scope": "quick",
    "provider": "ollama",
    "model": "deepseek-r1:8b"
  }
}
```

## Consecuencias

- El CLI queda desacoplado de la lógica de seguridad.
- El skill puede evolucionar internamente sin romper la interfaz pública del CLI, siempre que mantenga este contrato.
- El `ReportWriter` solo serializa Markdown y HTML; la estructura del análisis ya viene cerrada desde el skill/LLM.
- El `SkillRunner` queda obligado a separar contexto confiable del skill e input no confiable del repositorio analizado.
- El acceso a archivos auxiliares del skill queda permitido sin abrir acceso indiscriminado a todo el filesystem.
- La ejecución de binarios queda acotada y testeable.

## Riesgos

- Si el skill no produce Markdown canónico válido, el CLI debe rechazar la ejecución y no escribir un reporte inconsistente.
- Si el contrato cambia, hay que actualizar `docs/SPEC.md`, este ADR y los tests.
- Si el skill depende de archivos bajo `.agent/skills/cybersecurity/**` y el runner no expone correctamente esa raíz, el análisis será incompleto o fallará.
- Si el skill necesita binarios fuera de la whitelist, el MVP deberá ampliar el contrato antes de implementarlos.
- Si no se mantiene la separación entre raíces confiables y no confiables, el diseño queda expuesto a interferencias del repositorio auditado.
