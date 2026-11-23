// Copia la unidad educativa de las rutas antiguas a reportes-academicos.
// Respeta lo que ya exista en la ruta nueva ({ merge: true }) y no borra nada.
// Uso: node scripts/migrate-firestore.mjs [coleccion]
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { IDS_CUADRO, refCuadro, refLegacy, refRegistro, refUE } from './firestore-structure.mjs';

const coleccion = process.argv[2] || 'cuadros';
const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyAhW6B32EZ4AbQDXI9-OofzLuJ-3K-DgVs',
  authDomain: 'estadisticas-3b3c2.firebaseapp.com',
  projectId: 'estadisticas-3b3c2',
  appId: '1:657244989745:web:d6ca3cab8d92cdd62e2810',
}));

// Preferencias y nombre de la U.E.: antes en <coleccion>/acceso.
const accesoViejo = await getDoc(refLegacy(db, 'acceso', coleccion)).catch(() => null);
if (accesoViejo?.exists()) {
  await setDoc(refUE(db, coleccion), {
    ...accesoViejo.data(),
    nombre: accesoViejo.data()?.nombre || 'OSCAR ALFARO',
    coleccion,
    migrado: Date.now(),
  }, { merge: true });
  console.log(`✓ reportes-academicos/${coleccion}: preferencias migradas`);
}

// Los 9 cuadros: antes en <coleccion>/<id>.
for (const id of IDS_CUADRO.filter(x => x !== 'acceso')) {
  const viejo = await getDoc(refLegacy(db, id, coleccion)).catch(() => null);
  if (!viejo?.exists()) {
    console.log(`· ${id}: no existe en la ruta antigua, se omite`);
    continue;
  }
  await setDoc(refCuadro(db, id, coleccion), { ...viejo.data(), migrado: Date.now() }, { merge: true });
  console.log(`✓ ${id}: migrado`);
}

// Registro de unidades: antes en config/colegios.
const registroViejo = await getDoc(doc(db, 'config', 'colegios')).catch(() => null);
if (registroViejo?.exists()) {
  const colegios = registroViejo.data()?.['colegios'] ?? {};
  await setDoc(refRegistro(db), { colegios, migrado: Date.now() }, { merge: true });
  console.log('✓ reportes-academicos/_registro: migrado');
}
console.log('Migración completada.');
