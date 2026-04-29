---
status: accepted
date: 2026-04-29
authors: ["security-team"]
---

# ADR 0002 — Archivo de configuración del MVP

Context
-------

El CLI necesita un archivo opcional y único para definir defaults. Tener varios nombres posibles hace más difícil una implementación automática y genera ambigüedad documental.

Decision
--------

1. El archivo oficial de configuración del MVP es `cybersecurity.json` en la raíz del ejecutor.
2. Formato JSON con campos simples: `workspaceDir`, `llmProvider`, `llmModel`.
3. El orden de prioridad de configuración será: flags CLI > variables de entorno > archivo de configuración.

Ejemplo
-------

```json
{
  "workspaceDir": "./workspace",
  "llmProvider": "ollama",
  "llmModel": "deepseek-r1:8b"
}
```

Consecuencias
------------

- Facilita automatización en entornos locales y CI.
- Elimina ambigüedad entre nombres alternativos de archivo.
- Hace más simple escribir tests de precedencia.
