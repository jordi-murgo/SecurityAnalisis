# ARCHITECTURE — MVP realista de `cybersecurity`

## Propósito

Este documento describe **cómo se organiza el MVP real** del proyecto, sin mezclar visión futura con implementación inmediata.

La fuente de verdad del comportamiento sigue siendo `docs/SPEC.md`. Este documento solo describe componentes, responsabilidades y flujo técnico.

---

## Estado verificado hoy

- Existe `package.json`.
- Existe un binario `cybersecurity` apuntando a `src/cli.js`.
- Existe un stub de CLI en Node.js.
- Existe un skill de análisis en `.agent/cybersecurity/SKILL.md`.
- No existe todavía integración real end-to-end entre el CLI y el skill.

---

## Decisión de arquitectura para el MVP

Para el MVP, la arquitectura se organiza en seis piezas:

1. `CLI`
2. `ConfigResolver`
3. `RepoAcquirer`
4. `ContextBuilder`
5. `SkillRunner`
6. `ReportWriter`

El objetivo es que el archivo actual `src/cli.js` deje de concentrar toda la responsabilidad y pase a ser un punto de entrada fino.

---

## Componentes

### 1. `CLI`

Responsabilidad:

- Parsear argumentos.
- Validar entrada.
- Orquestar el flujo.
- Traducir errores a exit codes.

No debe:

- Analizar seguridad por sí mismo.
- Formatear toda la lógica del reporte inline.

### 2. `ConfigResolver`

Responsabilidad:

- Leer flags.
- Leer variables de entorno.
- Leer `cybersecurity.json` si existe.
- Resolver una configuración efectiva única.

Salida esperada:

```json
{
	"workspaceDir": "./workspace",
	"provider": "ollama",
	"model": "deepseek-r1:8b",
	"scope": "quick",
	"force": false
}
```

### 3. `RepoAcquirer`

Responsabilidad:

- Resolver `workspaceDir`.
- Clonar con `gh repo clone`.
- Reutilizar o recrear workspace según `--force`.

### 4. `ContextBuilder`

Responsabilidad:

- Recorrer archivos relevantes.
- Detectar manifests y lenguajes.
- Construir `PROJECT CONTEXT` mínimo.
- Reducir alcance si el scope es `diff`.

### 5. `SkillRunner`

Responsabilidad:

- Invocar el skill `cybersecurity`.
- Pasarle `projectContext` + `executionOptions`.
- Recibir `rawReport` y metadata.
- Fallar si la respuesta no cumple el contrato mínimo.

Contrato de runtime:

- Cargar `.agent/cybersecurity/SKILL.md` como contexto base del agente.
- Exponer un índice de assets del skill bajo `.agent/cybersecurity/**` para resolver referencias auxiliares del propio skill.
- Ejecutar el agente con `cwd = <workspaceDir>`.
- Permitir lectura de:
	- `.agent/cybersecurity/**` como raíz confiable.
	- `<workspaceDir>/**` como raíz no confiable.
- Bloquear escritura en `.agent/cybersecurity/**`.
- Limitar la escritura del agente a `<workspaceDir>` o temporales controlados por el runner.
- Limitar la ejecución de binarios externos, en el MVP, a esta whitelist:
	- `gh`
	- `git`
	- `find`
	- `grep`
	- `ls`

### 6. `ReportWriter`

Responsabilidad:

- Adaptar la salida del skill al formato canónico del CLI.
- Escribir `report.md`.
- Renderizar `report.html`.
- Validar que el resultado final cumpla la SPEC.

---

## Flujo técnico

1. `CLI` recibe `owner/repo` y flags.
2. `ConfigResolver` calcula configuración efectiva.
3. `RepoAcquirer` asegura el repo local en `<output>/<repoName>`.
4. `ContextBuilder` genera `PROJECT CONTEXT`.
5. `SkillRunner` ejecuta el skill `cybersecurity`.
6. `ReportWriter` normaliza y escribe `report.md` y `report.html`.
7. `CLI` imprime rutas y termina.

---

## Boundary técnico clave

La frontera crítica del MVP es esta:

- El `CLI` decide **qué** ejecutar y con **qué configuración**.
- El `skill` decide **cómo analizar** el repositorio.
- El `ReportWriter` decide **cómo normalizar** la salida para que el usuario reciba un formato estable.

Además, el runtime debe separar explícitamente:

- `.agent/cybersecurity/**` como configuración confiable del sistema.
- `<workspaceDir>/**` como input no confiable del repositorio auditado.

Esto evita duplicar la lógica del skill dentro del CLI.

---

## Stack del MVP

Stack realista para implementar el MVP ahora:

- `Node.js` para el binario actual.
- `JavaScript` para el primer corte.
- `gh` como dependencia externa para clonar repositorios.
- HTML mínimo con `Tailwind CDN` para `report.html`.

Notas:

- `TypeScript` y `Bun` pueden evaluarse más adelante, pero no son requisito para cerrar el MVP.
- La documentación no debe prometer migraciones no aprobadas.

---

## Riesgos arquitectónicos actuales

- `src/cli.js` concentra demasiadas responsabilidades.
- El contrato con el skill todavía no está implementado.
- El reporte canónico del CLI y el reporte nativo del skill no coinciden todavía.
- No hay tests que congelen el comportamiento esperado.
- Si el runtime no separa raíces confiables y no confiables, el diseño queda expuesto a interferencias del repositorio analizado.
- Si el runner no expone correctamente `.agent/cybersecurity/**`, el skill no podrá resolver sus assets auxiliares.

---

## Regla de evolución

Antes de agregar nuevas capacidades, el proyecto debe cerrar estas tres piezas:

1. contrato `CLI ↔ skill`,
2. formato final del reporte,
3. smoke tests del flujo mínimo.
 

 


