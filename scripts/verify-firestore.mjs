// Verifica los documentos esperados en reportes-academicos/cuadros.
// Uso: node scripts/verify-firestore.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { IDS_CUADRO, leerDocumento } from './firestore-structure.mjs';

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyAhW6B32EZ4AbQDXI9-OofzLuJ-3K-DgVs',
  authDomain: 'estadisticas-3b3c2.firebaseapp.com',
  projectId: 'estadisticas-3b3c2',
  appId: '1:657244989745:web:d6ca3cab8d92cdd62e2810',
}));

for (const id of IDS_CUADRO) {
  const datos = await leerDocumento(db, id);
  const grados = Object.keys(datos?.datos ?? {}).length;
  console.log(`${id}: ${datos ? 'existe' : 'FALTA'} (${grados} grados)`);
}
