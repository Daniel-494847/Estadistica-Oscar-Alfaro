import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore, doc, getDoc, getDocs, setDoc, writeBatch, deleteField, collection } from 'firebase/firestore';
import { AREAS_POR_DEFECTO, Area, Tipo } from './config';

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
export interface Colegio { nombre: string; coleccion: string; escudo?: string }

const REGISTRO_BASE: Record<string, Colegio> = {
  [SLUG_DEFECTO]: { nombre: 'OSCAR ALFARO', coleccion: COLECCION_DEFECTO },
};
export const IDS_CUADRO: string[] = (['temas', 'promret', 'promedio'] as Tipo[])
  .flatMap(tp => [1, 2, 3].map(t => `${tp}_${t}`))
  .concat('acceso');

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private db = getFirestore(app);

  // Cada cuadro se guarda en un documento: <coleccion>/temas_1, <coleccion>/promret_2, ...
  async leer(id: string, coleccion = COLECCION_DEFECTO) {
    const s = await getDoc(doc(this.db, coleccion, id));
    return s.exists() ? s.data() : null;
  }
  // Guarda solo el grado indicado (merge: no pisa a los otros grados)
  guardarGrado(id: string, grado: string, fila: object, extra: object, coleccion = COLECCION_DEFECTO) {
    return setDoc(doc(this.db, coleccion, id), { datos: { [grado]: fila }, ...extra, actualizado: Date.now() }, { merge: true });
  }
  // Borra un campo concreto sin afectar al resto del grado
  borrarCampoGrado(id: string, grado: string, campo: string, coleccion = COLECCION_DEFECTO) {
    return setDoc(doc(this.db, coleccion, id), { datos: { [grado]: { [campo]: deleteField() } }, actualizado: Date.now() }, { merge: true });
  }

  // Configuración por unidad educativa: bloqueo, trimestre preferido y áreas de aprendizaje
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
    return setDoc(doc(this.db, coleccion, 'acceso'), { bloqueos, actualizado: Date.now() }, { merge: true });
  }
  guardarTrimPreferido(trim: number, coleccion = COLECCION_DEFECTO) {
    return setDoc(doc(this.db, coleccion, 'acceso'), { trimPreferido: trim, actualizado: Date.now() }, { merge: true });
  }
  guardarAreas(areas: Area[], coleccion = COLECCION_DEFECTO) {
    return setDoc(doc(this.db, coleccion, 'acceso'), { areas, actualizado: Date.now() }, { merge: true });
  }

  // Registro de unidades educativas (para poder mostrarlas y crear enlaces)
  async leerColegios(): Promise<Record<string, Colegio>> {
    const s = await getDoc(doc(this.db, 'config', 'colegios')).catch(() => null);
    return { ...REGISTRO_BASE, ...(s?.exists() ? (s.data()?.['colegios'] ?? {}) : {}) };
  }
  guardarColegios(colegios: Record<string, Colegio>) {
    return setDoc(doc(this.db, 'config', 'colegios'), { colegios, actualizado: Date.now() }, { merge: true });
  }

  /** Crea una colección nueva con los 9 cuadros + acceso, devolviendo el slug y la colección. */
  async crearColegio(nombre: string, escudo?: string): Promise<{ slug: string; colegio: Colegio }> {
    const nombreLimpio = nombre.trim();
    const slug = nombreLimpio.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    if (!slug) throw new Error('Nombre de unidad educativa inválido');
    const coleccion = `cuadros_${slug}`;
    await Promise.all(IDS_CUADRO.map(id => setDoc(doc(this.db, coleccion, id), {
      datos: {},
      gestion: '2026',
      lugar: `UNIDAD EDUCATIVA "${nombreLimpio}"`,
      actualizado: Date.now(),
    }, { merge: true })));
    return { slug, colegio: { nombre: nombreLimpio, coleccion, ...(escudo ? { escudo } : {}) } };
  }

  /** Devuelve todos los documentos de una unidad educativa (para respaldo JSON). */
  async leerColeccion(coleccion = COLECCION_DEFECTO): Promise<Record<string, any>> {
    const snap = await getDocs(collection(this.db, coleccion));
    return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
  }

  /** Elimina todos los documentos de una unidad educativa (colección propia). */
  async borrarColegio(coleccion: string) {
    if (coleccion === COLECCION_DEFECTO) throw new Error('La unidad original no se puede eliminar');
    const snap = await getDocs(collection(this.db, coleccion));
    const batch = writeBatch(this.db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  /** Importa cuadros desde un JSON: { temas_1: { datos: {...} }, ... }. */
  importarDatos(datos: Record<string, any>, coleccion = COLECCION_DEFECTO) {
    return Promise.all(Object.entries(datos)
      .filter(([id]) => IDS_CUADRO.includes(id))
      .map(([id, d]) => setDoc(doc(this.db, coleccion, id), { ...(d ?? {}), actualizado: Date.now() }, { merge: true })));
  }
}
