// Copia T.PROG. ANUAL de los cuadros de temas a los trimestres donde falte.
// No sobrescribe valores ya existentes; solo agrega las claves *_anual ausentes.
// Uso: node scripts/backfill-anual.mjs [coleccion]  (si se omite, recorre el registro)
import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, setDoc } from 'firebase/firestore';
import { leerDocumento, refCuadro, refRegistro } from './firestore-structure.mjs';

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyAhW6B32EZ4AbQDXI9-OofzLuJ-3K-DgVs',
  authDomain: 'estadisticas-3b3c2.firebaseapp.com',
  projectId: 'estadisticas-3b3c2',
  appId: '1:657244989745:web:d6ca3cab8d92cdd62e2810',
}));

const registro = await getDoc(refRegistro(db)).catch(() => null);
const colegios = Object.values(registro?.data()?.['colegios'] ?? {})
  .map(c => c?.coleccion)
  .filter(Boolean);
const unidades = process.argv[2] ? [process.argv[2]] : (colegios.length ? colegios : ['cuadros']);

for (const coleccion of unidades) {
  const docs = {};
  for (const t of [1, 2, 3]) docs[t] = await leerDocumento(db, `temas_${t}`, coleccion);

  // Origen de verdad: 1º trimestre; si algún grado no tiene anual allí, se toma de 2º o 3º.
  const grados = new Set([1, 2, 3].flatMap(t => Object.keys(docs[t]?.['datos'] ?? {})));
  let escritos = 0;

  for (const g of grados) {
    const anuales = {};
    for (const t of [1, 2, 3]) {
      const fila = docs[t]?.['datos']?.[g] ?? {};
      for (const [k, v] of Object.entries(fila)) {
        if (k.endsWith('_anual') && !(k in anuales) && v !== '' && v != null) anuales[k] = v;
      }
    }
    if (!Object.keys(anuales).length) continue;

    for (const t of [2, 3]) {
      const destino = docs[t]?.['datos']?.[g] ?? {};
      const faltan = Object.fromEntries(Object.entries(anuales).filter(([k]) => !(k in destino) || destino[k] === ''));
      if (!Object.keys(faltan).length) continue;
      await setDoc(refCuadro(db, `temas_${t}`, coleccion), {
        datos: { [g]: faltan }, actualizado: Date.now(),
      }, { merge: true });
      escritos += Object.keys(faltan).length;
    }
  }

  console.log(`${coleccion}: ${escritos} casilleros T.PROG. ANUAL agregados en 2º/3º trimestre.`);
}
console.log('Backfill completado.');
