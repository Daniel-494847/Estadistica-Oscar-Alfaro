import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore, doc, getDoc, setDoc, deleteField } from 'firebase/firestore';

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

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private db = getFirestore(app);

  // Cada cuadro se guarda en un documento: cuadros/temas_1, cuadros/promret_2, ...
  async leer(id: string) {
    const s = await getDoc(doc(this.db, 'cuadros', id));
    return s.exists() ? s.data() : null;
  }
  // Guarda solo el grado indicado (merge: no pisa a los otros grados)
  guardarGrado(id: string, grado: string, fila: object, extra: object) {
    return setDoc(doc(this.db, 'cuadros', id), { datos: { [grado]: fila }, ...extra, actualizado: Date.now() }, { merge: true });
  }
  // Borra un campo concreto sin afectar al resto del grado
  borrarCampoGrado(id: string, grado: string, campo: string) {
    return setDoc(doc(this.db, 'cuadros', id), { datos: { [grado]: { [campo]: deleteField() } }, actualizado: Date.now() }, { merge: true });
  }
  // Estado de bloqueo de la edición por trimestre (lo controla el administrador)
  async leerBloqueos(): Promise<Record<number, boolean>> {
    const d: any = await this.leer('acceso').catch(() => null);
    return (d?.bloqueos ?? {}) as Record<number, boolean>;
  }
  guardarBloqueos(bloqueos: Record<number, boolean>) {
    return setDoc(doc(this.db, 'cuadros', 'acceso'), { bloqueos, actualizado: Date.now() }, { merge: true });
  }
}
