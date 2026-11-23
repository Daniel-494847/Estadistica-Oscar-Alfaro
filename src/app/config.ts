// Configuración y cálculos de los tres cuadros (solo lógica, sin Angular)
export type Tipo = 'temas' | 'promret' | 'promedio';
export type Fila = Record<string, any>;

export interface Col {
  key: string; titulo: string; area?: string;
  entrada?: boolean; texto?: boolean;       // celda que se llena a mano
  tot: 'sum' | 'avg' | 'self' | 'none';     // cómo se calcula en la fila TOTALES
  calc?: (m: Fila, f: Fila) => any;         // fórmula (m = valores ya calculados, f = datos escritos)
  ok?: (m: Fila) => boolean;                // validación (rojo si da false)
}

/** Área de aprendizaje: id estable (clave en Firestore), nombre y grupo al que pertenece. */
export interface Area { id: string; nombre: string; campo: string }

/** Registro nominal de un estudiante reprobado: una fila por estudiante, nota por área. */
export interface Reprobado {
  id: string;
  nombre: string;                 // apellidos y nombres
  notas: Record<string, string>;  // id del área -> nota (vacío si no reprobó esa área)
}

/** Campo donde se guarda la lista dentro de la fila de cada grado (documento promret_*). */
export const REPROBADOS_KEY = '_reprobados';

/**
 * Normaliza la lista guardada. El formato actual es una fila por estudiante con `notas`.
 * También migra el formato anterior (una fila por área) agrupando las áreas del mismo alumno.
 */
export function reprobadosDe(f: Fila | undefined): Reprobado[] {
  const v = f?.[REPROBADOS_KEY];
  if (!Array.isArray(v)) return [];
  const porNombre = new Map<string, Reprobado>();
  v.forEach((r: any, i: number) => {
    if (!r || typeof r !== 'object') return;
    const nombre = String(r.nombre ?? '').trim();
    // El formato nuevo distingue alumnos por id (puede haber nombres repetidos);
    // el antiguo se agrupa por nombre para juntar las áreas de un mismo alumno.
    const esNuevo = !!r.notas && typeof r.notas === 'object';
    const clave = esNuevo ? `id:${r.id ?? i}` : (nombre || `__sin_nombre_${i}`);
    let destino = porNombre.get(clave);
    if (!destino) {
      destino = { id: String(r.id ?? `r${i}`), nombre, notas: {} };
      porNombre.set(clave, destino);
    }
    if (r.notas && typeof r.notas === 'object') {
      for (const [area, nota] of Object.entries(r.notas)) {
        const valor = String(nota ?? '');
        if (valor !== '') destino.notas[area] = valor;
      }
    } else if (r.area) {
      const valor = String(r.nota ?? '');
      if (valor !== '') destino.notas[String(r.area)] = valor;
    }
  });
  return [...porNombre.values()];
}

export const GRADOS = ['1ºA','1ºB','2ºA','2ºB','3ºA','3ºB','4ºA','4ºB','5ºA','5ºB','6ºA','6ºB'];
export const TRIMESTRES = [1, 2, 3]; // los tres trimestres están habilitados
export const gid = (g: string) => g.replace('º', ''); // id limpio para Firestore

export const CAMPOS_NOMBRES = [
  'COMUNIDAD Y SOCIEDAD',
  'CIENCIA TECNOLOGÍA Y PRODUCCIÓN',
  'VIDA, TIERRA TERRITORIO',
  'COSMOS Y PENSAMIENTO',
];

/** Áreas iniciales de cualquier unidad educativa (el administrador puede cambiarlas). */
export const AREAS_POR_DEFECTO: Area[] = [
  { id: 'cl', nombre: 'COMUNICACIÓN Y LENGUAJE', campo: CAMPOS_NOMBRES[0] },
  { id: 'cs', nombre: 'CIENCIAS SOCIALES', campo: CAMPOS_NOMBRES[0] },
  { id: 'ap', nombre: 'ARTES PLÁSTICAS Y VISUALES', campo: CAMPOS_NOMBRES[0] },
  { id: 'ef', nombre: 'EDUCACIÓN FÍSICA Y DEPORTES', campo: CAMPOS_NOMBRES[0] },
  { id: 'em', nombre: 'EDUCACIÓN MUSICAL', campo: CAMPOS_NOMBRES[0] },
  { id: 'mat', nombre: 'MATEMÁTICA', campo: CAMPOS_NOMBRES[1] },
  { id: 'tt', nombre: 'TÉCNICA TECNOLÓGICA', campo: CAMPOS_NOMBRES[1] },
  { id: 'cn', nombre: 'CIENCIAS NATURALES', campo: CAMPOS_NOMBRES[2] },
  { id: 'ver', nombre: 'VALORES, ESPIRITUALIDAD Y RELIGIONES', campo: CAMPOS_NOMBRES[3] },
];

// Formato usado por la vista de formulario
export const FORM_AREAS: [string, string][] = AREAS_POR_DEFECTO.map(a => [a.id, a.nombre]);

const n = (v: any) => (v === '' || v == null ? 0 : +v);
const vacio = (v: any) => v === '' || v == null;
const pct = (a: any, b: any, k: number) => (n(b) > 0 ? Math.round((n(a) / n(b)) * k) + '%' : '');

export function definir(tipo: Tipo, t: number, admin = false, areas: Area[] = AREAS_POR_DEFECTO) {
  const k = t === 2 ? 34 : 33; // peso del trimestre (33+34+33 = 100)
  const nombres = Object.fromEntries(areas.map(a => [a.id, a.nombre]));
  // Los grupos y el orden de las áreas salen de la configuración guardada por el administrador.
  const campos = CAMPOS_NOMBRES.map(nombre => ({
    nombre,
    areas: areas.filter(a => a.campo === nombre),
  })).filter(c => c.areas.length).map(c => ({
    ...c,
    // En "promedio" el área de artes va al final del primer grupo.
    areas: tipo === 'promedio' && c.nombre === CAMPOS_NOMBRES[0]
      ? [...c.areas.filter(a => a.id !== 'ap'), ...c.areas.filter(a => a.id === 'ap')]
      : c.areas,
  }));
  const ids = campos.flatMap(c => c.areas.map(a => a.id));
  let porArea: (id: string) => Col[];
  let total: Col[];

  if (tipo === 'temas') {
    porArea = id => [
      // T.PROG. ANUAL: en 2º y 3º es de solo lectura para usuarios anónimos;
      // el administrador puede editarlo en cualquier trimestre (control total).
      { key: id + '_anual', titulo: 'T.PROG. ANUAL', entrada: t === 1 || admin, tot: 'sum', ok: m => n(m[id + '_prog']) <= n(m[id + '_anual']) },
      { key: id + '_prog', titulo: `T.PROG. ${t}º TRIMESTRE`, entrada: true, tot: 'sum', ok: m => n(m[id + '_prog']) <= n(m[id + '_anual']) },
      { key: id + '_avanz', titulo: `T.AVANZ. ${t}º TRIMESTRE`, entrada: true, tot: 'sum', ok: m => n(m[id + '_avanz']) <= n(m[id + '_prog']) },
      { key: id + '_pct', titulo: '%', tot: 'self', calc: m => pct(m[id + '_avanz'], m[id + '_prog'], k) },
    ];
    const suma = (s: string) => (m: Fila) => ids.reduce((a, i) => a + n(m[`${i}_${s}`]), 0);
    total = [
      { key: 't_anual', titulo: 'T.PROG. ANUAL', tot: 'sum', calc: suma('anual') },
      { key: 't_prog', titulo: `T.PROG. ${t}º TRIMESTRE`, tot: 'sum', calc: suma('prog') },
      { key: 't_avanz', titulo: `T.AVANZ. ${t}º TRIMESTRE`, tot: 'sum', calc: suma('avanz') },
      { key: 't_pct', titulo: '%', tot: 'self', calc: m => pct(m['t_avanz'], m['t_prog'], k) },
    ];
  } else if (tipo === 'promret') {
    // mismas 5 columnas para cada área y para el bloque TOTALES (prefijo p)
    porArea = p => [
      { key: p + '_efec', titulo: 'ESTUDIANTES EFECTIVOS', tot: 'sum', calc: (m, f) => f['efec'] ?? '' },
      { key: p + '_prom', titulo: 'ESTUDIANTES PROMOVIDOS', entrada: true, tot: 'sum', ok: m => n(m[p + '_prom']) <= n(m[p + '_efec']) },
      { key: p + '_pp', titulo: '%', tot: 'self', calc: m => pct(m[p + '_prom'], m[p + '_efec'], 100) },
      { key: p + '_ret', titulo: 'ESTUDIANTES RETENIDOS', tot: 'self', calc: m => (vacio(m[p + '_efec']) ? '' : n(m[p + '_efec']) - n(m[p + '_prom'])) },
      { key: p + '_pr', titulo: '%', tot: 'self', calc: m => pct(m[p + '_ret'], m[p + '_efec'], 100) },
    ];
    // El total de retenidos se registra a mano: un estudiante retenido en dos áreas cuenta una sola vez.
    // Si no se registró, se mantiene el cálculo anterior (efectivos - promovidos) por compatibilidad.
    total = porArea('t').map(c => c.key === 't_ret' ? {
      ...c,
      entrada: true,
      tot: 'sum' as const,
      calc: (_m: Fila, f: Fila) => !vacio(f['t_ret'])
        ? f['t_ret']
        : (vacio(f['efec']) ? '' : n(f['efec']) - n(f['t_prom'])),
      ok: (m: Fila) => n(m['t_ret']) <= n(m['t_efec']),
    } : c);
  } else {
    porArea = id => [{ key: id, titulo: nombres[id] ?? id, entrada: true, tot: 'avg', ok: m => n(m[id]) <= 100 }];
    total = [
      { key: 'prom', titulo: 'PROMEDIO DE GRADO', tot: 'avg', calc: m => {
          const v = ids.map(i => m[i]).filter(x => !vacio(x));
          return v.length ? Math.round(v.reduce((a, b) => a + +b, 0) / v.length) : '';
        } },
      { key: 'crit', titulo: 'CRITERIO DE EVALUACIÓN', entrada: true, texto: true, tot: 'none' },
    ];
  }
  const cols = campos.flatMap(c => c.areas.flatMap(a => porArea(a.id).map(x => ({ ...x, area: a.nombre }))));
  total = total.map(x => ({ ...x, area: 'TOTALES' }));
  return { campos, cols, total, nArea: ids.length ? porArea(ids[0]).length : 0 };
}

// Valores de una fila de grado
export function calcular(cols: Col[], f: Fila): Fila {
  const m: Fila = {};
  for (const c of cols) m[c.key] = c.calc ? c.calc(m, f) : f[c.key] ?? '';
  return m;
}

// Fila TOTALES: suma, promedio o fórmula propia según cada columna
export function totales(cols: Col[], filas: Fila[]): Fila {
  const m: Fila = {};
  for (const c of cols) {
    const v = filas.map(r => r[c.key]).filter(x => !vacio(x));
    const s = v.reduce((a, b) => a + +b, 0);
    m[c.key] = c.tot === 'sum' ? s : c.tot === 'avg' ? (v.length ? Math.round(s / v.length) : '') : c.tot === 'self' ? c.calc!(m, {}) : '';
  }
  return m;
}

const ORD = ['PRIMER', 'SEGUNDO', 'TERCER'];
export function lineas(tipo: Tipo, t: number, gestion: string, ue = 'OSCAR ALFARO'): string[] {
  const o = ORD[t - 1];
  const tit = {
    temas: `PORCENTAJES DE TEMAS PROGRAMADOS Y AVANZADOS DEL ${o} TRIMESTRE GESTIÓN ${gestion}`,
    promret: `PORCENTAJES DE ESTUDIANTES PROMOVIDOS Y RETENIDOS EN EL ${o} TRIMESTRE GESTIÓN ${gestion}`,
    promedio: `PROMEDIO DE GRADO DE CADA UNA DE LAS AREAS EN EL ${o} TRIMESTRE GESTIÓN ${gestion}`,
  }[tipo];
  const nombre = ue.toUpperCase();
  const codigo = /OSCAR ALFARO/.test(nombre) ? ' CODIGO N° 71720001' : '';
  const ueLinea = `UNIDAD EDUCATIVA "${nombre}"` + (tipo === 'temas' ? '' : codigo);
  return tipo === 'promret' ? [tit, ueLinea] : [tit, ueLinea, 'EDUCACIÓN PRIMARIA COMUNITARIA VOCACIONAL'];
}
