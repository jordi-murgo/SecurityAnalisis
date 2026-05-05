---
status: proposed
date: 2026-04-29
authors: ["security-team"]
---

# ADR 0004 — Expansión del toolset de agentes del skill cybersecurity

## Contexto

El skill `cybersecurity` (extern, ubicado en `.agent/skills/cybersecurity/`) define 8 agentes especialistas que realizan auditorías de seguridad. El skill declara restricciones de herramientas por agente, pero estas restricciones son parte del skill externo y NO se modifican.

El SkillRunner (componente 5 de la arquitectura) es quien controla qué herramientas pone a disposición de los agentes en tiempo de ejecución. Actualmente, el ADR 0003 define una whitelist de binarios limitada a `gh, git, find, grep, ls` (sección 7.1.c de SPEC.md).

Análisis de las referencias del skill revela que varios agentes necesitan herramientas adicionales para ejecutarse óptimamente:

### Hallazgos clave

1. **Agent 4 (Dependency Auditor)** — GAP CRÍTICO: sin acceso a `npm audit`, `pip audit`, `cargo audit`, el agente solo puede INFERIR vulnerabilidades a partir de números de versión. No puede obtener datos CVE reales.

2. **Agent 3 (Secret Scanner)** — GAP ALTO: sin acceso a `git log`, `git diff` para escanear historial, no detecta secrets que fueron cometidos y luego eliminados. Punto ciego crítico.

3. **Agent 1 (Vulnerability Scanner)** — GAP MEDIO: `git log` proporciona contexto de edad del código; `grep` con PCRE mejora taint tracing en archivos grandes.

4. **Agent 6 (Threat Intelligence)** — GAP MEDIO: `strings`, `file` aceleran triage de binarios sospechosos.

5. **Agent 2 (Authorization)** — GAP BAJO: tracing de middleware chains más eficiente con Bash.

6. **Agents 7, 8** — Sin gap: son agentes de razonamiento puro, Read+Grep+Glob es suficiente.

7. **Sub-agentes para repos grandes**: El skill define una "Large Codebase Strategy" (SKILL.md línea 872) pero no tiene mecanismo para implementarla. Agentes 1 y 5 se beneficiarían de spawning dinámico de sub-agentes.

8. **Write/Edit para agentes**: NO necesario. Los agentes son analizadores de solo lectura que devuelven findings como texto. La escritura la hace el orquestrador en Phase 4.

9. **semgrep-patterns.md**: Contiene patrones conceptuales para razonamiento del AI, NO reglas YAML ejecutables. No se necesita Bash para ejecutar semgrep.

10. **Coordinación entre agentes**: La desduplicación (Phase 3.5 del skill) ocurre DESPUÉS de que todos los agentes retornan. Los agentes no pueden comunicarse entre sí durante el análisis. Esto es una limitación aceptable por ahora.

## Decisión

### P0: Ampliar Bash a los agentes de análisis

El SkillRunner proporcionará Bash a los agentes 1, 2, 3, 4 y 6 (además del agente 5 que ya lo tiene).

Los agentes 7 y 8 mantienen solo Read, Grep, Glob (son de razonamiento puro).

### P1: Permitir sub-agentes para repos grandes

El SkillRunner permitirá que los agentes 1 y 5 puedan spawnar sub-agentes con el mismo toolset. Patrón:
- Agente 1: 1 sub-agente por lenguaje detectado (carga solo `language-patterns/[lang].md` relevante)
- Agente 5: 1 sub-agente por tipo de IaC (TF, Docker, K8s, CI/CD)

### P2: Ampliar whitelist de binarios del runner

La whitelist de binarios permitidos (SPEC sección 7.1.c) se expande a:
- `gh`, `git` (ya existentes)
- `find`, `grep`, `ls` (ya existentes)
- `npm` (para `npm audit`, `npm ls`, `npm outdated`)
- `pip` (para `pip audit`)
- `cargo` (para `cargo audit`)
- `yarn` (para `yarn audit`)
- `pnpm` (para `pnpm audit`)
- `strings` (extracción de strings de binarios)
- `file` (detección de tipo de archivo)
- `wc` (conteo de líneas para priorización)
- `cat`, `head`, `tail` (inspección de archivos)
- `sort`, `uniq` (procesamiento de resultados)

### Lo que NO cambia

- El skill externo `.agent/skills/cybersecurity/SKILL.md` no se modifica.
- Write y Edit no se proporcionan a ningún agente.
- Los agentes 7 y 8 mantienen toolset de solo lectura.
- just-bash queda fuera de alcance para este ciclo.

## Whitelist de binarios actualizada

Binaros permitidos por el runner (MVP ampliado):

| Binario | Uso | Agentes que lo necesitan |
|---------|-----|--------------------------|
| `gh` | Clone de repos | Orquestrador |
| `git` | Diff, log, history | Agentes 1, 3, 5, orquestrador |
| `find` | Búsqueda de archivos | Todos los agentes con Bash |
| `grep` | Búsqueda de patrones | Todos los agentes con Bash |
| `ls` | Listado de directorios | Todos los agentes con Bash |
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

## Toolset por agente (definido por el runner)

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

Nota: Las `TOOL RESTRICTION` que declara el skill internamente son sugerencias del autor del skill. El runner aplica las restricciones reales. Donde el skill dice "Use ONLY Read, Grep, Glob", el runner puede proporcionar Bash adicional si está justificado.

## Consecuencias

- El Agente 4 puede ejecutar `npm audit --json` / `pip audit --format json` para obtener CVEs reales en lugar de inferirlos.
- El Agente 3 puede ejecutar `git log -p -- .env` para detectar secrets en historial eliminado.
- El Agente 1 puede usar `git log` para context de edad del código y `grep -P` para taint tracing avanzado.
- Los sub-agentes permiten escalar a repos grandes sin saturar el context window de un solo agente.
- La superficie de ataque del runner aumenta ligeramente (más binarios disponibles), pero la whitelist sigue siendo finita y auditable.

## Riesgos

- Si un binario de la whitelist no está disponible en el entorno de ejecución, el agente debe fallar gracefulmente (no crash). El runner debería verificar disponibilidad antes de la auditoría.
- Si el skill externo se actualiza y cambia sus patrones de herramientas, puede haber inconsistencias entre lo que el skill espera y lo que el runner proporciona. Revisar en cada actualización del skill.
- Los sub-agentes aumentan el consumo de tokens. Para repos pequeños, el overhead no compensa. El runner debería decidir dinámicamente si spawn sub-agentes basándose en el tamaño del repo.

## Actualizaciones requeridas

- `docs/SPEC.md` sección 7.1.c — ampliar whitelist de binarios
- `docs/SPEC.md` — actualizar path del skill de `.agent/cybersecurity/` a `.agent/skills/cybersecurity/`
- `docs/ARCHITECTURE.md` componente SkillRunner — documentar toolset ampliado y patrón de sub-agentes
