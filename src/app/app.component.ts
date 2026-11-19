import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { FORM_AREAS, GRADOS, TRIMESTRES, Col, Fila, Tipo, calcular, definir, gid, lineas, totales } from './config';
import { ExportService } from './export.service';
import { FirebaseService } from './firebase.service';
import { IMG } from './imagenes';

@Component({
  selector: 'app-root',
  standalone: true,
  encapsulation: ViewEncapsulation.None, // para que @page y los estilos de impresión funcionen
  template: `
  <div class="container py-3 no-print" [class.app-panel]="vista() !== 'menu'">
    <!-- 1. MENÚ PRINCIPAL -->
    @if (vista() === 'menu') {
      <section class="menu-panel">
        <div class="menu-panel__intro">
          <span class="menu-panel__badge"><i class="bi bi-mortarboard-fill me-2"></i>U.E. "OSCAR ALFARO" · GESTIÓN 2026</span>
          <h2 class="menu-panel__title">Menú Principal</h2>
          <p class="menu-panel__subtitle">Seleccione una opción para gestionar el registro estadístico</p>
        </div>
        <div class="row g-3 g-md-4 position-relative" style="z-index:1">
          @for (o of tipos; track o[0]) {
            <div class="col-md-6"><button class="btn menu-card w-100 p-4 text-start h-100" (click)="abrir(o[0])">
              <div class="fs-1 text-primary"><i class="bi {{ o[3] }}"></i></div><div class="fw-bold fs-5">{{ o[1] }}</div><div class="small">{{ o[2] }}</div>
            </button></div>
          }
          <div class="col-md-6"><button class="btn menu-card w-100 p-4 text-start h-100" (click)="exportar()">
            <div class="fs-1 text-success"><i class="bi bi-file-earmark-excel"></i></div><div class="fw-bold fs-5">Descargar Excel</div><div class="small">Libro con los 9 cuadros (1º, 2º y 3º trimestre).</div>
          </button></div>
          <div class="col-md-6"><div class="menu-card h-100 p-4">
            <div class="d-flex justify-content-between align-items-start">
              <div class="fs-1 text-danger"><i class="bi bi-file-earmark-pdf"></i></div>
              <span class="badge text-bg-danger rounded-pill">PDF</span>
            </div>
            <div class="fw-bold fs-5 mt-2">Descargar PDF</div>
            <div class="small mb-3">Elige un trimestre o descarga los tres.</div>
            <div class="menu-panel__pdf-controls">
              <div class="row g-2">
                <div class="col-12 col-sm-6"><label class="form-label small fw-bold">Cuadro</label>
                  <select class="form-select form-select-sm" [value]="pdfTipo()" (change)="pdfTipo.set($any($event.target).value)">
                    @for (o of tipos; track o[0]) { <option [value]="o[0]">{{ o[1] }}</option> }
                  </select>
                </div>
                <div class="col-12 col-sm-6"><label class="form-label small fw-bold">Trimestre</label>
                  <select class="form-select form-select-sm" [value]="pdfTrim()" (change)="pdfTrim.set(+$any($event.target).value)">
                    <option value="0">Todos (3 archivos)</option>
                    @for (t of trimestres; track t) { <option [value]="t">{{ t }}º trimestre</option> }
                  </select>
                </div>
              </div>
              <button class="btn btn-danger w-100 mt-3 fw-bold" (click)="prepararPDF()" [disabled]="cargando()">
                <i class="bi bi-file-earmark-pdf me-2"></i>{{ cargando() ? 'Abriendo...' : 'Descargar PDF' }}
              </button>
              <div class="small text-white-50 mt-2">Abre la vista previa. La descarga se realiza al presionar el botón de descarga.</div>
            </div>
          </div></div>
          <div class="col-md-6"><button class="btn menu-card w-100 p-4 text-start h-100" (click)="abrirGraficos()">
            <div class="fs-1 text-info"><i class="bi bi-bar-chart-line"></i></div><div class="fw-bold fs-5">Gráficos Estadísticos</div><div class="small">Generales, retenidos y aprobados, temas y promedios de la Unidad Educativa.</div>
          </button></div>
        </div>
      </section>
    }

    <!-- 2. FORMULARIO POR GRADO -->
    @if (vista() === 'form') {
      <div class="row g-2 align-items-center mb-3">
        <div class="col-12 col-sm-auto order-2 order-sm-1">
          <button class="btn btn-danger btn-lg fw-bold shadow w-100" (click)="vista.set('menu')"><i class="bi bi-arrow-left-circle-fill me-2"></i>Volver al Menú</button>
        </div>
        <div class="col-12 col-sm order-1 order-sm-2">
          <h2 class="h4 mb-0 text-center text-sm-start">{{ nombreTipo() }}</h2>
        </div>
      </div>
      <div class="card card-body mb-3"><div class="row g-2 g-md-3 align-items-end">
        <div class="col-12 col-md-4"><label class="form-label small fw-bold">Seleccione el trimestre</label>
          <select class="form-select" (change)="cambiarTrim($any($event.target).value)">
            @for (t of trimestres; track t) { <option [value]="t" [selected]="trim() === t">{{ etiqueta(t) }}</option> }
          </select></div>
        <div class="col-12 col-md-4"><label class="form-label small fw-bold">Grado / Paralelo</label>
          <select class="form-select" (change)="grado.set($any($event.target).value)">
            @for (g of grados; track g) { <option [value]="g" [selected]="grado() === g">{{ g }}</option> }
          </select>
          @if (!conDatos(datos(), grado())) { <div class="small text-warning mt-1">Sin datos registrados para este grado</div> }
        </div>
        <div class="col-12 col-md-4"><button class="btn btn-primary w-100" (click)="cargar()">⟳ Cargar Datos</button></div>
      </div></div>

      @if (tipo() === 'promret') {
        <div class="row g-2 g-md-3 mb-3">
          <div class="col-12 col-md-4"><div class="card card-body bg-primary text-white"><small class="fw-bold">ESTUDIANTES EFECTIVOS</small>
            <input type="number" class="form-control" [value]="cur()['efec'] ?? ''" (input)="set('efec', $any($event.target).value)" (wheel)="bloquearScroll($event)"></div></div>
          <div class="col-12 col-md-4"><div class="card card-body"><small class="fw-bold text-secondary">TOTAL PROMOVIDOS</small>
            <input type="number" class="form-control" [class.is-invalid]="bad(totCol())" [value]="cur()['t_prom'] ?? ''" (input)="set('t_prom', $any($event.target).value)" (wheel)="bloquearScroll($event)"></div></div>
          <div class="col-12 col-md-4"><div class="card card-body"><small class="fw-bold text-secondary">TOTAL RETENIDOS</small>
            <input type="number" class="form-control" [class.is-invalid]="bad(totRetCol())" [value]="cur()['t_ret'] ?? ''" (input)="set('t_ret', $any($event.target).value)" (wheel)="bloquearScroll($event)">
          </div></div>
        </div>
      }

      <div class="table-responsive rounded border bg-white"><table class="table table-sm table-bordered align-middle text-center bg-white small mb-0">
        <thead class="table-light"><tr>
          <th class="text-start position-sticky start-0 bg-light z-1">Área de Conocimiento</th>
          @for (c of cabecera(); track c.key) { <th>{{ tipo() === 'promedio' ? 'Promedio' : c.titulo }}</th> }
        </tr></thead>
        <tbody>
          @for (a of areas; track a[0]) {
            <tr><td class="text-start fw-semibold position-sticky start-0 bg-white z-1">{{ a[1] }}</td>
              @for (c of colsDe(a[0]); track c.key) {
                <td [class.fw-bold]="!c.entrada">
                  @if (c.entrada) {
                    <input type="number" class="form-control form-control-sm text-center" [class.is-invalid]="bad(c)" [value]="cur()[c.key] ?? ''" (input)="set(c.key, $any($event.target).value)" (wheel)="bloquearScroll($event)">
                  } @else { {{ fila()[c.key] }} }
                </td>
              }
            </tr>
          }
        </tbody>
      </table></div>

      @if (tipo() === 'promedio') {
        <div class="row g-2 g-md-3 mb-3">
          <div class="col-12 col-md-6"><div class="card card-body"><small class="fw-bold text-secondary">PROMEDIO DE GRADO (automático)</small><div class="fs-4 fw-bold">{{ fila()['prom'] }}</div></div></div>
          <div class="col-12 col-md-6"><label class="form-label small fw-bold">Criterio de evaluación</label>
            <input class="form-control" [value]="cur()['crit'] ?? ''" (input)="set('crit', $any($event.target).value)"></div>
        </div>
      }

      <div class="d-grid gap-2 d-sm-flex flex-sm-wrap align-items-sm-center mt-3">
        <button class="btn btn-primary" (click)="pdfPreparado.set(false); vista.set('previa')">🖨 Vista Previa e Imprimir</button>
        <button class="btn btn-success" (click)="guardar()">💾 Guardar Registro</button>
        <span class="small text-muted text-center text-sm-start w-100">{{ cargando() ? 'Procesando...' : msg() }}</span>
      </div>

      @if (guardado()) {
        <div class="alert alert-success mt-3 text-center"><h5>¡Guardado Exitosamente!</h5>
          <div class="d-grid gap-2 d-sm-flex justify-content-sm-center">
            <button class="btn btn-primary" (click)="otro()">+ Registrar Otro Curso</button>
            <button class="btn btn-danger btn-lg fw-bold shadow" (click)="guardado.set(false); vista.set('menu')"><i class="bi bi-arrow-left-circle-fill me-2"></i>Volver al Menú Principal</button>
          </div>
        </div>
      }
    }
  </div>

  <!-- 3. VISTA PREVIA / IMPRESIÓN: el cuadro completo con el formato del Excel -->
  @if (vista() === 'previa') {
    <div class="no-print container-fluid bg-light border-bottom py-2">
      <div class="d-flex gap-2 align-items-center flex-wrap">
        <button class="btn btn-outline-secondary btn-sm" (click)="vista.set('form')">← Volver</button>
        <button class="btn btn-success btn-sm" (click)="exportarActual()">⬇ Excel (este cuadro)</button>
        <button class="btn btn-danger btn-sm" (click)="descargarPDF()" [disabled]="cargando()">⬇ PDF</button>
        @if (pdfPreparado()) {
          <span class="badge text-bg-danger">Vista previa · {{ nombreTipo() }} · {{ pdfTrim() === 0 ? 'todos los trimestres' : pdfTrim() + 'º trimestre' }}</span>
          @if (pdfTrim() === 0) {
            <button class="btn btn-danger btn-sm fw-bold" (click)="descargarPDFs()" [disabled]="cargando()">
              <i class="bi bi-download me-1"></i>Descargar los 3 PDF
            </button>
          }
        }
        <button class="btn btn-outline-primary btn-sm" (click)="window.print()">🖨 Imprimir</button>
      </div>
      <div class="d-flex gap-2 align-items-center flex-wrap mt-2">
        <label class="small mb-0">Gestión <input class="form-control form-control-sm d-inline-block w-auto" size="4" [value]="gestion()" (input)="gestion.set($any($event.target).value)"></label>
        <span class="small text-muted">{{ cargando() ? 'Generando...' : msg() }}</span>
      </div>
    </div>
    <div class="hoja">
      <div class="cab">
        <img [src]="img.escudo" alt="">
        <div>@for (l of titulos(); track $index) { <div [class.b]="$index === 0">{{ l }}</div> }</div>
        <img [src]="img.retrato" alt="">
      </div>
      <table [class]="'cuadro ' + tipo()">
        <thead>
          <tr>
            <th class="grado" [attr.rowspan]="sub() ? 3 : 2">GRADOS</th>
            @for (c of def().campos; track c.nombre) { <th class="campo" [attr.colspan]="c.areas.length * def().nArea">{{ c.nombre }}</th> }
            @if (sub()) { <th class="campo" [attr.colspan]="def().total.length" rowspan="2">{{ tipo() === 'promret' ? 'TOTALES:' : 'TOTALES' }}</th> }
            @else { @for (c of def().total; track c.key) { <th class="rot" rowspan="2"><span>{{ c.titulo }}</span></th> } }
          </tr>
          <tr>
            @for (c of def().campos; track c.nombre) { @for (a of c.areas; track a.id) {
              <th [attr.colspan]="def().nArea" [class.rot]="!sub()">@if (sub()) { {{ a.nombre }} } @else { <span>{{ a.nombre }}</span> }</th>
            } }
          </tr>
          @if (sub()) { <tr>@for (c of todas(); track c.key) { <th class="rot"><span>{{ c.titulo }}</span></th> }</tr> }
        </thead>
        <tbody>
          @for (g of grados; track g; let i = $index) {
            <tr><th class="grado">{{ g }}</th>
              @for (c of todas(); track c.key) { <td [class.pc]="c.titulo === '%'">{{ valorCelda(c, g, i) }}</td> }
            </tr>
          }
          <tr class="tot"><th class="grado">TOTALES</th>@for (c of todas(); track c.key) { <td>{{ tot()[c.key] }}</td> }</tr>
        </tbody>
      </table>
      <div class="pie">
        @switch (tipo()) {
          @case ('temas') { <div>PORCENTAJE DE TEMAS AVANZADOS: <b class="caja">{{ tot()['t_pct'] }}</b></div> }
          @case ('promret') {
            <div>PORCENTAJE DE PROMOVIDOS: <b class="caja">{{ tot()['t_pp'] }}</b></div>
            <div>PORCENTAJE DE RETENIDOS: <b class="caja">{{ tot()['t_pr'] }}</b></div> }
          @case ('promedio') { <div>PROMEDIO <b class="caja">{{ tot()['prom'] }}</b></div> }
        }
        <input class="lugar" [value]="lugar()" (input)="lugar.set($any($event.target).value)">
      </div>
    </div>
  }

  <!-- 4. GRÁFICOS ESTADÍSTICOS DE LA UNIDAD EDUCATIVA -->
  @if (vista() === 'graficos') {
    <div class="container-fluid no-print">
      <div class="row g-2 align-items-center mb-3">
        <div class="col-12 col-sm-auto">
          <button class="btn btn-danger btn-lg fw-bold shadow w-100" (click)="salir()"><i class="bi bi-arrow-left-circle-fill me-2"></i>Volver al Menú</button>
        </div>
        <div class="col-12 col-sm">
          <h2 class="h5 mb-0 text-center text-sm-start">Gráficos Estadísticos · Unidad Educativa "Oscar Alfaro"</h2>
        </div>
        <div class="col-12 col-sm-auto text-center">
          <span class="small text-muted">{{ cargando() ? 'Cargando datos...' : msg() }}</span>
        </div>
      </div>
      <div class="row g-4">
        <div class="col-lg-6"><div class="card h-100">
          <div class="card-header fw-bold">Generales de cada trimestre</div>
          <div class="card-body py-2"><div style="height:275px"><canvas id="grafGeneral"></canvas></div><div class="small text-secondary mt-2" style="white-space: pre-line; line-height:1.25">{{ resumenGeneral() }}</div></div>
        </div></div>
        <div class="col-lg-6"><div class="card h-100">
          <div class="card-header fw-bold">Retenidos y aprobados</div>
          <div class="card-body py-2"><div style="height:275px"><canvas id="grafPromRet"></canvas></div><div class="small text-secondary mt-2" style="white-space: pre-line; line-height:1.25">{{ resumenPromRet() }}</div></div>
        </div></div>
        <div class="col-lg-6"><div class="card h-100">
          <div class="card-header fw-bold">Temas programados y avanzados</div>
          <div class="card-body py-2"><div style="height:275px"><canvas id="grafTemas"></canvas></div><div class="small text-secondary mt-2" style="white-space: pre-line; line-height:1.25">{{ resumenTemas() }}</div></div>
        </div></div>
        <div class="col-lg-6"><div class="card h-100">
          <div class="card-header fw-bold">Promedios (todo general)</div>
          <div class="card-body py-2"><div style="height:275px"><canvas id="grafPromedios"></canvas></div><div class="small text-secondary mt-2" style="white-space: pre-line; line-height:1.25">{{ resumenPromedio() }}</div></div>
        </div></div>
      </div>
      <div class="card mt-4">
        <div class="card-body">
          <div class="row g-2 align-items-center">
            <div class="col-12 col-md-auto"><label for="informeTrim" class="fw-bold mb-0">Descargar informe por trimestre:</label></div>
            <div class="col-12 col-sm-6 col-md-3">
              <select id="informeTrim" class="form-select" [value]="informeTrim()" (change)="informeTrim.set(+$any($event.target).value)">
                @for (t of trimestres; track t) { <option [value]="t">{{ t }}º trimestre</option> }
              </select>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <button class="btn btn-primary w-100" (click)="descargarInformeWord()" [disabled]="generandoInforme()">
                {{ generandoInforme() ? 'Generando...' : '⬇ Descargar informe Word' }}
              </button>
            </div>
            <div class="col-12"><span class="small text-muted">{{ informeMsg() }}</span></div>
          </div>
        </div>
      </div>
    </div>
  }`,
  styles: [`
    /* Sin flechas de incremento/decremento en los campos numéricos */
    input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
    input[type='number']::-webkit-outer-spin-button,
    input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .hoja { max-width: 1250px; margin: 12px auto; padding: 8px; background: #fff; font-family: Cambria, serif; }
    .cab { display: flex; align-items: center; justify-content: space-between; text-align: center; margin-bottom: 8px; }
    .cab img { height: 64px; } .cab .b { font-weight: bold; font-size: 12pt; }
    .cuadro { width: 100%; table-layout: fixed; border-collapse: collapse; border: 3px double #000; text-align: center; font-size: 8pt; }
    .cuadro th, .cuadro td { border: 1px solid #000; padding: 0; height: 22px; }
    .cuadro th { font-weight: bold; } .cuadro th.grado { width: 46px; font-size: 10pt; } .cuadro th.campo { font-size: 10pt; }
    /* Texto vertical con transformación: html2canvas lo captura sin desordenar las letras */
    .rot { position: relative; }
    .rot span { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); transform-origin: center center; white-space: nowrap; font-size: 7pt; line-height: 1; }
    .temas .rot { height: 110px; } .promret .rot { height: 145px; } .promedio .rot { height: 110px; }
    .cuadro td.pc, .cuadro tr.tot td { font-weight: bold; } .cuadro tr.tot th, .cuadro tr.tot td { border-top: 3px double #000; }
    .pie { margin: 10px 0 0 40%; font-size: 10pt; } .caja { display: inline-block; min-width: 60px; text-align: center; border: 3px double #000; padding: 1px 6px; }
    .lugar { border: 0; background: transparent; font: inherit; font-weight: bold; width: 320px; margin-top: 6px; }
    /* Fondo elegante aplicado a TODO el proyecto */
    body { margin: 0; min-height: 100vh; color: #0f172a;
      background-color: #06152b;
      background-image:
        linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px),
        radial-gradient(circle at 12% 8%, rgba(56,189,248,.32), transparent 42%),
        radial-gradient(circle at 88% 92%, rgba(168,85,247,.28), transparent 45%),
        linear-gradient(135deg, #06152b 0%, #0b2a4a 45%, #073b4c 100%);
      background-size: 36px 36px, 36px 36px, auto, auto, auto;
      background-attachment: fixed; }
    .app-panel { margin-top: 1rem; padding: 1.5rem !important; border-radius: 24px;
      background: rgba(255,255,255,.94); border: 1px solid rgba(255,255,255,.6);
      box-shadow: 0 24px 60px rgba(2,12,27,.3); backdrop-filter: blur(10px); }
    .container-fluid.no-print h2 { color: #fff; }
    .container-fluid.no-print .text-muted { color: rgba(255,255,255,.75) !important; }
    /* Menú principal: panel de cristal sobre el fondo global */
    .menu-panel { position: relative; overflow: hidden; border-radius: 28px; padding: 2.5rem 2rem 2rem; color: #fff;
      background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.18);
      box-shadow: 0 24px 60px rgba(2,12,27,.35); backdrop-filter: blur(6px); }
    .menu-panel__intro { position: relative; z-index: 1; text-align: center; margin-bottom: 2rem; }
    .menu-panel__badge { display: inline-flex; align-items: center; border-radius: 999px; padding: .4rem 1rem;
      background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25); backdrop-filter: blur(8px);
      font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .menu-panel__title { font-size: 2.2rem; font-weight: 800; margin: .9rem 0 .3rem; letter-spacing: -.02em;
      background: linear-gradient(90deg, #fff, #9ee7ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .menu-panel__subtitle { color: rgba(255,255,255,.72); margin: 0; }
    .menu-card { background: rgba(255,255,255,.93); border: 1px solid rgba(255,255,255,.55) !important; border-radius: 18px;
      color: #0f172a; box-shadow: 0 12px 30px rgba(0,0,0,.18); backdrop-filter: blur(10px);
      transition: transform .2s ease, box-shadow .2s ease, background .2s ease; }
    .menu-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,.28); background: #fff; color: #0f172a; }
    .menu-card .small { color: #475569 !important; }
    .menu-panel__pdf-controls { background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.22); border-radius: 16px; padding: .9rem; }
    .menu-panel__pdf-controls .form-label { color: rgba(255,255,255,.85); font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; }
    .menu-panel__pdf-controls .form-select { background: rgba(255,255,255,.96); }
    @media (max-width: 576px) { .menu-panel { padding: 1.75rem 1rem 1.25rem; border-radius: 20px; } .menu-panel__title { font-size: 1.7rem; } }
    @page { size: letter landscape; margin: 12mm; }
    @media print { body { background: #fff !important; } .no-print { display: none !important; } .hoja { margin: 0; padding: 0; max-width: none; } }
  `],
})
export class AppComponent {
  window = window; img = IMG; grados = GRADOS; trimestres = TRIMESTRES; gid = gid; areas = FORM_AREAS;
  tipos: [Tipo, string, string, string][] = [
    ['temas', 'Temas Programados', 'Registro anual, programado y avanzado.', 'bi-journal-check'],
    ['promedio', 'Promedios', 'Gestión y registro de promedios por área.', 'bi-calculator'],
    ['promret', 'Promovidos y Retenidos', 'Control de estudiantes promovidos y retenidos.', 'bi-person-check-fill'],
  ];

  vista = signal<'menu' | 'form' | 'previa' | 'graficos'>('menu');
  charts: any[] = [];
  tipo = signal<Tipo>('temas');
  trim = signal(1); // 1º, 2º y 3º trimestre disponibles
  grado = signal('1ºA');
  gestion = signal('2026');
  lugar = signal('Bermejo, 08 de mayo de 2026');
  datos = signal<Record<string, Fila | undefined>>({}); // todos los grados del cuadro abierto
  msg = signal(''); cargando = signal(false); guardado = signal(false);
  informeTrim = signal(1); generandoInforme = signal(false); informeMsg = signal('');
  pdfTipo = signal<Tipo>('temas'); pdfTrim = signal(0); pdfPreparado = signal(false); // 0 = todos los trimestres
  resumenGeneral = signal(''); resumenPromRet = signal(''); resumenTemas = signal(''); resumenPromedio = signal('');
  agregados: any = null;
  private replicarTimers = new Map<string, any>();

  // Todo lo que se ve se calcula solo a partir de lo escrito
  def = computed(() => definir(this.tipo(), this.trim()));
  sub = computed(() => this.def().nArea > 1);
  todas = computed(() => [...this.def().cols, ...this.def().total]);
  filas = computed(() => this.grados.map(g => calcular(this.todas(), this.datos()[gid(g)] ?? {})));
  tot = computed(() => totales(this.todas(), this.filas()));
  titulos = computed(() => lineas(this.tipo(), this.trim(), this.gestion()));
  cur = computed(() => this.datos()[gid(this.grado())] ?? {});              // lo escrito del grado actual
  fila = computed(() => this.filas()[this.grados.indexOf(this.grado())]);   // lo calculado del grado actual
  cabecera = computed(() => this.def().cols.slice(0, this.def().nArea));
  totCol = computed(() => this.def().total.find(c => c.key === 't_prom') as Col);
  totRetCol = computed(() => this.def().total.find(c => c.key === 't_ret') as Col);

  nombreTipo = () => this.tipos.find(t => t[0] === this.tipo())![1];
  etiqueta = (t: number) => ({ temas: 'T. AVANZ', promedio: 'PROM', promret: 'PROM Y RET' }[this.tipo()]) + ` ${t}º TRIM`;
  colsDe = (id: string) => this.def().cols.filter(c => c.key === id || c.key.startsWith(id + '_'));
  // t_ret se registra a mano, pero se muestra su valor efectivo (registrado o calculado)
  valorCelda = (c: Col, g: string, i: number) =>
    c.entrada && c.key !== 't_ret' ? (this.datos()[gid(g)]?.[c.key] ?? '') : this.filas()[i][c.key];
  bad = (c: Col) => !!c.ok && !c.ok(this.fila());

  constructor(private fb: FirebaseService, private exp: ExportService) {}

  // Un grado tiene datos si alguna de sus celdas tiene valor (los grados sembrados están vacíos)
  conDatos(datos: Record<string, Fila | undefined>, g: string) {
    const f = datos[gid(g)];
    return !!f && Object.values(f).some(v => v !== '' && v != null);
  }

  abrir(t: Tipo) { this.pdfPreparado.set(false); this.tipo.set(t); this.trim.set(1); this.guardado.set(false); this.vista.set('form'); this.cargar(true); }

  salir() { this.charts.forEach(c => c.destroy()); this.charts = []; this.pdfPreparado.set(false); this.vista.set('menu'); }

  // Agregados a nivel de Unidad Educativa (los 12 grados) para cada trimestre
  private async obtenerAgregados() {
    const docs: Record<string, any> = {};
    for (const tp of ['temas', 'promret', 'promedio'] as Tipo[]) {
      for (const t of TRIMESTRES) docs[`${tp}_${t}`] = await this.fb.leer(`${tp}_${t}`).catch(() => null);
    }
    const columnas = (tp: Tipo, t: number) => {
      const df = definir(tp, t);
      return [...df.cols, ...df.total];
    };
    const filasDe = (tp: Tipo, t: number) => GRADOS.map(g =>
      calcular(columnas(tp, t), docs[`${tp}_${t}`]?.['datos']?.[gid(g)] ?? {}));
    const total = (tp: Tipo, t: number) => totales(columnas(tp, t), filasDe(tp, t));
    const temas = TRIMESTRES.map(t => total('temas', t));
    const promret = TRIMESTRES.map(t => total('promret', t));
    // El cuadro guarda el promedio de cada grado redondeado; aquí se promedia sin redondear
    // para mostrar el promedio general de la Unidad Educativa con dos decimales.
    const promedio = TRIMESTRES.map(t => {
      const vals = filasDe('promedio', t).map(f => f['prom']).filter(v => v !== '' && v != null).map(Number);
      return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
    });
    const filas = TRIMESTRES.map((t, i) => ({
      temas: filasDe('temas', t), promret: filasDe('promret', t), promedio: filasDe('promedio', t),
    }));
    return { temas, promret, promedio, filas };
  }

  async abrirGraficos() {
    this.vista.set('graficos');
    this.cargando.set(true); this.msg.set('Cargando datos...');
    this.charts.forEach(c => c.destroy()); this.charts = [];
    await new Promise(r => setTimeout(r, 300));
    try {
      this.agregados = await this.obtenerAgregados();
      const { temas, promret, promedio }: { temas: Fila[]; promret: Fila[]; promedio: number[]; filas: any[] } = this.agregados;
      const num = (v: any) => +(String(v ?? '').replace('%', '')) || 0;
      const pct = (v: any) => `${Math.round(num(v))}%`;
      const etiquetas = TRIMESTRES.map(t => `${t}º TRIM`);
      const porTrim = (fn: (i: number) => string) => TRIMESTRES.map((t, i) => `${t}º TRIMESTRE\n${fn(i)}`).join('\n\n');
      this.resumenGeneral.set(porTrim(i => [
        `Temas Avanzados ${pct(temas[i]['t_pct'])}`,
        `Promovidos ${pct(promret[i]['t_pp'])}`,
        `Retenidos ${pct(promret[i]['t_pr'])}`,
      ].join('\n')));
      this.resumenPromRet.set(porTrim(i => [
        `Aprobados ${pct(promret[i]['t_pp'])}`,
        `Retenidos ${pct(promret[i]['t_pr'])}`,
      ].join('\n')));
      this.resumenTemas.set(porTrim(i => `Avanzados ${pct(temas[i]['t_pct'])}`));
      this.resumenPromedio.set(porTrim(i => `Promedio ${Number(promedio[i]).toFixed(2)}`));

      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      const crear = (id: string, config: any) => {
        const el = document.getElementById(id) as HTMLCanvasElement | null;
        if (el) this.charts.push(new Chart(el, config));
      };
      const opciones = (max?: number, conPorcentaje = false) => ({
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
        scales: {
          y: { beginAtZero: true, position: 'left' as const, ...(max ? { max } : {}) },
          ...(conPorcentaje ? {
            y1: { position: 'right' as const, beginAtZero: true, max: 100, grid: { drawOnChartArea: false } },
          } : {}),
        },
      });
      // Escribe el valor numérico sobre cada barra o punto del gráfico.
      const etiquetasValores = (formato: (v: number, ds: any, di: number, i: number) => string) => ({
        id: 'etiquetasValores',
        afterDatasetsDraw(chart: any) {
          const ctx = chart.ctx;
          ctx.save();
          ctx.font = 'bold 9px Arial';
          ctx.fillStyle = '#212529';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          chart.data.datasets.forEach((ds: any, di: number) => {
            const meta = chart.getDatasetMeta(di);
            if (meta.hidden) return;
            meta.data.forEach((elem: any, i: number) => {
              const valor = Number(ds.data[i]);
              const texto = isFinite(valor) ? formato(valor, ds, di, i) : '';
              if (texto) ctx.fillText(texto, elem.x, Math.max(elem.y - 6 - di * 11, 11));
            });
          });
          ctx.restore();
        },
      });

      crear('grafGeneral', {
        type: 'bar',
        plugins: [etiquetasValores(v => `${Math.round(v)}%`)],
        data: { labels: etiquetas, datasets: [
          { label: '% Temas avanzados', data: temas.map(x => num(x['t_pct'])), backgroundColor: '#0d6efd' },
          { label: '% Promovidos', data: promret.map(x => num(x['t_pp'])), backgroundColor: '#198754' },
          { label: '% Retenidos', data: promret.map(x => num(x['t_pr'])), backgroundColor: '#dc3545' },
        ] }, options: opciones(100),
      });
      crear('grafPromRet', {
        type: 'bar',
        plugins: [etiquetasValores((v, ds, di, i) => {
          if (ds.yAxisID === 'y1') return `${Math.round(v)}%`;
          const porc = di === 0 ? promret[i]['t_pp'] : promret[i]['t_pr'];
          return `${Math.round(v)} (${Math.round(num(porc))}%)`;
        })],
        data: { labels: etiquetas, datasets: [
          { label: 'Aprobados', data: promret.map(x => num(x['t_prom'])), backgroundColor: '#198754', yAxisID: 'y' },
          { label: 'Retenidos', data: promret.map(x => num(x['t_ret'])), backgroundColor: '#dc3545', yAxisID: 'y' },
          { type: 'line', label: '% Aprobados', data: promret.map(x => num(x['t_pp'])), borderColor: '#146c43', backgroundColor: '#146c43', yAxisID: 'y1', tension: 0.3, pointRadius: 4, fill: false },
          { type: 'line', label: '% Retenidos', data: promret.map(x => num(x['t_pr'])), borderColor: '#b02a37', backgroundColor: '#b02a37', yAxisID: 'y1', tension: 0.3, pointRadius: 4, fill: false },
        ] }, options: opciones(undefined, true),
      });
      crear('grafTemas', {
        type: 'bar',
        plugins: [etiquetasValores((v, ds, _di, i) => ds.yAxisID === 'y1'
          ? `${Math.round(v)}%`
          : `${Math.round(v)} (${Math.round(num(temas[i]['t_pct']))}%)`)],
        data: { labels: etiquetas, datasets: [
          { label: 'Programados', data: temas.map(x => num(x['t_prog'])), backgroundColor: '#0d6efd', yAxisID: 'y' },
          { label: 'Avanzados', data: temas.map(x => num(x['t_avanz'])), backgroundColor: '#6610f2', yAxisID: 'y' },
          { type: 'line', label: '% Avanzados', data: temas.map(x => num(x['t_pct'])), borderColor: '#3a0ca3', backgroundColor: '#3a0ca3', yAxisID: 'y1', tension: 0.3, pointRadius: 4, fill: false },
        ] }, options: opciones(undefined, true),
      });
      crear('grafPromedios', {
        type: 'line',
        plugins: [etiquetasValores(v => v.toFixed(2))],
        data: { labels: etiquetas, datasets: [
          { label: 'Promedio general', data: promedio, borderColor: '#fd7e14', backgroundColor: '#fd7e14', tension: 0.3, pointRadius: 5 },
        ] }, options: opciones(100),
      });
      this.msg.set('');
    } catch (e) { console.error(e); this.msg.set('No se pudieron cargar los gráficos'); }
    this.cargando.set(false);
  }

  async descargarInformeWord() {
    this.generandoInforme.set(true); this.informeMsg.set('Generando informe...');
    try {
      const agg = this.agregados ?? (this.agregados = await this.obtenerAgregados());
      const t = this.informeTrim();
      const i = t - 1;
      const tem = agg.temas[i] as Fila;
      const pr = agg.promret[i] as Fila;
      const filas = agg.filas[i] as { temas: Fila[]; promret: Fila[]; promedio: Fila[] };
      const conPromedio = filas.promedio.some(f => f['prom'] !== '' && f['prom'] != null);
      const proTxt = conPromedio ? Number(agg.promedio[i]).toFixed(2) : '-';

      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, AlignmentType, WidthType, ImageRun, PageOrientation,
      } = await import('docx');
      const d = (v: any, dec = 0) => {
        if (v === '' || v == null) return '-';
        const n = Number(String(v).replace('%', ''));
        return isFinite(n) ? n.toFixed(dec) : String(v);
      };
      const celda = (texto: string, op: any = {}) => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: texto, bold: !!op.bold, size: 18 })],
          alignment: op.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        })],
        ...(op.ancho ? { width: { size: op.ancho, type: WidthType.PERCENTAGE } } : {}),
      });
      const tabla = (cabeceras: string[], filas: string[][], anchos?: number[]) => new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: cabeceras.map((h, j) => celda(h, { bold: true, center: true, ancho: anchos?.[j] })) }),
          ...filas.map(f => new TableRow({ children: f.map((v, j) => celda(v, { center: j > 0, ancho: anchos?.[j] })) })),
        ],
      });
      const titulo = (texto: string) => new Paragraph({ text: texto, heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 120 } });
      const centro = (texto: string, size: number, after = 80) => new Paragraph({
        children: [new TextRun({ text: texto, bold: true, size })], alignment: AlignmentType.CENTER, spacing: { after },
      });

      const imagen = (id: string) => {
        const c = document.getElementById(id) as HTMLCanvasElement | null;
        if (!c) return null;
        const base64 = c.toDataURL('image/png').split(',')[1] ?? '';
        const data = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
        const ancho = 620;
        return new Paragraph({
          children: [new ImageRun({ data, type: 'png', transformation: { width: ancho, height: Math.round(ancho * c.height / c.width) } })],
          alignment: AlignmentType.CENTER, spacing: { after: 160 },
        });
      };

      const children: any[] = [
        centro('INFORME ESTADÍSTICO', 32),
        centro('UNIDAD EDUCATIVA "OSCAR ALFARO" · GESTIÓN 2026', 24),
        centro(`${t}º TRIMESTRE`, 24, 240),
        titulo('1. Resumen general a nivel de Unidad Educativa'),
        tabla(['INDICADOR', 'VALOR'], [
          ['Temas programados', d(tem['t_prog'])],
          ['Temas avanzados', d(tem['t_avanz'])],
          ['% de temas avanzados', d(tem['t_pct'], 2) + '%'],
          ['Estudiantes efectivos', d(pr['t_efec'])],
          ['Aprobados (promovidos)', d(pr['t_prom'])],
          ['Retenidos', d(pr['t_ret'])],
          ['% de aprobados', d(pr['t_pp'], 2) + '%'],
          ['% de retenidos', d(pr['t_pr'], 2) + '%'],
          ['Promedio general de la Unidad Educativa', proTxt],
        ], [70, 30]),
        titulo('2. Detalle por grado · Temas programados y avanzados'),
        tabla(['GRADO', 'PROGRAMADOS', 'AVANZADOS', '% AVANZADOS'],
          GRADOS.map((g, k) => [g, d(filas.temas[k]['t_prog']), d(filas.temas[k]['t_avanz']), d(filas.temas[k]['t_pct'], 2) + '%']),
          [20, 25, 25, 30]),
        titulo('3. Detalle por grado · Promovidos y retenidos'),
        tabla(['GRADO', 'EFECTIVOS', 'PROMOVIDOS', 'RETENIDOS', '% PROMOVIDOS', '% RETENIDOS'],
          GRADOS.map((g, k) => [g, d(filas.promret[k]['t_efec']), d(filas.promret[k]['t_prom']), d(filas.promret[k]['t_ret']), d(filas.promret[k]['t_pp'], 2) + '%', d(filas.promret[k]['t_pr'], 2) + '%']),
          [14, 16, 16, 16, 19, 19]),
        titulo('4. Detalle por grado · Promedios'),
        tabla(['GRADO', 'PROMEDIO'],
          GRADOS.map((g, k) => [g, d(filas.promedio[k]['prom'], 2)]), [50, 50]),
        titulo('5. Gráficos comparativos de los tres trimestres'),
      ];
      for (const id of ['grafGeneral', 'grafPromRet', 'grafTemas', 'grafPromedios']) {
        const img = imagen(id);
        if (img) children.push(img);
      }
      children.push(new Paragraph({
        children: [new TextRun({ text: 'Los porcentajes y el promedio general se presentan con dos decimales. Los gráficos comparan 1º, 2º y 3º trimestre.', size: 18 })],
        spacing: { before: 120 },
      }));

      const doc = new Document({
        sections: [{
          properties: { page: {
            // docx invierte ancho/alto cuando se indica orientación apaisada
            size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          } },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `informe-estadistico-${t}trim.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      this.informeMsg.set('Informe descargado');
    } catch (e) { console.error(e); this.informeMsg.set('No se pudo generar el informe'); }
    this.generandoInforme.set(false);
  }

  cambiarTrim(t: string) { this.trim.set(+t); this.cargar(true); }
  set(key: string, v: string) {
    const g = gid(this.grado());
    this.datos.update(d => ({ ...d, [g]: { ...d[g], [key]: v } }));
    this.guardado.set(false);
    // En Temas Programados, el T.PROG. ANUAL se escribe una vez en 1º trimestre
    // y se replica automáticamente en 2º y 3º para el mismo grado y área.
    if (this.tipo() === 'temas' && this.trim() === 1 && key.endsWith('_anual')) {
      this.replicarAnual(g, key, v);
    }
  }

  private replicarAnual(g: string, key: string, v: string) {
    const k = `${g}_${key}`;
    clearTimeout(this.replicarTimers.get(k));
    this.replicarTimers.set(k, setTimeout(async () => {
      try {
        for (const id of ['temas_1', 'temas_2', 'temas_3']) {
          const doc = await this.fb.leer(id);
          const grado = doc?.['datos']?.[g];
          if (v === '') {
            // Si el usuario limpia el anual, se quita el campo donde exista; no se crea un grado vacío.
            if (grado) await this.fb.borrarCampoGrado(id, g, key);
          } else {
            await this.fb.guardarGrado(id, g, { ...(grado ?? {}), [key]: v }, {});
          }
        }
        this.msg.set('T.PROG. ANUAL replicado en los tres trimestres');
      } catch (e) { console.error(e); this.msg.set('No se pudo replicar el T.PROG. ANUAL'); }
    }, 400));
  }
  // Evita que la rueda del ratón cambie el valor de los campos numéricos
  bloquearScroll(e: Event) {
    e.preventDefault();
    (e.target as HTMLElement).blur();
  }
  otro() { this.guardado.set(false); this.grado.set(this.grados[(this.grados.indexOf(this.grado()) + 1) % 12]); }

  private id = () => `${this.tipo()}_${this.trim()}`;
  async cargar(autoGrado = false) {
    this.msg.set(''); this.cargando.set(true);
    try {
      const d = await this.fb.leer(this.id());
      const datos: Record<string, Fila | undefined> = d?.['datos'] ?? {};
      this.datos.set(datos);
      if (d?.['gestion']) this.gestion.set(d['gestion']);
      if (d?.['lugar']) this.lugar.set(d['lugar']);
      // Si el grado actual no tiene datos, mostrar el primero que sí los tenga
      if (autoGrado && !this.conDatos(datos, this.grado())) {
        const anterior = this.grado();
        const nuevo = this.grados.find(g => this.conDatos(datos, g));
        if (nuevo) {
          this.grado.set(nuevo);
          this.msg.set(`${anterior} no tiene datos: se mostró ${nuevo}`);
        }
      }
    } catch { this.datos.set({}); }
    this.cargando.set(false);
  }
  async guardar() {
    this.cargando.set(true);
    try {
      await this.fb.guardarGrado(this.id(), gid(this.grado()), this.cur(), { gestion: this.gestion(), lugar: this.lugar() });
      this.guardado.set(true);
    } catch { this.msg.set('No se pudo guardar (revisa la configuración de Firebase)'); }
    this.cargando.set(false);
  }

  private nombreArchivo(ext: string) {
    return `cuadros-${this.tipo()}-${this.trim()}trim.${ext}`;
  }

  // Excel con una hoja por cuadro y trimestre (1º, 2º y 3º), con el mismo formato de la vista previa
  async exportar() {
    this.cargando.set(true); this.msg.set('Generando Excel...');
    try {
      await this.exp.exportarExcelTodo(id => this.fb.leer(id));
      this.msg.set('Excel descargado');
    } catch (e) { console.error(e); this.msg.set('No se pudo generar el Excel'); }
    this.cargando.set(false);
  }

  // Excel del cuadro abierto
  async exportarActual() {
    this.cargando.set(true); this.msg.set('Generando Excel...');
    try {
      const d = await this.fb.leer(this.id());
      await this.exp.exportarExcelUno(this.tipo(), this.trim(), d);
      this.msg.set('Excel descargado');
    } catch (e) { console.error(e); this.msg.set('No se pudo generar el Excel'); }
    this.cargando.set(false);
  }

  // PDF idéntico a la vista previa: se captura la hoja tal como se ve en pantalla
  private async cargarLibsPDF() {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'), import('jspdf'),
    ]);
    return { html2canvas, jsPDF };
  }

  private async generarPDF(libs: Awaited<ReturnType<AppComponent['cargarLibsPDF']>>, nombreArchivo: string) {
    const hoja = document.querySelector<HTMLElement>('.hoja');
    if (!hoja) throw new Error('No se encontró la vista previa');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = await libs.html2canvas(hoja, {
      scale: 2, backgroundColor: '#ffffff', useCORS: true,
      windowWidth: hoja.scrollWidth, windowHeight: hoja.scrollHeight,
    });
    const pdf = new libs.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const margen = 8;
    const ancho = pdf.internal.pageSize.getWidth() - margen * 2;
    const altoPagina = pdf.internal.pageSize.getHeight() - margen * 2;
    const altoParcela = Math.floor(canvas.width * altoPagina / ancho);
    let y = 0, primera = true;
    while (y < canvas.height) {
      const alto = Math.min(altoParcela, canvas.height - y);
      const parte = document.createElement('canvas');
      parte.width = canvas.width; parte.height = alto;
      const ctx = parte.getContext('2d')!;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, parte.width, parte.height);
      ctx.drawImage(canvas, 0, y, canvas.width, alto, 0, 0, canvas.width, alto);
      if (!primera) pdf.addPage();
      pdf.addImage(parte.toDataURL('image/png'), 'PNG', margen, margen, ancho, alto * ancho / canvas.width);
      y += alto; primera = false;
    }
    pdf.save(nombreArchivo);
  }

  // PDF del cuadro abierto (botón de la vista previa)
  async descargarPDF() {
    this.cargando.set(true); this.msg.set('Generando PDF...');
    try {
      const libs = await this.cargarLibsPDF();
      await this.generarPDF(libs, this.nombreArchivo('pdf'));
      this.msg.set('PDF descargado');
    } catch (e) {
      console.error(e);
      this.msg.set('No se pudo generar el PDF');
    }
    this.cargando.set(false);
  }

  // El menú solo prepara la vista previa; la descarga siempre la inicia el usuario
  async prepararPDF() {
    this.cargando.set(true); this.msg.set('Abriendo vista previa...');
    const t = this.pdfTrim() === 0 ? TRIMESTRES[0] : this.pdfTrim();
    try {
      this.tipo.set(this.pdfTipo()); this.trim.set(t);
      await this.cargar();
      this.pdfPreparado.set(true);
      this.vista.set('previa');
      this.msg.set(this.pdfTrim() === 0
        ? 'Vista previa lista. Presione «Descargar los 3 PDF» para generar los archivos.'
        : `Vista previa lista. Presione «⬇ PDF» para descargar el ${t}º trimestre.`);
    } catch (e) {
      console.error(e);
      this.msg.set('No se pudo abrir la vista previa');
    } finally {
      this.cargando.set(false);
    }
  }

  // Botón explícito de la vista previa: descarga uno o los tres archivos PDF
  async descargarPDFs() {
    this.cargando.set(true); this.msg.set('Preparando PDF...');
    const tipoAnterior = this.tipo(), trimAnterior = this.trim(), vistaAnterior = this.vista();
    const trims = this.pdfTrim() === 0 ? [...TRIMESTRES] : [this.pdfTrim()];
    try {
      const libs = await this.cargarLibsPDF();
      for (const t of trims) {
        this.msg.set(`Generando PDF ${t}º trimestre...`);
        this.tipo.set(this.pdfTipo()); this.trim.set(t);
        await this.cargar();
        this.cargando.set(true);
        this.vista.set('previa');
        await new Promise(r => setTimeout(r, 550)); // esperar a que Angular pinte la hoja
        await this.generarPDF(libs, `cuadros-${this.pdfTipo()}-${t}trim.pdf`);
        await new Promise(r => setTimeout(r, 350)); // espacio entre descargas
      }
      this.msg.set(`${trims.length} PDF descargados`);
    } catch (e) {
      console.error(e);
      this.msg.set('No se pudieron generar los PDF');
    } finally {
      this.tipo.set(tipoAnterior); this.trim.set(trimAnterior); this.vista.set(vistaAnterior);
      this.cargando.set(false);
    }
  }
}
