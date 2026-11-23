// Estructura compartida por los scripts de Firestore.
import { doc, getDoc } from 'firebase/firestore';

export const RAIZ = 'reportes-academicos';
export const REGISTRO_DOC = '_registro';
export const COLECCION_DEFECTO = 'cuadros';

export const SUB = Object.freeze({
  cuadros: 'cuadros-trimestrales',
  consolidado: 'consolidado-anual',
  promedios: 'promedios-por-area',
  promret: 'promovidos-retenidos',
  estadisticas: 'estadisticas',
  graficos: 'graficos',
  exportaciones: 'exportaciones',
});

export const IDS_CUADRO = ['temas', 'promret', 'promedio']
  .flatMap(cuadro => [1, 2, 3].map(trimestre => `${cuadro}_${trimestre}`));

export function subDeId(id) {
  if (id.startsWith('temas_')) return SUB.cuadros;
  if (id.startsWith('promedio_')) return SUB.promedios;
  if (id.startsWith('promret_')) return SUB.promret;
  return SUB.estadisticas;
}

export const refUE = (db, coleccion = COLECCION_DEFECTO) => doc(db, RAIZ, coleccion);
export const refCuadro = (db, id, coleccion = COLECCION_DEFECTO) =>
  doc(db, RAIZ, coleccion, subDeId(id), id);
export const refRegistro = db => doc(db, RAIZ, REGISTRO_DOC);
export const refLegacy = (db, id, coleccion = COLECCION_DEFECTO) => doc(db, coleccion, id);

/** Lee primero la ruta nueva y, si no existe, la antigua. */
export async function leerDocumento(db, id, coleccion = COLECCION_DEFECTO) {
  const actual = await getDoc(refCuadro(db, id, coleccion)).catch(() => null);
  if (actual?.exists()) return actual.data();
  const viejo = await getDoc(refLegacy(db, id, coleccion)).catch(() => null);
  return viejo?.exists() ? viejo.data() : null;
}
