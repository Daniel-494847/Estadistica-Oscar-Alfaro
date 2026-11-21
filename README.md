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
- Colección `cuadros` (U.E. Oscar Alfaro) y, si el administrador crea otras, `cuadros_<slug>`. Cada una con los 9 documentos que usa la app
  (3 cuadros × 3 trimestres): `temas_1..3`, `promret_1..3`, `promedio_1..3`, más `acceso` con las preferencias.
- Registro de unidades educativas y escudos en `config/colegios`.
- Datos reales importados y verificados desde `scripts/datos-iniciales.json`
  (1º y 2º trimestre con datos; 3º trimestre vacío a la espera de carga).
- Los 12 grados están presentes en los 6 documentos con datos (incluido `1A` en `temas_1`).
- Al abrir un cuadro o cambiar de trimestre, la app selecciona automáticamente el primer grado
  con datos y avisa si el grado actual está vacío.
- En **Temas Programados**, el valor de **T.PROG. ANUAL** escrito en 1º trimestre se replica
  automáticamente en 2º y 3º trimestre para el mismo grado y área (se guarda en los 3 documentos).
- En **Promovidos y Retenidos**, **ESTUDIANTES EFECTIVOS** escrito en 1º trimestre se replica en
  los tres trimestres para el mismo grado, pero **puede modificarse** libremente en 2º y 3º.

> Firestore no requiere crear colecciones manualmente: se crean al escribir el primer documento. Para inicializar o verificar la estructura se usan los scripts de abajo.

## Apartado de administrador

- El acceso está en un botón pequeño **Ingresar administrador** en la parte superior izquierda, visible en todas las vistas. El acceso a los tres cuadros sigue siendo **anónimo** y no requiere iniciar sesión.
- El administrador entra con **Firebase Auth (correo y contraseña)** y tiene **control total**: puede modificar todos los campos de los tres cuadros, incluido **T.PROG. ANUAL** en 2º y 3º trimestre (para usuarios anónimos, ese casillero es de solo lectura fuera del 1º trimestre).
- Si el administrador cambia **T.PROG. ANUAL** en cualquier trimestre, el valor se replica automáticamente a los tres documentos.
- El panel tiene interruptores para **bloquear la edición por trimestre** (1º, 2º, 3º) y botones **Bloquear todo / Desbloquear todo**. El estado se guarda en `cuadros/acceso` y afecta solo a usuarios anónimos: los campos se deshabilitan y el botón **Guardar Registro** deja de estar disponible. El administrador siempre puede editar.

### Alta del usuario (una sola vez, en Firebase Console)

1. Firebase Console → **Authentication** → **Sign-in method** → habilitar **Correo electrónico/Contraseña**.
2. **Authentication → Users → Add user** → registrar el correo del administrador y su contraseña.
3. Con esas credenciales ya se puede entrar desde la tarjeta **Administrador**. No existe registro público de usuarios.

> La contraseña **no está en el código**: el bundle de Angular es público y cualquier persona podría leerla. Las credenciales viven solo en Firebase Auth.

> `firestore.rules` actualmente permite lectura y escritura a todos (`if true`), por lo que la restricción de **T.PROG. ANUAL** se aplica en la interfaz. Para exigirla también en el servidor haría falta un *custom claim* de administrador y reglas por campo; dime si quieres que lo añada.

### Opciones adicionales del panel

- **Trimestre preferido**: el administrador elige qué trimestre se abre por defecto al entrar a cualquier cuadro. Se guarda en `<coleccion>/acceso` y aplica a todos los usuarios.
- **Áreas de aprendizaje**: se pueden **añadir** (nombre + grupo) y **quitar** áreas. Los cambios afectan a los tres cuadros, los gráficos y el Excel de esa unidad educativa. El `id` del área es la clave usada en Firestore, por lo que quitar un área no borra sus datos históricos; solo deja de mostrarse y de contarse.
- **Unidades educativas**: solo el administrador ve la lista y el selector. La U.E. original usa la colección `cuadros`; cada unidad nueva usa su propia colección `cuadros_<slug>` con los mismos 9 cuadros + `acceso`.
  - Al crearla se puede subir un **escudo** (se reduce a 240×240 y se guarda como imagen incrustada en el registro). El escudo aparece en la vista previa, en los PDF y en los Excel. El nombre de la U.E. aparece en los títulos de todos los archivos generados.
  - El panel muestra el **enlace privado de esa U.E.** (`...?colegio=<slug>`) y un botón para copiarlo. Los usuarios anónimos que abren ese enlace trabajan automáticamente en esa unidad; no pueden ver la lista de unidades.
  - El botón **Descargar respaldo (.json)** guarda en el equipo la base de datos de la **unidad educativa activa** (seleccionada en el desplegable de administrador), sin borrar ni modificar nada. El mismo respaldo se puede volver a cargar con **Importar base de datos (.json)**.
  - Al **eliminar** una unidad (botón de papelera) se abre una **advertencia** de que la acción es irreversible. El botón de eliminación permanece deshabilitado hasta que se **descarga el respaldo `.json`** con el nombre, el escudo y los 10 documentos. Solo entonces se borran los documentos de la base de datos y la unidad desaparece del panel del administrador. El respaldo se puede volver a cargar con **Importar base de datos (.json)**. La U.E. original (OSCAR ALFARO) no se puede eliminar.
  - El formato importado es `{ "unidad": "NOMBRE", "escudo": "data:image/...", "datos": { "temas_1": { "datos": {...} }, ... } }`. `unidad` y `escudo` son opcionales; si la unidad no existe, se crea.

## Pasos

1. `npm ci` (o `npm install`)
2. `npm start` y abre http://localhost:4200
3. Opcional: volver a desplegar reglas e índices con
   `firebase deploy --only firestore:rules,firestore:indexes --project estadisticas-3b3c2`

## Descargas

- **Fondo global y responsividad**: degradado moderno, textura de cuadrícula y brillos laterales aplicados a **todo el proyecto**. El menú usa un panel de cristal y los formularios un panel claro sobre ese fondo. En celular, selectores, tarjetas y botones usan columnas Bootstrap de ancho completo (`col-12`) y las tablas anchas se desplazan dentro de `.table-responsive` con la primera columna fija; el cuerpo de la página nunca sale del ancho del dispositivo. Los documentos generados conservan su diseño original.
- **Menú → Descargar Excel**: genera `registro-estadistico.xlsx` con 9 hojas (3 cuadros × 3 trimestres), con el mismo formato de la vista previa: títulos, encabezados combinados, texto vertical, bordes dobles, tipografía Cambria y configuración de impresión en papel Carta apaisado ajustado al ancho. El tamaño Carta (`paperSize=1`), la orientación apaisada, el ajuste al ancho y el centrado horizontal ya vienen listos en cada hoja; no hay que configurarlos al imprimir.
- **Menú → Descargar PDF**: permite elegir el **cuadro** (Temas, Promedios o Promovidos/Retenidos) y el **trimestre**. El botón abre la vista previa; **no descarga nada automáticamente**. En la vista previa, el usuario debe presionar **⬇ PDF** para el trimestre mostrado o **Descargar los 3 PDF** cuando eligió *Todos (3 archivos)*. Se generan `cuadros-<cuadro>-1trim.pdf`, `-2trim.pdf` y `-3trim.pdf` en papel Carta apaisado, capturando la vista previa tal como se ve en pantalla.
- **Vista previa**: botones para descargar el Excel o el PDF **del cuadro abierto**, además de Imprimir.

El PDF se genera con `html2canvas` + `jspdf`; el Excel con `xlsx-js-style` y `fflate` para aplicar la configuración de impresión. Las librerías se cargan bajo demanda para no aumentar el bundle inicial.

## Gráficos estadísticos

- **Menú → Gráficos Estadísticos**: muestra, agregando los 12 grados a nivel de Unidad Educativa y comparando 1º, 2º y 3º trimestre. Los cuatro gráficos incluyen una cuarta categoría **PROMEDIO** con la media de los tres trimestres, y los resúmenes de texto también la muestran:
  - **Generales de cada trimestre**: porcentajes de temas avanzados, promovidos y retenidos.
  - **Retenidos y aprobados**: cantidad de estudiantes en cada condición y línea de porcentaje de aprobados/retenidos (eje derecho).
  - **Temas programados y avanzados**: cantidades por trimestre y línea de porcentaje de temas avanzados (eje derecho).
  - **Promedios**: promedio general de la Unidad Educativa.

En la cabecera de la sección hay un selector **Tipo de gráfico** con ocho opciones, aplicadas según la naturaleza de cada dato, y un selector **Columnas** para mostrar los cuatro gráficos comparativos en **1 columna** (a todo el ancho, con gráficos más altos y texto más grande) o **2 columnas** (valor predeterminado). En pantallas estrechas el tamaño se reduce automáticamente para que las cuatro etiquetas no se pisen:

| Tipo | Uso en esta sección |
| --- | --- |
| **Columna** | Comparación de magnitudes discretas: barras verticales de porcentajes, conteos y promedios. |
| **Línea** | Tendencia de 1º a 3º trimestre, incluido el promedio anual. |
| **Pastel** | Los cuatro gráficos se muestran como pastel del periodo elegido en `Periodo`, con partes que siempre suman 100%: avanzados/no avanzados, promovidos/retenidos (sobre cantidades de estudiantes), avanzados/pendientes y promedio/complemento. |
| **Barras horizontales** | Misma comparación que columnas, con etiquetas largas (`1º TRIMESTRE`, `PROMEDIO ANUAL`) para evitar que el texto se amontone. |
| **Área** | Tendencia con el área inferior rellena, que resalta el volumen acumulado. |
| **Dispersión XY** | Correlación entre el trimestre (eje X numérico 1, 2, 3) y cada variable (eje Y). Se omite `PROMEDIO ANUAL` porque no es un periodo. |
| **Histograma** | Distribución de frecuencias de los promedios por grado, agrupados en rangos de 10 puntos (0-9, 10-19, …, 90-100). |
| **Combinado** | Columnas de conteos o porcentajes junto con líneas de otra unidad en el eje derecho (por ejemplo, promedio general + % de temas avanzados). |

En el modo **Histograma** se muestra una tarjeta única a todo el ancho, porque sus datos tienen requisitos distintos a los de los cuatro gráficos comparativos. El informe Word incluye los gráficos visibles en el modo seleccionado.

Los reportes descargados desde el celular mantienen **el mismo formato horizontal que en una computadora**: el PDF captura la vista previa con ancho de escritorio (1250 px) y el Word inserta los gráficos renderizados a 1100 px; el Excel ya define `orientation="landscape"` en todas sus hojas.

Los porcentajes se muestran como **números enteros** con signo `%` **debajo de cada gráfico**, en **cuatro columnas alineadas con su barra o punto** (1º, 2º y 3º trimestre, y **PROMEDIO ANUAL**) y con un dato por línea, por ejemplo:

```text
1º TRIMESTRE
Temas Avanzados 30%
Promovidos 88%
Retenidos 12%
```

Las barras también llevan su porcentaje entero: en el gráfico general se lee `30%` sobre cada barra, y en los gráficos de conteos se lee `308 (88%)`, `482 (30%)`, etc. Las líneas de porcentaje se identifican en la leyenda y usan un eje derecho de 0 a 100, pero **no repiten el valor sobre cada punto** para no recargar el gráfico. El promedio general sigue con dos decimales debajo de su gráfico.

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
- `src/app/auth.service.ts`: sesión del administrador con Firebase Auth.
- `src/app/app.component.ts`: menú, formulario por grado, vista previa/impresión, descargas y gráficos estadísticos.
- `src/app/export.service.ts`: generación del Excel con el formato de la vista previa y impresión en Carta.
- `src/app/firebase.service.ts`: leer y guardar en Firestore.
- `src/app/imagenes.ts`: escudo y retrato del encabezado.
- `scripts/init-firestore.mjs` / `scripts/verify-firestore.mjs`: inicialización y verificación de la colección.
- `scripts/datos-iniciales.json`: datos de los 9 documentos importados a Firestore.
- `scripts/import-data.mjs` / `scripts/verify-data.mjs`: importación y verificación de los datos.

## Seguridad

`firestore.rules` permite leer/escribir `cuadros`, `cuadros_*` y `config` sin exigir inicio de sesión: los tres cuadros son anónimos y el apartado de administrador usa Firebase Auth en la interfaz. El bloqueo de edición por trimestre, la restricción de `T.PROG. ANUAL` y el ocultamiento de la lista de unidades a usuarios anónimos se aplican en la aplicación, no en el servidor. Cualquier persona con el enlace `?colegio=<slug>` puede acceder a esa unidad.

Para exigirlo también en Firestore haría falta un *custom claim* de administrador y reglas por campo (además de mover la replicación del anual a un backend autorizado).
