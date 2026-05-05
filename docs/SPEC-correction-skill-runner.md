# SPEC de corrección — `SkillRunner` y calidad del reporte MVP

**Estado:** propuesta lista para implementación

**Motivación:** el smoke test end-to-end sobre `jordi-murgo/SecurityAnalisis` confirmó que el CLI funciona, pero también expuso ruido y desvíos en la calidad del análisis generado por `src/skill/run-cybersecurity-skill.js`.

---

## 1. Problemas verificados

Los siguientes problemas están verificados sobre la ejecución real del binario:

1. El reporte `quick` prioriza archivos bajo `.agent/skills/cybersecurity/references/**` y los convierte en hallazgos del análisis.
2. La salida contiene findings duplicados con el mismo identificador (`VULN-004`).
3. El reporte mezcla corpus del skill, contexto del runner y código del repositorio auditado sin suficiente separación conceptual.
4. La sección de `Top files` no prioriza con claridad código y configuraciones de la aplicación por encima del corpus auxiliar del skill.

Esta spec corrige esos problemas sin cambiar el contrato general `CLI ↔ skill ↔ report` ya documentado.

---

## 2. Objetivo de la corrección

Mejorar la calidad del `SkillRunner` en el MVP para que el reporte:

- priorice señales del repositorio auditado relevantes para `quick`,
- reduzca ruido producido por corpus documental o assets auxiliares,
- entregue findings únicos y estables,
- mantenga trazabilidad entre `projectContext`, `rawReport` y reporte canónico final.

---

## 3. Alcance

Incluido en esta corrección:

- ajuste de priorización del corpus analizado en `quick`,
- exclusión o de-priorización explícita de rutas ruidosas,
- deduplicación y renumerado estable de findings,
- mejora del contenido de `rawReport` y del reporte final derivado.

Fuera de alcance:

- integración con LLM real,
- scoring completo tipo OWASP/MITRE,
- implementación real de agentes paralelos,
- ampliación de `full` más allá del contrato actual.

---

## 4. Reglas funcionales nuevas

### 4.1 Priorización de archivos en `quick`

En `quick`, el `SkillRunner` y/o el `ContextBuilder` deben priorizar este orden de análisis:

1. manifests en raíz,
2. código bajo `src/**`, `app/**`, `lib/**`, `bin/**`,
3. configuración operativa (`.github/workflows/**`, archivos de CI, `Dockerfile`, etc.),
4. tests solo si aportan señales de seguridad relevantes,
5. documentación y corpus auxiliar como última prioridad.

### 4.2 Rutas a excluir o de-priorizar

Para el MVP, estas rutas no deben generar findings heurísticos en `quick`, salvo futura decisión explícita:

- `.agent/skills/cybersecurity/references/**`
- `.agent/skills/**`
- `tests/fixtures/**`
- `workspace*/**`

Reglas:

- Pueden seguir apareciendo en metadata o conteos de contexto si resulta útil para trazabilidad.
- No deben dominar `topFiles` ni originar findings en la pasada heurística rápida del MVP.

### 4.3 Findings únicos

El `SkillRunner` debe garantizar que los findings devueltos:

- tengan identificadores únicos,
- se deduzcan por combinación de `title + location/root cause`,
- se renumeren secuencialmente en la salida final: `VULN-001`, `VULN-002`, `VULN-003`, ...

Si varias coincidencias heurísticas apuntan al mismo problema base, deben consolidarse en un único finding.

### 4.4 Separación entre corpus del skill y corpus auditado

El reporte debe distinguir claramente:

- assets confiables del skill cargados por el runner,
- archivos del repositorio auditado inspeccionados efectivamente,
- hallazgos originados en archivos auditados.

Reglas:

- El conteo de `Trusted skill assets` puede mantenerse en metadata o anexo.
- Los findings del reporte principal deben originarse exclusivamente en el corpus auditado permitido por esta spec.

---

## 5. Cambios esperados en la implementación

Archivos probablemente afectados:

- `src/context/build-context.js`
- `src/skill/run-cybersecurity-skill.js`
- `src/report/normalize-report.js`
- `src/report/validate-report.js`
- `tests/cli.test.js`

Cambios mínimos esperados:

1. introducir reglas de exclusión/de-priorización de rutas,
2. deduplicar findings antes de construir `rawReport`,
3. regenerar IDs de findings de forma estable,
4. reflejar en el reporte solo findings provenientes de archivos auditables según `quick`.

---

## 6. Criterios de aceptación

La corrección se considera terminada cuando se cumplan todos estos puntos:

1. Ejecutar `cybersecurity jordi-murgo/SecurityAnalisis --scope quick` no produce findings originados en `.agent/skills/cybersecurity/references/**`.
2. El reporte final no contiene IDs repetidos.
3. `Top files` prioriza código/configuración del repo por encima de corpus auxiliar del skill.
4. `tests/fixtures/**` no aparece como fuente de findings del análisis `quick`.
5. La suite de tests existente sigue pasando.
6. Se añade al menos un test nuevo que falle con IDs duplicados o con findings provenientes de rutas excluidas.

---

## 7. Pruebas mínimas adicionales

Deben añadirse pruebas que validen:

- exclusión de `.agent/skills/cybersecurity/references/**` como origen de findings en `quick`,
- exclusión de `tests/fixtures/**` como origen de findings en `quick`,
- unicidad de IDs en `rawReport` y en el reporte canónico,
- priorización razonable de archivos de aplicación en `topFiles`.

---

## 8. No objetivos

Esta corrección no pretende:

- convertir el `SkillRunner` heurístico en el skill completo,
- resolver todavía scoring avanzado,
- introducir nuevas dependencias,
- cambiar el contrato de runtime ya cerrado en `docs/SPEC.md` y `docs/adr/0003-cli-skill-contract.md`.

---

## 9. Próximo paso después de esta corrección

Una vez cerrada esta spec de corrección, el siguiente paso razonable es mejorar la calidad semántica del `SkillRunner` sobre código de aplicación real, no sobre assets del propio framework de análisis.