# Base de datos de Cafexis en Supabase

Este directorio contiene el esquema completo de base de datos para Cafexis,
listo para aplicarse en un proyecto de Supabase. Todas las tablas usan el
sufijo `_cafexis` (por ejemplo `products_cafexis`, `orders_cafexis`) para que
convivan sin conflicto en un proyecto de Supabase compartido con otras cosas.

## Qué contiene

```
supabase/
  migrations/
    0001_schema_cafexis.sql          Tablas, tipos y triggers
    0002_rls_cafexis.sql             Seguridad por negocio (Row Level Security)
    0003_seed_demo_cafexis.sql       Datos de ejemplo del negocio demo
    0004_user_management_cafexis.sql Invitaciones, roles y permisos de gestión
  functions/
    invite-user/index.ts             Edge Function: invita usuarios sin cerrar tu sesión
```

El esquema traduce 1 a 1 el modelo de datos que ya usa el frontend
(`src/types/domain.ts`): negocios, usuarios internos, inventario, productos y
recetas, lotes de café (trazabilidad), proveedores, pedidos, compras y
reportes personalizados. Multi-tenant: cada fila pertenece a un
`business_id`, y las políticas de seguridad garantizan que un negocio nunca
pueda leer o modificar los datos de otro.

La autenticación usa **Supabase Auth** (no contraseñas propias): cada usuario
de `app_users_cafexis` está vinculado 1 a 1 con un usuario de `auth.users`,
que es quien maneja el login, la recuperación de contraseña, etc. de forma
segura.

## Qué necesito que me entregues

### 1. Un proyecto de Supabase

Si aún no tienes uno:
1. Crea una cuenta en [supabase.com](https://supabase.com) (tiene plan gratuito).
2. Crea un proyecto nuevo (elige una región cercana a Colombia, por ejemplo
   `us-east-1` o `sa-east-1` si está disponible).
3. Anota la **contraseña de la base de datos** que te pida al crearlo — la
   necesitarás para conectarte por línea de comandos.

### 2. Las claves de conexión (para conectar el frontend)

Dentro de tu proyecto de Supabase, ve a **Project Settings → API** y
compárteme (o colócalas tú mismo en un archivo `.env` local, ver más abajo):

| Dato | Dónde se usa | ¿Es secreto? |
|---|---|---|
| **Project URL** (`https://xxxxx.supabase.co`) | Frontend | No |
| **anon public key** | Frontend | No (es pública, protegida por RLS) |
| **service_role key** | Solo si construimos funciones de servidor | **Sí, nunca en el frontend ni en git** |

Con la Project URL y la anon key puedo conectar el frontend directamente
(instalando `@supabase/supabase-js` y reemplazando la capa `services/api/*`
que ya está preparada para esto). La `service_role key` solo se necesitaría
si más adelante construimos funciones/edge functions en el servidor — no la
compartas en ningún mensaje ni la subas a GitHub.

### 3. Cómo aplicar el esquema

Tienes dos formas, elige la que prefieras:

**Opción A — Panel web de Supabase (más simple):**
1. Ve a **SQL Editor** en el panel de tu proyecto.
2. Copia y ejecuta, en orden, el contenido de:
   - `migrations/0001_schema_cafexis.sql`
   - `migrations/0002_rls_cafexis.sql`
   - `migrations/0003_seed_demo_cafexis.sql` (opcional, son datos de ejemplo)
   - `migrations/0004_user_management_cafexis.sql`
   - `migrations/0005_fase1_datos_base_cafexis.sql`
   - `migrations/0006_fase2_operacion_diaria_cafexis.sql`
   - `migrations/0007_fase3_roles_cafexis.sql`
   - `migrations/0008_supervisor_rpc_negocio_cafexis.sql`
   - `migrations/0009_fase4_inteligencia_cafexis.sql` (pendiente — ver paso 9)
   - `migrations/0010_fase5_cliente_final_cafexis.sql` (pendiente — ver paso 10)

**Opción B — Supabase CLI (recomendado si seguimos iterando el esquema):**
```bash
npm install -g supabase
supabase login
supabase link --project-ref <tu-project-ref>   # está en Project Settings → General
supabase db push
```

### 4. Crear el usuario demo (pendiente — necesario para poder iniciar sesión)

El seed crea el negocio "Mi Cafetería" pero no el usuario, porque las
contraseñas las maneja Supabase Auth, no una tabla nuestra. Para poder
iniciar sesión con la cuenta demo que ya usa el frontend (`laura@micafeteria.co`
/ `cafexis123`):

1. En el panel de Supabase, ve a **Authentication → Users → Add user** y
   crea un usuario con correo `laura@micafeteria.co` y contraseña `cafexis123`
   (o la que prefieras — solo ajusta el mensaje en `LoginPage.tsx` si la cambias).
   Marca **Auto Confirm User** al crearlo para no depender de un correo de
   confirmación.
2. Copia el **UUID** que Supabase le asignó a ese usuario.
3. En el **SQL Editor**, ejecuta (reemplazando `<uuid-del-usuario>`):
   ```sql
   insert into app_users_cafexis (id, business_id, name, email, role)
   values ('<uuid-del-usuario>', '11111111-1111-1111-1111-111111111111', 'Laura Gómez', 'laura@micafeteria.co', 'administrador');
   ```

De ahí en adelante, cuando alguien se registre desde el formulario de
Cafexis, todo este proceso (crear usuario en Auth + su fila en
`app_users_cafexis` + su negocio en `businesses_cafexis`) lo hará el propio
frontend automáticamente — este paso manual es solo para la cuenta demo.

### 5. Migración de Fase 1 (ya aplicada — Configuración y Lotes de café)

El frontend ya incluye el CRUD completo de Inventario, Configuración del
negocio, Proveedores y Lotes de café, pero dos piezas dependen de que se
ejecute `migrations/0005_fase1_datos_base_cafexis.sql` en tu proyecto real:

1. **Vincular un producto empacado a su lote de origen** (en el formulario de
   Productos): la migración agrega la columna `coffee_lot_id` a
   `products_cafexis`. Sin ella, guardar un producto con un lote seleccionado
   falla con `Could not find the 'coffee_lot_id' column...`.
2. **Subir el logo del negocio desde Configuración**: la migración crea el
   bucket público de Storage `business-logos` con sus políticas (cada negocio
   solo puede subir/reemplazar su propio archivo). Sin ella, subir un logo
   falla con `Bucket not found`. Editar nombre, tipo, país y color del
   negocio sí funciona sin este paso, porque solo usa columnas que ya
   existían.

Para aplicarla: en el **SQL Editor** del panel de Supabase, copia y ejecuta
el contenido de `migrations/0005_fase1_datos_base_cafexis.sql`. El resto de
los módulos nuevos (Inventario completo, Proveedores con búsqueda por NIT,
creación/edición de Lotes de café) no dependen de este paso y ya funcionan
contra el esquema actual.

### 6. Migración de Fase 2 (ya aplicada — vender y comprar)

`migrations/0006_fase2_operacion_diaria_cafexis.sql` (después de la 0005)
habilita la operación diaria. Sin ella, "Nueva venta" y las acciones de
Compras fallan con `Could not find the function ...`.

- **Punto de venta** (`register_sale_cafexis`): crea el pedido y sus líneas en
  una transacción, con los precios de la base de datos. Métodos de pago:
  efectivo, tarjeta, transferencia y Nequi (solo se registra; no hay cobro en
  línea). Los pedidos nuevos se numeran `V-0001`, `V-0002`…
- **Descuento automático de inventario**: un trigger en `order_items_cafexis`
  descuenta los ingredientes de la receta; si el producto no tiene receta pero
  sí lote de origen y "kg del lote por unidad", descuenta del lote. Si falta
  stock, **la venta no se guarda** y se muestra qué falta.
- **Compras automáticas**: cuando una venta o un ajuste deja un insumo en
  "bajo" o "agotado", se agrega a una propuesta del sistema para su
  *proveedor preferido* (campo nuevo en Inventario), sin duplicar insumos que
  ya estén en una orden abierta. Cantidad sugerida: lo que falta para llegar
  al doble del umbral. El botón "Revisar inventario" hace la misma revisión
  para todo el inventario.
- **Ciclo de una orden**: propuesta → confirmada → recibida, o cancelada desde
  propuesta/confirmada. Las órdenes manuales nacen confirmadas. Recibir suma
  las cantidades al inventario. La base de datos rechaza cualquier otro salto
  de estado.

### 7. Migración de Fase 3 (ya aplicada — roles y personal)

`migrations/0007_fase3_roles_cafexis.sql` amplía las políticas de seguridad
de las tablas de negocio (inventario, productos, lotes, pedidos, compras,
proveedores del negocio, reportes personalizados) para que el
`supervisor_tecnico` pueda también **escribir** en cualquier negocio, no
solo leerlo como ya podía desde `0002_rls_cafexis.sql`. Esto habilita el
selector de negocio que aparece en el panel superior solo para ese rol: al
elegir otro negocio, el supervisor pasa a operar ahí (crear productos,
registrar ventas, ajustar inventario, etc.) con los mismos permisos que el
administrador de ese negocio.

También en esta fase: el menú lateral y las rutas del panel ahora se
filtran por rol. El barista solo ve "Ventas" (su tablero de pedidos, con la
receta de cada bebida visible en cada tarjeta); intentar abrir cualquier
otra sección a mano lo redirige de vuelta. Administrador y supervisor
técnico siguen viendo el panel completo.

### 8. Supervisor operando otro negocio en ventas y compras (ya aplicada)

`migrations/0008_supervisor_rpc_negocio_cafexis.sql` corrige que las
funciones de Fase 2 (`register_sale_cafexis`, `create_purchase_order_cafexis`,
`generate_purchase_proposals_cafexis`) usaban siempre el negocio del perfil:
un supervisor técnico que eligiera otro negocio en el selector registraba
ventas y compras en el suyo. Ahora reciben `p_business_id`; un negocio
distinto al propio solo se acepta si quien llama es supervisor técnico.

**Importante:** el frontend ya envía `p_business_id`, así que sin esta
migración "Nueva venta", "Nueva orden de compra" y "Revisar inventario"
fallan con `Could not find the function ...`.

### 9. Migración de Fase 4 (pendiente — reportes y reposición)

`migrations/0009_fase4_inteligencia_cafexis.sql` (después de la 0008). Sin
ella, la sección Reportes y la "Sugerencia de reposición" de Compras fallan
con `Could not find the function ...`.

- **Historial de movimientos** (`stock_movements_cafexis`): cada cambio de
  existencia de un insumo o lote queda registrado con su motivo (venta,
  compra recibida, ajuste manual o existencia inicial). Lo escriben
  triggers; nadie puede editarlo desde la app. Al aplicar la migración se
  reconstruye el consumo de las ventas anteriores con las recetas actuales
  (marcado como `estimated`).
- **Reportes** calculados en la base de datos (sin el límite de 1000 filas
  por consulta): ventas por producto, categoría, método de pago, hora, día,
  semana o mes, y movimientos de insumos o lotes. Los 4 reportes
  predefinidos del alcance y los personalizados usan las mismas funciones.
- **Proyección de reposición** (`inventory_projection_cafexis`): consumo
  diario promedio por ventas, fecha estimada de agotamiento y cantidad
  sugerida para cubrir N días más el umbral de alerta.
- **Solo administrador y supervisor técnico** ven reportes, movimientos,
  proyección y reportes personalizados (el barista no, según el alcance).

### 10. Migración de Fase 5 (pendiente — cliente final web)

`migrations/0010_fase5_cliente_final_cafexis.sql` (no depende de la 0009,
puede aplicarse antes o después de ella). Sin ella, el catálogo público, la
trazabilidad por QR y el pedido desde el celular fallan: el panel de
Configuración no encuentra `slug` en el negocio, y las páginas públicas
(`/c/:slug`, `/trazabilidad/:lotId`) responden con "función no encontrada".

- **`businesses_cafexis.slug`**: identificador en la URL pública
  (`/c/:slug`), generado automáticamente del nombre del negocio (único en
  toda la plataforma, con sufijo numérico si hay colisión). Se asigna solo
  y no cambia al editar el nombre después.
- **`customers_cafexis`**: perfil del cliente final (login con Google), sin
  negocio fijo — a diferencia de los empleados internos
  (`app_users_cafexis`), un cliente puede estar vinculado a varios negocios
  (`customer_businesses_cafexis`), igual que elegir cuenta en Gmail.
- **Catálogo y trazabilidad públicos**: `get_public_business_cafexis`,
  `get_public_catalog_cafexis`, `get_public_coffee_lot_cafexis` — de
  lectura, sin sesión, exponen solo lo que un visitante anónimo debe ver
  (nunca las tablas completas).
- **Pedido del cliente final**: `register_public_order_cafexis` (exige
  login con Google y estar vinculado al negocio), mismo patrón que el
  punto de venta interno — los precios los toma la base de datos, nunca el
  cliente, y el mismo trigger de descuento de inventario ya existente
  (0006) aplica igual.

**Paso adicional, fuera de esta migración**: el login con Google requiere
configurar ese proveedor en el panel de Supabase. Ve a **Authentication →
Providers → Google**, actívalo, y pega el **Client ID** y **Client
Secret** de un proyecto de [Google Cloud
Console](https://console.cloud.google.com/apis/credentials) (tipo de
credencial "OAuth 2.0 Client ID", aplicación web). En **Authorized redirect
URIs** de Google Cloud, agrega la URL de callback que Supabase muestra en
esa misma pantalla (termina en `/auth/v1/callback`). Sin este paso, el
botón "Iniciar sesión con Google" del catálogo público falla.

## Gestión de usuarios y roles (invitaciones)

Desde "Configuración" en el panel, un administrador (o el supervisor técnico)
puede invitar usuarios internos nuevos (administrador o barista) a su
negocio. Como `supabase.auth.signUp()` autenticaría como el usuario invitado
y cerraría la sesión de quien invita, este flujo usa
`supabase.auth.admin.inviteUserByEmail`, que solo funciona con la
**service_role key** — por eso vive en una Edge Function
(`functions/invite-user/`), nunca en el frontend.

### Desplegar la Edge Function (pendiente — necesario para que "Invitar usuario" funcione)

1. Instala la CLI de Supabase si no la tienes: `npm install -g supabase`.
2. Autentícate y enlaza el proyecto (si no lo hiciste ya para las migraciones):
   ```bash
   supabase login
   supabase link --project-ref <tu-project-ref>
   ```
3. Despliega la función:
   ```bash
   supabase functions deploy invite-user
   ```
4. Configúrale su variable de entorno secreta — **nunca la pongas en el
   repositorio ni me la compartas por mensaje**, solo en el panel de
   Supabase: **Project Settings → Edge Functions → invite-user → Secrets**,
   o por CLI:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
   ```
   La `service_role key` está en **Project Settings → API** (la misma
   pantalla donde está la anon key, más abajo, marcada como secreta).

Sin este despliegue, el botón "Invitar usuario" del panel mostrará un error
al intentar enviar la invitación (la función no existe todavía en tu
proyecto de Supabase).

### Qué hace cada pieza

- `user_invitations_cafexis`: registra cada invitación enviada, para
  mostrarla como "pendiente" en el panel hasta que la persona acepta.
- Un trigger sobre `auth.users` completa automáticamente el perfil
  (`app_users_cafexis`) apenas la persona invitada confirma su cuenta —
  no requiere ningún paso manual adicional.
- Solo `administrador` (de su propio negocio) o `supervisor_tecnico` pueden
  invitar, cambiar el rol de alguien o desactivarlo — reforzado con
  políticas RLS, no solo con la interfaz.
- Nadie puede cambiar su propio rol (ni un administrador puede
  autodegradarse por error), salvo el supervisor técnico.

## Frontend ya conectado a Supabase

El frontend ya no usa datos de ejemplo en memoria: `src/services/api/*Service.ts`
consulta directamente las tablas `*_cafexis` a través de
`src/services/api/supabaseClient.ts`, y `authService.ts` usa Supabase Auth
(`signUp` / `signInWithPassword`) en lugar de `localStorage`. Las credenciales
viven en un `.env` local (no versionado) con `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` — ver `.env.example`.

Se verificó por separado (llamada REST directa) que las políticas de RLS
responden correctamente: sin sesión autenticada, `businesses_cafexis` no
devuelve ninguna fila aunque exista el negocio demo, que es el comportamiento
esperado. Falta únicamente el paso 4 de arriba (crear el usuario demo en
Supabase Auth) para poder probar el login end-to-end con esa cuenta; registrar
un negocio nuevo desde `/registro` ya funciona sin pasos manuales.
