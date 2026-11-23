# Tigre

Registro personal de running y gimnasio. Es una app web instalable (PWA) que funciona sin internet.

- **Todo local:** los datos se guardan solo en el teléfono de cada persona (IndexedDB). No hay servidor, cuentas ni analytics.
- **Para compartirla:** pasá el link. Cada persona empieza con sus datos vacíos y elige si usa el plan incluido, empieza sin plan o importa uno propio.
- **Plan incluido:** `plan-data.json` (Media Maratón de Montevideo, 23 nov 2026 → 9 may 2027). No contiene datos personales.

## Instalar en iPhone
1. Abrí el link en **Safari**.
2. Tocá el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Elegí **Agregar a pantalla de inicio**.

## Publicar una versión nueva
1. Hacé los cambios en los archivos.
2. En `sw.js`, subí el número de `VERSION` (por ejemplo, de `tigre-v1` a `tigre-v2`).
3. Subí los cambios a GitHub. Al abrir la app, va a aparecer el aviso "Hay una actualización".

## Estructura
- `index.html`, `css/app.css`: la página y los estilos.
- `js/db.js`: almacenamiento. El plan (editable) y los registros (lo que hiciste) se guardan por separado.
- `js/views/`: una pantalla por archivo.
- `sw.js`: guarda la app para usarla sin conexión.
