# AGENTS — Reglas operativas para humanos y agentes

## Propósito

Este documento define las reglas de operación para cualquier persona o agente de IA que trabaje en este repositorio. No es un documento aspiracional. Es una política de ejecución.

Su objetivo es evitar improvisación, frenar "vibe coding" y obligar a que cada cambio tenga contexto, límites y trazabilidad.

## Política explícita anti–vibe-coding

En este repositorio queda prohibido trabajar de esta manera:

- Implementar primero y racionalizar después.
- Inventar requisitos a partir de intuiciones.
- Completar huecos con suposiciones no documentadas.
- Presentar arquitectura propuesta como si fuera realidad implementada.
- Introducir complejidad porque “suena bien”.
- Aceptar código generado por IA sin revisión contra especificación y arquitectura.

Regla simple:

- Si una decisión no puede justificarse con documentación vigente, no se implementa.

## Reglas para agentes de IA y humanos trabajando con IA

### Reglas generales

- Leer `docs/SPEC.md` antes de diseñar o codificar.
- Leer `docs/ARCHITECTURE.md` antes de proponer estructura técnica.
- Diferenciar siempre entre hecho verificado y dirección propuesta.
- Mantener cambios pequeños, revisables y trazables.
- Explicar supuestos de forma explícita.
- No ocultar incertidumbre detrás de lenguaje seguro.

### Reglas específicas para agentes

- No inventar archivos, módulos o capacidades existentes.
- No presentar ejemplos como si fueran implementación actual.
- No saltarse documentación porque “es obvio”.
- No expandir alcance por entusiasmo o asociación libre.
- No introducir nuevas dependencias sin justificación.
- No modificar estructura del proyecto sin explicar impacto.

### Reglas específicas para humanos que usan IA

- No delegar juicio técnico crítico al agente.
- No aceptar respuestas largas como sustituto de precisión.
- Exigir trazabilidad a requisitos y arquitectura.
- Revisar cada cambio como si viniera de un colaborador junior rápido, no de una autoridad.
- Bloquear cualquier entrega que no actualice documentación afectada.

## Flujo obligatorio antes de programar

Orden obligatorio:

1. Leer `docs/SPEC.md`.
2. Leer `docs/ARCHITECTURE.md`.
3. Confirmar si el cambio está dentro de alcance.
4. Identificar requisitos y restricciones afectados.
5. Confirmar si faltan decisiones o supuestos.
6. Solo entonces proponer o ejecutar cambios de código.

Si este flujo no se puede seguir, el trabajo correcto es parar y aclarar documentación.

## Convenciones de prompting

Todo prompt de trabajo debería incluir, como mínimo:

- Objetivo concreto.
- Alcance del cambio.
- Restricciones explícitas.
- Qué está verificado y qué no.
- Qué archivos pueden tocarse.
- Qué criterio valida que el trabajo terminó.

Plantilla mínima sugerida:

```text
Objetivo:
Alcance:
Restricciones:
Hechos verificados:
Supuestos permitidos:
Archivos afectados:
Criterio de aceptación:
```

Reglas de prompting:

- Pedir cambios acotados.
- Evitar prompts vagos del tipo “hazlo mejor”.
- Forzar al agente a declarar supuestos.
- Exigir que cite archivos afectados y validación realizada.

## Convenciones de gestión de cambios

- Un cambio debe responder a un problema concreto.
- Todo cambio relevante debe poder vincularse a una sección de `docs/SPEC.md`.
- Si cambia la estructura o interacción del sistema, debe revisarse `docs/ARCHITECTURE.md`.
- Si una decisión es duradera, debe crearse o actualizarse un ADR.
- No mezclar refactor, nueva capacidad y cambio documental grande en una sola entrega si se puede evitar.

## Reglas de actualización documental

Actualizar documentación no es opcional cuando cambia el conocimiento del sistema.

Actualizar `docs/SPEC.md` cuando cambie:

- El problema a resolver.
- El alcance.
- Los no objetivos.
- Los criterios de aceptación.
- Los supuestos críticos.

Actualizar `docs/ARCHITECTURE.md` cuando cambie:

- La estructura propuesta del sistema.
- La responsabilidad de módulos.
- El flujo de datos.
- El stack recomendado.
- Las preocupaciones transversales.

Actualizar o crear ADR cuando cambie:

- Una decisión con impacto duradero.
- Un tradeoff estructural importante.
- Una elección tecnológica difícil de revertir.

## Convenciones de comandos y flujo sugerido

Los comandos deben ser seguros, genéricos y verificables. No se documentan comandos inventados ni pipelines no confirmados.

Comandos genéricos útiles:

```bash
pwd
ls
find . -maxdepth 3 -type f | sort
git status
git diff --stat
```

Si existen manifiestos o herramientas verificadas, usar sus comandos reales. Si no existen, no simularlos.

Flujo sugerido:

```bash
git status
find . -maxdepth 3 -type f | sort
```

Después de cambios:

```bash
git diff --stat
git diff
```

Si más adelante se añaden herramientas reales de lint, test o build, deberán documentarse con precisión en el `README.md` o en documentación operativa específica.

## Checklist de PR / revisión para cambios generados con IA

Antes de aprobar un cambio generado total o parcialmente con IA, verificar:

- El cambio responde a un requisito o decisión documentada.
- No introduce capacidades fuera de alcance.
- Declara hechos verificados y supuestos.
- Actualiza documentación afectada.
- Mantiene coherencia con la arquitectura propuesta.
- Evita complejidad injustificada.
- No finge validaciones que no se ejecutaron.
- Deja el sistema más claro, no más confuso.

## Conductas prohibidas

Quedan prohibidas estas conductas:

- Inventar implementación inexistente.
- Esconder incertidumbre.
- Cambiar alcance sin actualizar documentación.
- Crear deuda estructural por velocidad aparente.
- Introducir dependencias sin evaluar impacto.
- Saltarse revisión humana en cambios relevantes.
- Aceptar código de IA porque “compila” o “parece correcto”.
- Mezclar hechos, propuestas y deseos sin etiquetarlos.

## Protocolo operativo conciso para agentes

Seguir este protocolo, en este orden:

1. Inspeccionar el estado real del repositorio.
2. Leer `docs/SPEC.md`.
3. Leer `docs/ARCHITECTURE.md`.
4. Determinar si el cambio pedido está dentro de alcance.
5. Declarar hechos verificados, supuestos y límites.
6. Identificar archivos a tocar y por qué.
7. Ejecutar el cambio mínimo necesario.
8. Validar con comandos o pruebas reales si existen.
9. Actualizar documentación afectada.
10. Entregar resumen, supuestos y riesgos restantes.

Si el agente no puede completar alguno de esos pasos con honestidad, debe detenerse y escalar la duda en lugar de improvisar.
