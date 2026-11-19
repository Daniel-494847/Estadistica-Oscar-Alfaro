// Compara los datos de Firestore contra scripts/datos-iniciales.json.
// Uso: npm run verify:data
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const ruta = join(dirname(fileURLToPath(import.meta.url)), 'datos-iniciales.json');
const esperado = JSON.parse(readFileSync(ruta, 'utf8'));

const db = getFirestore(initializeApp({
  apiKey: 'AIzaSyAhW6B32EZ4AbQDXI9-OofzLuJ-3K-DgVs',
  authDomain: 'estadisticas-3b3c2.firebaseapp.com',
  projectId: 'estadisticas-3b3c2',
  appId: '1:657244989745:web:d6ca3cab8d92cdd62e2810',
}));

// Firestore no garantiza el orden de las claves: normalizamos antes de comparar.
const norm = v =>
  Array.isArray(v) ? v.map(norm)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, norm(v[k])]))
  : v;

let errores = 0;
for (const [id, payload] of Object.entries(esperado)) {
  const snap = await getDoc(doc(db, 'cuadros', id));
  if (!snap.exists()) {
    console.log(`✗ ${id}: no existe`);
    errores++;
    continue;
  }
  const actual = snap.data();
  const diffs = ['datos', 'gestion', 'lugar'].filter(k =>
    JSON.stringify(norm(actual[k])) !== JSON.stringify(norm(payload[k])));
  if (diffs.length) {
    console.log(`✗ ${id}: difiere en ${diffs.join(', ')}`);
    errores++;
  } else {
    console.log(`✓ ${id}: OK (${Object.keys(payload.datos ?? {}).length} grados)`);
  }
}
console.log(errores ? `${errores} documento(s) con diferencias.` : 'Todos los documentos coinciden.');
process.exitCode = errores ? 1 : 0;
