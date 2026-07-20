# Extraer `infra/` a su propio repositorio — guía de separación

Decisión del dueño (2026-07-19): el backend AWS vivirá en un **repositorio
aparte**. Este documento es el plan de extracción y el contrato de convivencia
entre los dos repos. Léelo junto a [`aws-connect.md`](./aws-connect.md) (el
runbook de conexión, que sigue siendo válido — solo cambia DÓNDE se ejecuta
`cdk deploy`) y [`backend-contract.md`](./backend-contract.md) (QUÉ debe hacer
el backend).

## 0. El principio

El backend importa hoy TRES archivos del front por alias `@app` (tsconfig
paths). Son **el contrato**, y el contrato tiene UNA fuente de verdad: este
repo (el front). El repo backend recibe una **copia vendored** de esos
archivos + un test de deriva que revienta su CI si la copia envejece.

| Archivo | Qué aporta al backend |
|---|---|
| `src/app/core/api/contracts.ts` | `RoadmapApi`, `API_PATHS`, `ApiError`, `LIMITS`, vistas y requests — **normativo** |
| `src/app/core/db/schema.ts` | `Tree`/`TreeNode`/`SyncBase`…, `SCHEMA_VERSION`, los campos STRIP |
| `src/app/core/auth/auth-types.ts` | `USERNAME_PATTERN`, `PASSWORD_POLICY`, tipos de sesión |

## 1. Qué se lleva el repo backend

Todo `infra/` tal cual, con esta forma final:

```
roadmap2u-backend/
├── bin/  lib/  lambda/  test/        # ← infra/* de aquí, sin cambios de código
├── shared/                            # ← copia vendored de los 3 archivos
│   ├── api/contracts.ts
│   ├── db/schema.ts
│   └── auth/auth-types.ts
├── scripts/sync-contracts.mjs         # re-copia desde un checkout del front
├── cdk.json  package.json  tsconfig.json  vitest.config.ts
```

Pasos:

1. Copiar `infra/*` al repo nuevo (raíz).
2. Crear `shared/` copiando los 3 archivos **byte a byte**:
   - `src/app/core/api/contracts.ts` → `shared/api/contracts.ts`
   - `src/app/core/db/schema.ts` → `shared/db/schema.ts`
   - `src/app/core/auth/auth-types.ts` → `shared/auth/auth-types.ts`
3. Re-mapear el alias en `tsconfig.json` y `vitest.config.ts` del backend —
   los imports del código Lambda **no cambian ni una letra**:
   ```jsonc
   // tsconfig.json — antes apuntaba a ../src/app/core/*
   "paths": { "@app/*": ["./shared/*"] }
   ```
   ```ts
   // vitest.config.ts
   resolve: { alias: { '@app': fileURLToPath(new URL('./shared', import.meta.url)) } }
   ```
   (El bundler de CDK (`NodejsFunction`/esbuild) resuelve por tsconfig paths;
   verifica con `npx cdk synth` que el asset compila.)
4. `npm ci && npm test && npx cdk synth` → 18 vitest verdes + synth limpio
   ANTES del primer deploy. Esa pareja es el gate de CI del repo backend.

## 2. El test de deriva (obligatorio, primero de la suite)

En `roadmap2u-backend/test/contracts-parity.test.ts`: si hay un checkout del
front al lado (`../RoadMap2U`), compara **byte a byte** cada archivo de
`shared/` contra su original; si no lo hay (CI del backend solo), pasa en
silencio — el candado fuerte es el CI del front o el ritual de release, que
SIEMPRE tienen ambos checkouts:

```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FRONT = join(__dirname, '..', '..', 'RoadMap2U', 'src', 'app', 'core');
const PAIRS = [
  ['api/contracts.ts', 'api/contracts.ts'],
  ['db/schema.ts', 'db/schema.ts'],
  ['auth/auth-types.ts', 'auth/auth-types.ts'],
] as const;

describe('shared/ es copia fiel del front', () => {
  for (const [ours, theirs] of PAIRS) {
    it(ours, () => {
      const source = join(FRONT, theirs);
      if (!existsSync(source)) return; // sin checkout del front: sin opinión
      expect(readFileSync(join(__dirname, '..', 'shared', ours), 'utf8')).toBe(
        readFileSync(source, 'utf8'),
      );
    });
  }
});
```

Y `scripts/sync-contracts.mjs` (npm run sync-contracts) — la única forma
bendecida de actualizar `shared/`: copia los 3 archivos desde
`../RoadMap2U`, imprime el diff, y recuerda correr `npm test`.

**Ley de cambio de contrato** (en este orden, siempre):
1. Cambia `contracts.ts`/`schema.ts`/`auth-types.ts` AQUÍ (front), con
   `mock-api.ts` actualizado en el mismo commit — el mock es la referencia
   ejecutable del backend.
2. En el backend: `npm run sync-contracts` → adapta los handlers → 18+ vitest
   verdes → deploy.
3. Nunca al revés: el backend jamás edita `shared/` a mano.

## 3. Qué queda en ESTE repo cuando `infra/` se vaya

- `docs/backend-contract.md`, `aws-connect.md` y este archivo — la
  especificación vive con el contrato.
- `mock-api.ts` + `mock-auth.provider.ts` — referencia ejecutable + demo.
- El grep-gate del bundle (`cognito-idp|amazonaws\.com` fuera de `main-*.js`).
- Borrar `infra/` del front SOLO después de que el repo backend tenga CI verde
  (test + synth) — y en ese commit, actualizar la fila «Backend» de la tabla
  de `aws-connect.md` §0 para apuntar al repo nuevo.

## 4. Go-live (recordatorio corto — el detalle está en aws-connect.md)

Sigue siendo **2 etapas**, y la secuencia no cambia por la separación:

1. **Etapa 1 — identidad**: user pool (a mano §2 de aws-connect, o el stack
   completo del repo backend) → pegar `region` + `userPoolId` +
   `userPoolClientId` en `src/app/core/config.ts`, `backend: 'aws'`,
   `apiBaseUrl: ''` → build → smoke real (§2.3).
2. **Etapa 2 — API**: en el repo backend `npx cdk deploy` → pegar
   `ConfigApiBaseUrl` (SIN `/v1` — `http-api.ts` lo añade) → build → smoke.
3. `requireAuth: true` queda para DESPUÉS de «conectar mi bosque» (§4 de
   aws-connect) — sin puente local→cuenta no se amuralla a nadie.

## 5. Decisiones de seguridad que viajan con la extracción

Auditoría 0.0.115 — estados y dueños:

- **CORS de producción** (pendiente de decisión al desplegar): la lista de
  `aws-connect.md` §3.4 incluye `http://localhost:4200/8826` — útil para
  probar contra el API real desde dev, pero en el stack de PRODUCCIÓN
  déjala solo con `https://toydrum.github.io`. Un origen localhost en prod
  permite que cualquier página local con un token robado hable con el API.
  Sugerencia: parámetro de contexto CDK (`-c allowDevOrigins=true`) para el
  stack de staging.
- **Rate-limit de códigos** (cerrado en 0.0.115): `acceptFamilyInvite`
  comparte el freno de 5 intentos/hora con los códigos de amistad
  (`readRateCount`/`bumpBadAttempt` en `lambda/db.ts`). No lo pierdas al
  copiar.
- **Params de ruta** (cerrado en 0.0.115): el router funde
  `{ ...query, ...path }` — el path SIEMPRE gana. Test de paridad de rutas lo
  cubre.
- **`queryPrefix` con prefijo vacío** (cerrado en 0.0.115): consulta pk-only;
  el DynamoDB real rechaza `begins_with(sk, '')` — el doble en memoria no.
- **CSP** (nota, front): GitHub Pages no permite headers; la CSP real llegará
  vía `<meta http-equiv>` si algún día se quiere endurecer. La superficie XSS
  es nula hoy (sin innerHTML, sin URLs dinámicas en templates).
- **Sesión caducada en visita** (conocido, tolerable): un guardián con token
  vencido ve la ÚLTIMA copia descargada del bosque del menor hasta que
  interactúa (el pull falla silencioso y el guard no re-valida en cada
  navegación). El dato es del propio hogar familiar; no es un leak entre
  extraños.
- **Atomicidad de visit-branch** (conocido, aceptado): el write-through del
  guardián (`pushSyncFor`) empuja registro por registro; un corte a mitad de
  un branched puede dejar el padre transformado sin sus hijos hasta el
  siguiente push. LWW lo repara en la próxima sesión; documentado, no
  bloqueante para el go-live.

## 6. Checklist final antes del primer deploy real

- [ ] Repo backend: `npm test` (18+) y `npx cdk synth` verdes en CI.
- [ ] Test de deriva presente y verde con checkout del front al lado.
- [ ] CORS de prod SIN localhost (§5).
- [ ] Deploy → pegar los 4 outputs en `config.ts` → build.
- [ ] Grep-gate: `main-*.js` sin `cognito-idp|amazonaws\.com`.
- [ ] Smoke real §2.3 de aws-connect (cuenta real, offline reload, sign-out
      no toca árboles).
- [ ] Las puertas mock (reset de familia demo en Settings, `123456`) quedan
      automáticamente fuera: están gateadas por `isMock`
      (`APP_CONFIG.backend === 'mock'`) — verificar que no se ven.
