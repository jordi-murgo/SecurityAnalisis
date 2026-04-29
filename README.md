# SecurityAnalisis

Presentación mínima del proyecto.

`SecurityAnalisis` es un CLI para auditar repositorios con ayuda del skill `cybersecurity` definido en `.agent/cybersecurity/SKILL.md`.

## Estado actual

- Existe un stub ejecutable en `src/cli.js` expuesto como comando `cybersecurity`.
- La integración real con el skill todavía no está terminada.
- La fuente de verdad funcional del MVP es `docs/SPEC.md`.

## Objetivo del MVP

- Recibir un repositorio GitHub en formato `owner/repo`.
- Clonarlo en un workspace local.
- Construir contexto para el análisis.
- Ejecutar el skill `cybersecurity` con un `scope` definido.
- Generar `report.md` y `report.html` normalizados.

## Uso esperado

```bash
cybersecurity owner/repo
cybersecurity owner/repo --scope quick
cybersecurity owner/repo --scope diff --model deepseek-r1:8b --provider ollama
```

## Documentación

- `docs/SPEC.md` — contrato funcional del MVP.
- `docs/ARCHITECTURE.md` — componentes y flujo técnico.
- `docs/adr/` — decisiones cerradas del proyecto.
- `.agent/cybersecurity/SKILL.md` — contrato del motor de análisis.

## Regla operativa

Si un cambio de implementación no está respaldado por `docs/SPEC.md`, primero se actualiza la especificación.