// Verifica que los documentos esperados existan en la colección `cuadros`.
// Uso: node scripts/verify-firestore.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyAhW6B32EZ4AbQDXI9-OofzLuJ-3K-DgVs',
  authDomain: 'estadisticas-3b3c2.firebaseapp.com',
  projectId: 'estadisticas-3b3c2',
  appId: '1:657244989745:web:d6ca3cab8d92cdd62e2810',
}));

const ids = ['temas', 'promret', 'promedio'].flatMap(cuadro =>
  [1, 2, 3].map(trimestre => `${cuadro}_${trimestre}`));
for (const id of ids) {
  const snap = await getDoc(doc(db, 'cuadros', id));
  const grados = Object.keys(snap.data()?.datos ?? {}).length;
  console.log(`${id}: ${snap.exists() ? 'existe' : 'FALTA'} (${grados} grados)`);
}
