// Inicializa reportes-academicos/cuadros con los documentos que usa la aplicación.
// Los documentos existentes NO se sobrescriben.
// Uso: node scripts/init-firestore.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { IDS_CUADRO, refCuadro, refUE } from './firestore-structure.mjs';

const firebaseConfig = {
  apiKey: 'AIzaSyAhW6B32EZ4AbQDXI9-OofzLuJ-3K-DgVs',
  authDomain: 'estadisticas-3b3c2.firebaseapp.com',
  projectId: 'estadisticas-3b3c2',
  storageBucket: 'estadisticas-3b3c2.firebasestorage.app',
  messagingSenderId: '657244989745',
  appId: '1:657244989745:web:d6ca3cab8d92cdd62e2810',
  measurementId: 'G-72KVSH4HMT',
};

const db = getFirestore(initializeApp(firebaseConfig));
const grados = ['1A','1B','2A','2B','3A','3B','4A','4B','5A','5B','6A','6B'];
const datos = Object.fromEntries(grados.map(g => [g, {}]));

const ue = refUE(db);
if (!(await getDoc(ue).catch(() => null))?.exists()) {
  await setDoc(ue, {
    nombre: 'OSCAR ALFARO',
    coleccion: 'cuadros',
    gestion: '2026',
    creado: serverTimestamp(),
    actualizado: serverTimestamp(),
  });
  console.log('+ reportes-academicos/cuadros: creado.');
}

for (const id of IDS_CUADRO) {
  const ref = refCuadro(db, id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    console.log(`· ${id}: ya existe, se conserva.`);
    continue;
  }
  await setDoc(ref, {
    datos,
    gestion: '2026',
    lugar: 'Bermejo, 08 de mayo de 2026',
    creado: serverTimestamp(),
    actualizado: serverTimestamp(),
  });
  console.log(`+ ${id}: creado.`);
}
console.log('Listo. reportes-academicos/cuadros inicializado.');
