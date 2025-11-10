import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Cargar el archivo JSON de forma compatible (sin usar import assertions)
// Usamos `new URL(..., import.meta.url)` para resolver rutas en ESM
const serviceAccountRaw = readFileSync(new URL('../../serviceAccountKey.json', import.meta.url), 'utf8');
const serviceAccount = JSON.parse(serviceAccountRaw);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Exportamos 'admin' para que otros archivos puedan usarlo
export default admin;