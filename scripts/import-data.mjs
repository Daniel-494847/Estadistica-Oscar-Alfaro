// Importa scripts/datos-iniciales.json a reportes-academicos/cuadros de Firestore.
// Reemplaza el contenido de los 9 documentos (los datos sembrados vacíos).
// Uso: npm run import:data
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { refCuadro, refUE } from './firestore-structure.mjs';

const ruta = join(dirname(fileURLToPath(import.meta.url)), 'datos-iniciales.json');
const datos = JSON.parse(readFileSync(ruta, 'utf8'));

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyAhW6B32EZ4AbQDXI9-OofzLuJ-3K-DgVs',
  authDomain: 'estadisticas-3b3c2.firebaseapp.com',
  projectId: 'estadisticas-3b3c2',
  appId: '1:657244989745:web:d6ca3cab8d92cdd62e2810',
}));

const ue = refUE(db);
if (!(await getDoc(ue).catch(() => null))?.exists()) {
  await setDoc(ue, {
    nombre: 'OSCAR ALFARO',
    coleccion: 'cuadros',
    gestion: '2026',
    actualizado: serverTimestamp(),
  }, { merge: true });
}

for (const [id, payload] of Object.entries(datos)) {
  const ref = refCuadro(db, id);
  const previo = await getDoc(ref);
  const creado = previo.data()?.creado;
  await setDoc(ref, {
    ...payload,
    ...(creado ? { creado } : {}),
    actualizado: serverTimestamp(),
  });
  const grados = Object.keys(payload.datos ?? {}).length;
  console.log(`✓ ${id}: ${grados} grados, gestión ${payload.gestion}`);
}
console.log('Importación completada.');
