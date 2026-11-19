# Cuadros estadísticos - U.E. "Oscar Alfaro"

Angular 19 + TypeScript + Bootstrap + Firebase (Firestore).

## Deploy en GitHub Pages

- **Repositorio:** https://github.com/Daniel-494847/Estadistica-Oscar-Alfaro
- **URL publicada:** https://daniel-494847.github.io/Estadistica-Oscar-Alfaro/
- **Fuente de Pages:** rama `gh-pages`, carpeta `/ (root)` (ya configurada).

Cada vez que haya cambios, publica así:

```powershell
# 1) Compilar con la ruta base del proyecto (importante)
npm ci
npm run build -- --base-href /Estadistica-Oscar-Alfaro/

# 2) Subir el código fuente a main
git add .
git commit -m "Actualiza la app"
git push 2026 main

# 3) Publicar el build en gh-pages
$dir = 'C:\Users\EQUIPO\AppData\Local\Temp\opencode\ghpages-estadistica'
if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
git worktree prune
git worktree add -B gh-pages $dir
Get-ChildItem $dir -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
Copy-Item 'dist\cuadros\browser\*' $dir -Recurse -Force
New-Item (Join-Path $dir '.nojekyll') -ItemType File -Force | Out-Null
Push-Location $dir
git add -A
git commit -m "Deploy Angular app a GitHub Pages"
git push 2026 gh-pages --force
Pop-Location
git worktree remove $dir --force
git worktree prune
```

Si alguna vez se pierde la configuración, en GitHub entra a **Settings → Pages → Build and deployment** y elige **Deploy from a branch → gh-pages / (root)**. Espera 1–2 minutos y abre la URL publicada.

El icono que se muestra al compartir el enlace está en `src/icono.png` (512×512), el favicon en `src/favicon.png` y los metadatos `og:*` / `twitter:*` en `src/index.html`.

## Estado

- Proyecto Firebase configurado: `estadisticas-3b3c2`.
- Reglas e índices de Firestore desplegados (`firebase.json`, `firestore.rules`, `firestore.indexes.json`).
- Colección `cuadros` con los 9 documentos que usa la app
  (3 cuadros × 3 trimestres): `temas_1..3`, `promret_1..3`, `promedio_1..3`.
- Datos reales importados y verificados desde `scripts/datos-iniciales.json`
  (1º y 2º trimestre con datos; 3º trimestre vacío a la espera de carga).
- Los 12 grados están presentes en los 6 documentos con datos (incluido `1A` en `temas_1`).
- Al abrir un cuadro o cambiar de trimestre, la app selecciona automáticamente el primer grado
  con datos y avisa si el grado actual está vacío.
- En **Temas Programados**, el valor de **T.PROG. ANUAL** escrito en 1º trimestre se replica
  automáticamente en 2º y 3º trimestre para el mismo grado y área (se guarda en los 3 documentos).

> Firestore no requiere crear colecciones manualmente: se crean al escribir el primer documento. Para inicializar o verificar la estructura se usan los scripts de abajo.

## Pasos

1. `npm ci` (o `npm install`)
2. `npm start` y abre http://localhost:4200
3. Opcional: volver a desplegar reglas e índices con
   `firebase deploy --only firestore:rules,firestore:indexes --project estadisticas-3b3c2`

## Descargas

- **Fondo global**: degradado moderno, textura de cuadrícula y brillos laterales aplicados a **todo el proyecto**. El menú usa un panel de cristal y los formularios un panel claro sobre ese fondo; los documentos generados conservan su diseño original.
- **Menú → Descargar Excel**: genera `registro-estadistico.xlsx` con 9 hojas (3 cuadros × 3 trimestres), con el mismo formato de la vista previa: títulos, encabezados combinados, texto vertical, bordes dobles, tipografía Cambria y configuración de impresión en papel Carta apaisado ajustado al ancho. El tamaño Carta (`paperSize=1`), la orientación apaisada, el ajuste al ancho y el centrado horizontal ya vienen listos en cada hoja; no hay que configurarlos al imprimir.
- **Menú → Descargar PDF**: permite elegir el **cuadro** (Temas, Promedios o Promovidos/Retenidos) y el **trimestre**. El botón abre la vista previa; **no descarga nada automáticamente**. En la vista previa, el usuario debe presionar **⬇ PDF** para el trimestre mostrado o **Descargar los 3 PDF** cuando eligió *Todos (3 archivos)*. Se generan `cuadros-<cuadro>-1trim.pdf`, `-2trim.pdf` y `-3trim.pdf` en papel Carta apaisado, capturando la vista previa tal como se ve en pantalla.
- **Vista previa**: botones para descargar el Excel o el PDF **del cuadro abierto**, además de Imprimir.

El PDF se genera con `html2canvas` + `jspdf`; el Excel con `xlsx-js-style` y `fflate` para aplicar la configuración de impresión. Las librerías se cargan bajo demanda para no aumentar el bundle inicial.

## Gráficos estadísticos

- **Menú → Gráficos Estadísticos**: muestra, agregando los 12 grados a nivel de Unidad Educativa y comparando 1º, 2º y 3º trimestre:
  - **Generales de cada trimestre**: porcentajes de temas avanzados, promovidos y retenidos.
  - **Retenidos y aprobados**: cantidad de estudiantes en cada condición y línea de porcentaje de aprobados/retenidos (eje derecho).
  - **Temas programados y avanzados**: cantidades por trimestre y línea de porcentaje de temas avanzados (eje derecho).
  - **Promedios (todo general)**: promedio general de la Unidad Educativa.

Los porcentajes se muestran como **números enteros** con signo `%` **debajo de cada gráfico**, agrupados por trimestre y con un dato por línea, por ejemplo:

```text
1º TRIMESTRE
Temas Avanzados 30%
Promovidos 88%
Retenidos 12%
```

Las barras también llevan su porcentaje entero: en el gráfico general se lee `30%` sobre cada barra, y en los gráficos de conteos se lee `308 (88%)`, `482 (30%)`, etc. Las líneas de porcentaje mantienen su etiqueta con `%` y usan un eje derecho de 0 a 100. El promedio general sigue con dos decimales debajo de su gráfico.

Debajo de los gráficos hay un selector de trimestre y el botón **⬇ Descargar informe Word**, que genera `informe-estadistico-<t>trim.docx` con:

- resumen de la Unidad Educativa del trimestre elegido;
- detalle por grado de temas, promovidos/retenidos y promedios (porcentajes y promedio con dos decimales);
- las cuatro imágenes de los gráficos comparativos de los tres trimestres.

El documento se genera con `docx`, cargado bajo demanda al descargar el informe.

Los gráficos se generan con `chart.js`, cargado bajo demanda al abrir la sección.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run init:firestore` | Crea los documentos faltantes en `cuadros` (no sobrescribe los existentes) |
| `npm run verify:firestore` | Comprueba que los 9 documentos existan |
| `npm run import:data` | Importa `scripts/datos-iniciales.json` reemplazando los 9 documentos |
| `npm run verify:data` | Compara Firestore contra el JSON importado |
| `npm run firebase:deploy` | Despliega reglas e índices de Firestore |

## Archivos

- `src/app/config.ts`: áreas, columnas y fórmulas de los 3 cuadros.
- `src/app/app.component.ts`: menú, formulario por grado, vista previa/impresión, descargas y gráficos estadísticos.
- `src/app/export.service.ts`: generación del Excel con el formato de la vista previa y impresión en Carta.
- `src/app/firebase.service.ts`: leer y guardar en Firestore.
- `src/app/imagenes.ts`: escudo y retrato del encabezado.
- `scripts/init-firestore.mjs` / `scripts/verify-firestore.mjs`: inicialización y verificación de la colección.
- `scripts/datos-iniciales.json`: datos de los 9 documentos importados a Firestore.
- `scripts/import-data.mjs` / `scripts/verify-data.mjs`: importación y verificación de los datos.

## Seguridad

`firestore.rules` permite leer/escribir únicamente la colección `cuadros` porque la aplicación
no dispone de inicio de sesión. Si más adelante se añade Firebase Auth, conviene sustituir
`allow read, write: if true` por una regla que exija `request.auth != null`.
