---
status: accepted
date: 2026-04-29
authors: ["security-team"]
---

# ADR 0001 — Proveedor LLM inicial del MVP

Context
-------

El CLI `cybersecurity` necesita una decisión cerrada para el MVP. Sin eso, un implementador no sabe qué backend soportar primero ni cómo fallar de forma consistente.

Decision
--------

1. El proveedor oficial del MVP es `ollama`.
2. La prioridad de selección será:
   - Flags CLI `--provider` / `--model` (más alto)
   - Variables de entorno `CC_LLM_PROVIDER` / `CC_LLM_MODEL`
   - Archivo de configuración `cybersecurity.json` (opcional)
3. El *skill* recibirá `provider` y `model` dentro del `PROJECT CONTEXT`.
4. `openai` u otros proveedores quedan fuera del criterio de aceptación del MVP, aunque el flag `--provider` permanezca en la interfaz.

Consecuencias
------------

- Reduce el alcance de implementación y testing.
- Permite pruebas locales reproducibles con `ollama serve`.
- Obliga a documentar prerequisitos operativos del entorno local.

Riesgos
------

- El flag `--provider` puede sugerir soporte más amplio del realmente implementado; la ayuda del CLI y la SPEC deben dejar esto explícito.
