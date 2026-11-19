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

export const GRADOS = ['1ºA','1ºB','2ºA','2ºB','3ºA','3ºB','4ºA','4ºB','5ºA','5ºB','6ºA','6ºB'];
export const TRIMESTRES = [1, 2, 3]; // los tres trimestres están habilitados
export const gid = (g: string) => g.replace('º', ''); // id limpio para Firestore

const AREAS: Record<string, string> = {
  cl: 'COMUN. Y LENGUAJE', cs: 'C. SOCIALES', ap: 'A. P. Y VISUALES', ef: 'ED. FISICA Y DEPORTES',
  em: 'ED. MUSICAL', mat: 'MATEMÁTICA', tt: 'TÉCNICA TECNOLÓGICA', cn: 'C. NATURALES', ver: 'V. E. Y RELIGIONES',
};
const CAMPOS: [string, string[]][] = [
  ['COMUNIDAD Y SOCIEDAD', ['cl', 'cs', 'ap', 'ef', 'em']],
  ['CIENCIA TECNOLOGÍA Y PRODUCCIÓN', ['mat', 'tt']],
  ['VIDA, TIERRA TERRITORIO', ['cn']],
  ['COSMOS Y PENSAMIENTO', ['ver']],
];

// Áreas en el orden del formulario (nombre completo)
export const FORM_AREAS: [string, string][] = [
  ['cl', 'COMUNICACIÓN Y LENGUAJE'], ['cs', 'CIENCIAS SOCIALES'], ['ap', 'ARTES PLÁSTICAS Y VISUALES'],
  ['ef', 'EDUCACIÓN FÍSICA Y DEPORTES'], ['em', 'EDUCACIÓN MUSICAL'], ['mat', 'MATEMÁTICA'],
  ['tt', 'TÉCNICA TECNOLÓGICA'], ['cn', 'CIENCIAS NATURALES'], ['ver', 'VALORES, ESPIRITUALIDAD Y RELIGIONES'],
];

const n = (v: any) => (v === '' || v == null ? 0 : +v);
const vacio = (v: any) => v === '' || v == null;
const pct = (a: any, b: any, k: number) => (n(b) > 0 ? Math.round((n(a) / n(b)) * k) + '%' : '');

export function definir(tipo: Tipo, t: number) {
  const k = t === 2 ? 34 : 33; // peso del trimestre (33+34+33 = 100)
  const campos = CAMPOS.map(([nombre, ids]) => ({
    nombre,
    // en "promedio" el orden de las áreas del primer campo es distinto
    areas: (tipo === 'promedio' && nombre.startsWith('COMUNIDAD') ? ['cl', 'cs', 'ef', 'em', 'ap'] : ids)
      .map(id => ({ id, nombre: AREAS[id] })),
  }));
  const ids = campos.flatMap(c => c.areas.map(a => a.id));
  let porArea: (id: string) => Col[];
  let total: Col[];

  if (tipo === 'temas') {
    porArea = id => [
      { key: id + '_anual', titulo: 'T.PROG. ANUAL', entrada: true, tot: 'sum', ok: m => n(m[id + '_prog']) <= n(m[id + '_anual']) },
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
    porArea = id => [{ key: id, titulo: AREAS[id], entrada: true, tot: 'avg', ok: m => n(m[id]) <= 100 }];
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
  return { campos, cols, total, nArea: porArea(ids[0]).length };
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
export function lineas(tipo: Tipo, t: number, gestion: string): string[] {
  const o = ORD[t - 1];
  const tit = {
    temas: `PORCENTAJES DE TEMAS PROGRAMADOS Y AVANZADOS DEL ${o} TRIMESTRE GESTIÓN ${gestion}`,
    promret: `PORCENTAJES DE ESTUDIANTES PROMOVIDOS Y RETENIDOS EN EL ${o} TRIMESTRE GESTIÓN ${gestion}`,
    promedio: `PROMEDIO DE GRADO DE CADA UNA DE LAS AREAS EN EL ${o} TRIMESTRE GESTIÓN ${gestion}`,
  }[tipo];
  const ue = 'UNIDAD EDUCATIVA "OSCAR ALFARO"' + (tipo === 'temas' ? '' : ' CODIGO N° 71720001');
  return tipo === 'promret' ? [tit, ue] : [tit, ue, 'EDUCACIÓN PRIMARIA COMUNITARIA VOCACIONAL'];
}
