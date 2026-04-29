---
name: tailwind-html-templates
description: Genera plantillas HTML con Tailwind CSS modernas, responsive, accesibles y listas para copiar y pegar.
---

# Tailwind HTML Templates

## Propósito

Usá este skill cuando necesites generar una plantilla HTML con Tailwind CSS lista para copiar/pegar, con una estructura moderna, responsive y accesible.

## Resultado esperado

La salida debe ser:

- Un archivo HTML completo o un bloque HTML autocontenido.
- Semántico y fácil de adaptar.
- Compatible con Tailwind utility-first sin estilos inline innecesarios.
- Responsive desde móvil a desktop.
- Accesible por defecto.
- Con placeholders de contenido realistas.

## Instrucciones

### 1. Definir el tipo de plantilla

Antes de escribir código, identificá uno de estos formatos comunes:

- `landing page`
- `dashboard`
- `auth` (`login`, `signup`, `reset password`)
- `pricing`
- `hero section`
- `cards grid`
- `formulario`
- `marketing section`

Si el pedido es ambiguo, asumí una variante estándar y dejá placeholders claros para texto, enlaces, métricas e imágenes.

### 2. Estructura de layout

Construí la plantilla con una jerarquía consistente:

- `body` con fondo, color base y espaciado global.
- `header` para navegación o branding.
- `main` para el contenido principal.
- `section`, `article`, `aside`, `nav`, `footer` según corresponda.
- Contenedores con `max-w-*`, `mx-auto`, `px-*`, `py-*`.
- Espaciado vertical consistente con `gap-*`, `space-y-*`, `py-*`.

Patrones recomendados:

- Wrapper principal: `min-h-screen bg-slate-950 text-slate-100`
- Contenedor: `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`
- Grids: `grid gap-6 md:grid-cols-2 xl:grid-cols-4`
- Cards: `rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm`

### 3. Semántica HTML

Priorizá HTML semántico:

- Usá `button` para acciones y `a` para navegación.
- Usá headings en orden lógico (`h1`, `h2`, `h3`).
- Agrupá bloques repetidos con `ul`/`li` cuando sean listas reales.
- Asociá labels con inputs usando `for` e `id`.
- Evitá `div` genéricos cuando exista un elemento semántico mejor.

### 4. Uso de clases Tailwind

Preferí clases utilitarias legibles, agrupadas por intención:

- Layout: `flex`, `grid`, `items-center`, `justify-between`
- Spacing: `p-*`, `px-*`, `py-*`, `gap-*`, `space-y-*`
- Sizing: `w-full`, `max-w-*`, `min-h-screen`
- Typography: `text-sm`, `text-base`, `text-3xl`, `font-semibold`, `tracking-tight`
- Visual: `bg-*`, `text-*`, `border`, `shadow-*`, `ring-*`
- States: `hover:*`, `focus:*`, `focus-visible:*`, `disabled:*`

Evitá:

- Clases redundantes o contradictorias.
- Valores arbitrarios salvo que sean realmente necesarios.
- Paletas inconsistentes dentro de la misma plantilla.

### 5. Responsive design

Diseñá mobile-first:

- Base para móvil sin prefijo.
- Escalado progresivo con `sm:`, `md:`, `lg:`, `xl:`.
- Navegación, grids y formularios deben funcionar bien desde pantallas pequeñas.
- No dependas de anchos fijos si un contenedor flexible resuelve el layout.

Checklist responsive:

- El contenido principal no desborda horizontalmente.
- Las columnas colapsan bien en móvil.
- Botones e inputs mantienen buen tamaño táctil.
- Los textos largos siguen siendo legibles.

### 6. Accesibilidad

Incluí por defecto:

- `lang` en el documento si generás HTML completo.
- Texto con contraste suficiente.
- Estados de foco visibles con `focus-visible:outline-none` y `focus-visible:ring-*`.
- `aria-label` en acciones icon-only.
- `alt` útil en imágenes relevantes; `alt=""` en decorativas.
- `sr-only` cuando aporte contexto para lectores de pantalla.
- Formularios con mensajes y ayudas claramente asociados.

No sacrifiques accesibilidad por estética.

### 7. Placeholders de contenido

Usá placeholders listos para reemplazar, no texto genérico vacío:

- `[Nombre del producto]`
- `[Propuesta de valor]`
- `[Descripción breve]`
- `[CTA principal]`
- `[CTA secundario]`
- `[Métrica 01]`, `[Métrica 02]`
- `[Plan Starter]`, `[Plan Pro]`
- `[Email]`, `[Contraseña]`

Si agregás imágenes:

- Usá rutas de ejemplo claras.
- Indicá el rol visual esperado de la imagen.

### 8. Variantes comunes

#### Landing page

Incluí normalmente:

- `header` con logo y navegación.
- `hero` con propuesta de valor y CTA.
- beneficios o features.
- social proof o métricas.
- sección final de CTA.
- `footer` simple.

#### Dashboard

Incluí normalmente:

- sidebar o topbar.
- tarjetas de métricas.
- tabla o lista reciente.
- panel lateral o bloque de actividad.
- filtros, búsqueda o acciones rápidas si aportan valor.

#### Auth

Incluí normalmente:

- tarjeta centrada.
- título claro.
- formulario con labels.
- acción principal prominente.
- enlaces secundarios como recuperar contraseña o registrarse.

#### Pricing

Incluí normalmente:

- título y subtítulo.
- 2 o 3 planes comparables.
- lista de features por plan.
- badge destacado para el plan recomendado.
- CTA por tarjeta.

#### Hero

Incluí normalmente:

- encabezado potente.
- texto de soporte.
- CTA principal y secundario.
- visual o mockup.
- prueba social breve.

#### Cards y forms

Para cards:

- jerarquía clara entre título, descripción y acción.
- hover sutil sin exceso visual.

Para forms:

- labels visibles.
- helper text si hace falta.
- errores potenciales fáciles de agregar.
- agrupación clara de campos.

### 9. Criterios de calidad

Antes de entregar, verificá que la plantilla:

- se vea coherente y moderna.
- use una jerarquía visual clara.
- tenga espaciado consistente.
- sea semántica.
- sea accesible en interacciones básicas.
- sea responsive.
- no dependa de JavaScript si no fue pedido.
- esté lista para copiar/pegar sin limpieza adicional.

## Formato de salida recomendado

Cuando el usuario pida una plantilla, devolvé:

1. Un título breve del tipo de plantilla.
2. El bloque HTML completo.
3. Una nota corta con qué placeholders reemplazar.

Si el usuario no especifica lo contrario, asumí Tailwind vía CDN en ejemplos completos.

## Ejemplo pequeño

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>[Nombre del producto]</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="min-h-screen bg-slate-950 text-slate-100">
    <main class="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <section class="grid w-full gap-10 lg:grid-cols-2 lg:items-center">
        <div class="space-y-6">
          <span class="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-300">[Categoría]</span>
          <div class="space-y-4">
            <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">[Propuesta de valor]</h1>
            <p class="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">[Descripción breve orientada al beneficio principal del producto o servicio].</p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <a href="#" class="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">[CTA principal]</a>
            <a href="#" class="inline-flex items-center justify-center rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">[CTA secundario]</a>
          </div>
        </div>
        <div class="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/30">
          <div class="grid gap-4 sm:grid-cols-2">
            <article class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <p class="text-sm text-slate-400">[Métrica 01]</p>
              <p class="mt-2 text-2xl font-semibold">128%</p>
            </article>
            <article class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <p class="text-sm text-slate-400">[Métrica 02]</p>
              <p class="mt-2 text-2xl font-semibold">24k</p>
            </article>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>
```