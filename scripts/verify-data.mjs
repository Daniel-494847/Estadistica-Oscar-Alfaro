// Compara los datos de Firestore contra scripts/datos-iniciales.json.
// Uso: npm run verify:data
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { leerDocumento } from './firestore-structure.mjs';

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
  const actual = await leerDocumento(db, id);
  if (!actual) {
    console.log(`✗ ${id}: no existe`);
    errores++;
    continue;
  }
  // _reprobados es un campo de la app, no parte del JSON semilla.
  const sinReprobados = datos => Object.fromEntries(Object.entries(datos ?? {}).map(([g, fila]) => {
    const { _reprobados, ...resto } = fila ?? {};
    return [g, resto];
  }));
  const diffs = ['gestion', 'lugar'].filter(k =>
    JSON.stringify(norm(actual[k])) !== JSON.stringify(norm(payload[k])));
  if (JSON.stringify(norm(sinReprobados(actual.datos))) !== JSON.stringify(norm(sinReprobados(payload.datos)))) diffs.push('datos');
  if (diffs.length) {
    console.log(`✗ ${id}: difiere en ${diffs.join(', ')}`);
    errores++;
  } else {
    console.log(`✓ ${id}: OK (${Object.keys(payload.datos ?? {}).length} grados)`);
  }
}
console.log(errores ? `${errores} documento(s) con diferencias.` : 'Todos los documentos coinciden.');
process.exitCode = errores ? 1 : 0;
