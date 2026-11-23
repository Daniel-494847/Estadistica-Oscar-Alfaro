import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore, doc, getDoc, getDocs, setDoc, writeBatch, deleteField, collection } from 'firebase/firestore';
import { AREAS_POR_DEFECTO, Area, Tipo, TRIMESTRES } from './config';

// Datos del proyecto Firebase (Firebase Console > Configuración del proyecto > Tus apps)
const firebaseConfig = {
  apiKey: 'AIzaSyAhW6B32EZ4AbQDXI9-OofzLuJ-3K-DgVs',
  authDomain: 'estadisticas-3b3c2.firebaseapp.com',
  projectId: 'estadisticas-3b3c2',
  storageBucket: 'estadisticas-3b3c2.firebasestorage.app',
  messagingSenderId: '657244989745',
  appId: '1:657244989745:web:d6ca3cab8d92cdd62e2810',
  measurementId: 'G-72KVSH4HMT',
};

export const app = initializeApp(firebaseConfig);
// Analytics es opcional: se inicializa solo cuando hay measurementId y entorno de navegador
if (typeof window !== 'undefined' && firebaseConfig.measurementId) getAnalytics(app);

/** Colección original: la Unidad Educativa Oscar Alfaro. Las nuevas U.E. usan cuadros_<slug>. */
export const COLECCION_DEFECTO = 'cuadros';
export const SLUG_DEFECTO = 'oscaralfaro';

/** Raíz obligatoria y subcolecciones de la estructura acordada. */
export const RAIZ = 'reportes-academicos';
export const REGISTRO_DOC = '_registro';
export const SUB = {
  cuadros: 'cuadros-trimestrales',
  consolidado: 'consolidado-anual',
  promedios: 'promedios-por-area',
  promret: 'promovidos-retenidos',
  estadisticas: 'estadisticas',
  graficos: 'graficos',
  exportaciones: 'exportaciones',
} as const;
export type TipoExportacion = 'pdf' | 'excel' | 'word';
const SUB_EXPORTACION: TipoExportacion[] = ['pdf', 'excel', 'word'];

export interface Colegio { nombre: string; coleccion: string; escudo?: string }

const REGISTRO_BASE: Record<string, Colegio> = {
  [SLUG_DEFECTO]: { nombre: 'OSCAR ALFARO', coleccion: COLECCION_DEFECTO },
};
export const IDS_CUADRO: string[] = (['temas', 'promret', 'promedio'] as Tipo[])
  .flatMap(tp => [1, 2, 3].map(t => `${tp}_${t}`))
  .concat('acceso');

/** Subcolección que corresponde a cada documento de cuadro. */
export function subDeId(id: string): string {
  if (id.startsWith('temas_')) return SUB.cuadros;
  if (id.startsWith('promedio_')) return SUB.promedios;
  if (id.startsWith('promret_')) return SUB.promret;
  return SUB.estadisticas;
}

const num = (v: any) => (v === '' || v == null || !isFinite(+v) ? 0 : +v);
const red = (v: number) => Math.round(v);

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private db = getFirestore(app);

  private refUE(coleccion: string) {
    return doc(this.db, RAIZ, coleccion);
  }
  private refCuadro(id: string, coleccion: string) {
    return doc(this.db, RAIZ, coleccion, subDeId(id), id);
  }
  private refLegacy(id: string, coleccion: string) {
    return doc(this.db, coleccion, id);
  }
  private refRegistro() {
    return doc(this.db, RAIZ, REGISTRO_DOC);
  }

  /**
   * Lectura en la estructura nueva. Si el documento aún solo existe en la ruta
   * antigua, se devuelve y se copia a la nueva sin sobrescribir nada.
   */
  async leer(id: string, coleccion = COLECCION_DEFECTO) {
    if (id === 'acceso') {
      const actual = await getDoc(this.refUE(coleccion)).catch(() => null);
      if (actual?.exists()) {
        const d: any = actual.data();
        if (d.bloqueos || d.trimPreferido != null || d.areas || d.nombre || d.escudo) {
          return {
            bloqueos: d.bloqueos ?? {},
            trimPreferido: d.trimPreferido ?? 1,
            areas: d.areas,
            nombre: d.nombre,
            escudo: d.escudo,
            gestion: d.gestion,
            lugar: d.lugar,
          };
        }
      }
      const viejo = await getDoc(this.refLegacy('acceso', coleccion)).catch(() => null);
      return viejo?.exists() ? viejo.data() : null;
    }

    const actual = await getDoc(this.refCuadro(id, coleccion)).catch(() => null);
    if (actual?.exists()) return actual.data();

    const viejo = await getDoc(this.refLegacy(id, coleccion)).catch(() => null);
    if (!viejo?.exists()) return null;
    const datos = viejo.data();
    await setDoc(this.refCuadro(id, coleccion), datos, { merge: true }).catch(() => undefined);
    return datos;
  }

  /** Guarda solo el grado indicado (merge: no pisa a los otros grados). */
  guardarGrado(id: string, grado: string, fila: object, extra: object, coleccion = COLECCION_DEFECTO) {
    return setDoc(this.refCuadro(id, coleccion), {
      datos: { [grado]: fila }, ...extra, actualizado: Date.now(),
    }, { merge: true });
  }

  /** Borra un campo concreto sin afectar al resto del grado. */
  borrarCampoGrado(id: string, grado: string, campo: string, coleccion = COLECCION_DEFECTO) {
    return setDoc(this.refCuadro(id, coleccion), {
      datos: { [grado]: { [campo]: deleteField() } }, actualizado: Date.now(),
    }, { merge: true });
  }

  // Configuración por unidad educativa: bloqueo, trimestre preferido y áreas de aprendizaje.
  // Vive como campos del documento reportes-academicos/<coleccion>.
  async leerAcceso(coleccion = COLECCION_DEFECTO): Promise<{
    bloqueos: Record<number, boolean>; trimPreferido: number; areas: Area[];
  }> {
    const d: any = await this.leer('acceso', coleccion).catch(() => null);
    const trim = Number(d?.trimPreferido);
    const areas = Array.isArray(d?.areas) && d.areas.length &&
      d.areas.every((a: any) => a?.id && a?.nombre && a?.campo)
      ? d.areas as Area[] : AREAS_POR_DEFECTO;
    return {
      bloqueos: (d?.bloqueos ?? {}) as Record<number, boolean>,
      trimPreferido: [1, 2, 3].includes(trim) ? trim : 1,
      areas,
    };
  }
  guardarBloqueos(bloqueos: Record<number, boolean>, coleccion = COLECCION_DEFECTO) {
    return setDoc(this.refUE(coleccion), { bloqueos, actualizado: Date.now() }, { merge: true });
  }
  guardarTrimPreferido(trim: number, coleccion = COLECCION_DEFECTO) {
    return setDoc(this.refUE(coleccion), { trimPreferido: trim, actualizado: Date.now() }, { merge: true });
  }
  guardarAreas(areas: Area[], coleccion = COLECCION_DEFECTO) {
    return setDoc(this.refUE(coleccion), { areas, actualizado: Date.now() }, { merge: true });
  }

  // Registro de unidades educativas (para poder mostrarlas y crear enlaces)
  async leerColegios(): Promise<Record<string, Colegio>> {
    const actual = await getDoc(this.refRegistro()).catch(() => null);
    if (actual?.exists()) return { ...REGISTRO_BASE, ...(actual.data()?.['colegios'] ?? {}) };
    const viejo = await getDoc(doc(this.db, 'config', 'colegios')).catch(() => null);
    return { ...REGISTRO_BASE, ...(viejo?.exists() ? (viejo.data()?.['colegios'] ?? {}) : {}) };
  }
  guardarColegios(colegios: Record<string, Colegio>) {
    return setDoc(this.refRegistro(), { colegios, actualizado: Date.now() }, { merge: true });
  }

  /** Crea una unidad con sus 9 cuadros en la nueva estructura. */
  async crearColegio(nombre: string, escudo?: string): Promise<{ slug: string; colegio: Colegio }> {
    const nombreLimpio = nombre.trim();
    const slug = nombreLimpio.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    if (!slug) throw new Error('Nombre de unidad educativa inválido');
    const coleccion = `cuadros_${slug}`;
    const base = {
      datos: {},
      gestion: '2026',
      lugar: `UNIDAD EDUCATIVA "${nombreLimpio}"`,
      actualizado: Date.now(),
    };
    await Promise.all([
      setDoc(this.refUE(coleccion), {
        nombre: nombreLimpio,
        coleccion,
        ...(escudo ? { escudo } : {}),
        gestion: '2026',
        actualizado: Date.now(),
      }, { merge: true }),
      ...IDS_CUADRO.filter(id => id !== 'acceso')
        .map(id => setDoc(this.refCuadro(id, coleccion), base, { merge: true })),
    ]);
    return { slug, colegio: { nombre: nombreLimpio, coleccion, ...(escudo ? { escudo } : {}) } };
  }

  /** Devuelve todos los documentos de una unidad educativa (para respaldo JSON). */
  async leerColeccion(coleccion = COLECCION_DEFECTO): Promise<Record<string, any>> {
    const salida: Record<string, any> = {};
    const ue = await getDoc(this.refUE(coleccion)).catch(() => null);
    if (ue?.exists()) salida.acceso = ue.data();
    for (const sub of [SUB.cuadros, SUB.promedios, SUB.promret]) {
      const snap = await getDocs(collection(this.db, RAIZ, coleccion, sub)).catch(() => null);
      snap?.forEach(d => { salida[d.id] = d.data(); });
    }
    // Respaldos de unidades aún no migradas: se incluyen las rutas antiguas.
    const viejos = await getDocs(collection(this.db, coleccion)).catch(() => null);
    viejos?.forEach(d => { if (salida[d.id] == null) salida[d.id] = d.data(); });
    return salida;
  }

  /** Elimina la unidad educativa y todo su contenido nuevo (incluidas exportaciones). */
  async borrarColegio(coleccion: string) {
    if (coleccion === COLECCION_DEFECTO) throw new Error('La unidad original no se puede eliminar');
    const batch = writeBatch(this.db);
    const subs = [SUB.cuadros, SUB.consolidado, SUB.promedios, SUB.promret, SUB.estadisticas, SUB.graficos];
    for (const sub of subs) {
      const snap = await getDocs(collection(this.db, RAIZ, coleccion, sub));
      snap.docs.forEach(d => batch.delete(d.ref));
    }
    for (const tipo of SUB_EXPORTACION) {
      const snap = await getDocs(collection(this.db, RAIZ, coleccion, SUB.exportaciones, tipo));
      snap.docs.forEach(d => batch.delete(d.ref));
    }
    batch.delete(this.refUE(coleccion));
    await batch.commit();
  }

  /** Importa cuadros desde un JSON: { temas_1: { datos: {...} }, ... }. */
  importarDatos(datos: Record<string, any>, coleccion = COLECCION_DEFECTO) {
    return Promise.all(Object.entries(datos)
      .filter(([id]) => IDS_CUADRO.includes(id))
      .map(([id, d]) => setDoc(id === 'acceso' ? this.refUE(coleccion) : this.refCuadro(id, coleccion),
        { ...(d ?? {}), actualizado: Date.now() }, { merge: true })));
  }

  /** Genera/actualiza consolidado anual, estadísticas y series de gráficos. */
  async actualizarDerivados(coleccion = COLECCION_DEFECTO) {
    const docs: Record<string, any> = {};
    for (const id of IDS_CUADRO.filter(x => x !== 'acceso')) docs[id] = await this.leer(id, coleccion).catch(() => null);

    const grados = Array.from(new Set(TRIMESTRES.flatMap(t =>
      Object.keys(docs[`temas_${t}`]?.datos ?? {}))));
    const valor = (id: string, g: string, k: string) => docs[id]?.datos?.[g]?.[k];
    const consolidado: Record<string, any> = {};
    const seriesTemas: any[] = [];
    const seriesPromret: any[] = [];
    const seriesPromedio: any[] = [];

    for (const g of grados) {
      const prog = TRIMESTRES.map(t => valor(`temas_${t}`, g, 't_prog'));
      const avanz = TRIMESTRES.map(t => valor(`temas_${t}`, g, 't_avanz'));
      const tercero = docs['promret_3']?.datos?.[g] ?? {};
      const areasDocs = TRIMESTRES.map(t => docs[`promedio_${t}`]?.datos?.[g] ?? {});
      const claves = Object.keys(areasDocs[0] ?? {}).filter(k => k !== 'prom' && k !== 'crit');
      const areas: Record<string, number> = {};
      for (const k of claves) {
        const vals = areasDocs.map(a => a[k]).filter(v => v !== '' && v != null && isFinite(+v)).map(Number);
        areas[k] = vals.length ? red(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      }
      consolidado[g] = {
        temas: { programados: prog.reduce((a, b) => a + num(b), 0), avanzados: avanz.reduce((a, b) => a + num(b), 0) },
        promret: { efectivos: num(tercero.efec), promovidos: num(tercero.t_prom), retenidos: num(tercero.t_ret) },
        promedio: areas,
      };
    }

    for (const t of TRIMESTRES) {
      seriesTemas.push({
        trimestre: t,
        programados: grados.reduce((a, g) => a + num(valor(`temas_${t}`, g, 't_prog')), 0),
        avanzados: grados.reduce((a, g) => a + num(valor(`temas_${t}`, g, 't_avanz')), 0),
      });
      seriesPromret.push({
        trimestre: t,
        efectivos: grados.reduce((a, g) => a + num(valor(`promret_${t}`, g, 'efec')), 0),
        promovidos: grados.reduce((a, g) => a + num(valor(`promret_${t}`, g, 't_prom')), 0),
        retenidos: grados.reduce((a, g) => a + num(valor(`promret_${t}`, g, 't_ret')), 0),
      });
      const proms = grados.map(g => valor(`promedio_${t}`, g, 'prom')).filter(v => v !== '' && v != null && isFinite(+v)).map(Number);
      seriesPromedio.push({
        trimestre: t,
        promedio: proms.length ? red(proms.reduce((a, b) => a + b, 0) / proms.length) : 0,
      });
    }

    const totales = Object.values(consolidado).reduce((a: any, c: any) => ({
      programados: a.programados + c.temas.programados,
      avanzados: a.avanzados + c.temas.avanzados,
      efectivos: a.efectivos + c.promret.efectivos,
      promovidos: a.promovidos + c.promret.promovidos,
      retenidos: a.retenidos + c.promret.retenidos,
    }), { programados: 0, avanzados: 0, efectivos: 0, promovidos: 0, retenidos: 0 });
    const notas = Object.values(consolidado).flatMap((c: any) => Object.values(c.promedio as Record<string, number>));

    const gestion = docs.temas_1?.gestion ?? '2026';
    await Promise.all([
      setDoc(doc(this.db, RAIZ, coleccion, SUB.consolidado, `gestion-${gestion}`), {
        gestion, datos: consolidado, actualizado: Date.now(),
      }, { merge: true }),
      setDoc(doc(this.db, RAIZ, coleccion, SUB.estadisticas, 'resumen'), {
        ...totales,
        grados: grados.length,
        promedioGeneral: notas.length ? red(notas.reduce((a: number, b: number) => a + b, 0) / notas.length) : 0,
        actualizado: Date.now(),
      }, { merge: true }),
      setDoc(doc(this.db, RAIZ, coleccion, SUB.graficos, 'series'), {
        temas: seriesTemas, promret: seriesPromret, promedio: seriesPromedio, actualizado: Date.now(),
      }, { merge: true }),
    ]);
  }

  /** Deja constancia de cada archivo generado en exportaciones/<tipo>. */
  registrarExportacion(tipo: TipoExportacion, info: Record<string, any>, coleccion = COLECCION_DEFECTO) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return setDoc(doc(this.db, RAIZ, coleccion, SUB.exportaciones, tipo, id), {
      ...info, tipo, fecha: Date.now(),
    });
  }
}
