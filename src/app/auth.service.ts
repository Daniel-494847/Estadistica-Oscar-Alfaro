import { Injectable, signal } from '@angular/core';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { app } from './firebase.service';

// El acceso anónimo no necesita este servicio. Solo el apartado de administrador
// usa Firebase Auth (correo y contraseña creados en Firebase Console).
@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = getAuth(app);
  usuario = signal<User | null>(null);
  cargando = signal(true);
  error = signal('');

  constructor() {
    onAuthStateChanged(this.auth, u => {
      this.usuario.set(u);
      this.cargando.set(false);
    });
  }

  get esAdmin() {
    return !!this.usuario();
  }

  async ingresar(correo: string, clave: string) {
    this.error.set('');
    try {
      await signInWithEmailAndPassword(this.auth, correo.trim(), clave);
      return true;
    } catch (e: any) {
      this.error.set(this.mensaje(e?.code, e?.message));
      return false;
    }
  }

  async salir() {
    await signOut(this.auth);
    this.error.set('');
  }

  private mensaje(code?: string, detalle?: string) {
    switch (code) {
      case 'auth/invalid-email': return 'El correo electrónico no es válido.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'Correo o contraseña incorrectos. Verifique que el usuario exista en Firebase Console → Authentication → Users.';
      case 'auth/operation-not-allowed': return 'Falta habilitar el acceso con correo/contraseña en Firebase Console → Authentication → Sign-in method.';
      case 'auth/unauthorized-domain': return 'Dominio no autorizado. En Firebase Console → Authentication → Settings → Authorized domains, agregue daniel-494847.github.io (y localhost si prueba en local).';
      case 'auth/user-disabled': return 'Este usuario está deshabilitado en Firebase Console → Authentication → Users.';
      case 'auth/too-many-requests': return 'Demasiados intentos. Espere un momento e intente de nuevo.';
      case 'auth/network-request-failed': return 'No hay conexión con Firebase.';
      default: return `No se pudo iniciar sesión (${code ?? 'error desconocido'}). ${detalle ?? ''}`.trim();
    }
  }
}
