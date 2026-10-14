# Cafexis

Sistema Integral de Gestión y Ventas para Negocios de Café — plataforma web,
aplicación Android y aplicación iOS pensadas para cafeterías y negocios que
venden café en grano o molido (o ambos a la vez).

## Qué es Cafexis

Cafexis ayuda a un negocio de café a llevar en un solo lugar sus ventas, su
inventario, sus proveedores y la relación con sus clientes, adaptándose a la
forma particular en que trabaja cada tipo de negocio:

- **Cafeterías**, que preparan y venden bebidas a partir de recetas con
  ingredientes controlados en inventario.
- **Venta de café en grano o molido**, con trazabilidad de cada lote (proceso,
  variedad, origen y, cuando existe, la finca de procedencia), historia que
  puede compartirse con el cliente final mediante un código QR.

El sistema reconoce distintos roles —supervisor técnico, soporte de
plataforma, administrador/dueño, barista/vendedor y cliente final— cada uno
con acceso solo a lo que necesita para su labor.

El detalle completo del alcance está en
[`Documentos/documento_alcance_proyecto.pdf`](Documentos/documento_alcance_proyecto.pdf).

## Estado actual del proyecto

**Las 8 fases de desarrollo (0 a 7) están terminadas a nivel de código.** La
plataforma web, la vista del barista, la experiencia del cliente final, las
integraciones y las apps móviles están programadas sobre Supabase (Postgres +
autenticación + Row Level Security por negocio + Edge Functions). El
proyecto compila sin errores (`npm run build`).

Lo que queda para salir a producción **no es programación**: son trámites
legales y comerciales con terceros (pasarela de pagos, DIAN y tiendas de
aplicaciones), descritos en
[Pasos fuera de la programación](#pasos-fuera-de-la-programación-pagos-y-dian).

Las migraciones de cada fase están en
[`supabase/migrations/`](supabase/migrations/).

| Fase | Estado | Qué incluye | Migración |
|---|---|---|---|
| 0 · Base y ajustes | ✅ | Autenticación, negocios multi-tenant, usuarios e invitaciones por rol, productos y recetas, "Ventas de hoy" filtrado por fecha | `0001`–`0004` |
| 1 · Datos base | ✅ | Inventario editable (alta, edición, ajuste de existencias y umbrales), datos y logo del negocio, proveedores compartidos por NIT con sucursales, lotes de café ligados a productos empacados | `0005` |
| 2 · Operación diaria | ✅ | Punto de venta (efectivo, tarjeta, transferencia, Nequi), descuento automático de inventario al vender, propuestas de compra automáticas, órdenes manuales, recepción (suma al inventario) y cancelación | `0006` |
| 3 · Roles y personal | ✅ | Rutas y menú según rol, vista del barista con la receta de cada pedido, supervisor técnico operando cualquier negocio desde un selector | `0007`, `0008` |
| 4 · Inteligencia del negocio | ✅ | Historial de movimientos de inventario, los 4 reportes predefinidos con gráficas, generador de reportes personalizados, proyección de reposición en Compras | `0009` |
| 5 · Cliente final (web) | ✅ | Página pública de trazabilidad por lote con QR real, catálogo/menú público por negocio (`/c/:slug`) con QR, pedido con carrito y mesa/referencia, historial y estado de pedidos del cliente | `0010` |
| 6 · Integraciones externas | ✅ Código terminado · ⚠️ requiere trámites | Suscripciones con 14 días de prueba y bloqueo al vencer (**funciona ya**). Pagos en línea con Wompi (link de pago + webhook con verificación de firma) y facturación electrónica DIAN con Factus (botón "Generar factura" en pedidos entregados): **programados, pero sin probar contra las APIs reales hasta tener las cuentas** | `0012` |
| 7 · Plataforma y móvil | ✅ Código terminado · ⚠️ requiere publicación | Consola de soporte multi-negocio con casos (tickets) y rol de soporte de solo lectura, cierre de huecos de seguridad en roles, apps Android e iOS con Capacitor (**Cafexis** para clientes y **Cafexis Equipo** para el personal) | `0011` |

| Componente | Estado |
|---|---|
| Frontend web · Panel del negocio (administrador / supervisor) | ✅ Ver [`src/`](src/) |
| Frontend web · Vista barista/vendedor | ✅ Tablero de pedidos con recetas |
| Frontend web · Catálogo, pedido e historial del cliente final | ✅ |
| Consola de soporte y casos | ✅ Rutas `/soporte` (equipo) y `/ayuda` (negocios) |
| Base de datos (Supabase) | ✅ Migraciones `0001`–`0012`, ver [`supabase/`](supabase/) |
| Gestión de usuarios y roles (invitaciones) | ✅ Construido; hay que volver a desplegar la Edge Function `invite-user` |
| Despliegue web | ✅ Configurado para Vercel ([`vercel.json`](vercel.json)) |
| Backend / API propia | ✅ No hace falta (Supabase + RLS + funciones SQL + Edge Functions la reemplazan) |
| Suscripciones y período de prueba | ✅ Funciona sin terceros; el cobro de la suscripción es manual (el supervisor técnico la activa) |
| Pagos en línea (Wompi) | ⚠️ Código listo; falta cuenta de comercio aprobada y llaves de producción |
| Facturación electrónica DIAN (Factus) | ⚠️ Código listo; falta habilitación ante la DIAN, resolución de numeración y contrato con el proveedor |
| Apps Android / iOS | ⚠️ Proyectos nativos creados en [`mobile/`](mobile/); falta ícono definitivo, cuentas de desarrollador y publicación en tiendas |

## Pasos fuera de la programación (pagos y DIAN)

> **Nota importante:** las integraciones de pagos y de facturación
> electrónica ya están programadas, pero **no pueden funcionar en producción
> hasta completar trámites legales y comerciales** que no dependen del
> código. Son esos trámites los que entregan las APIs, llaves y
> complementos que el sistema necesita. Mientras tanto, las funciones
> responden con un mensaje claro ("Falta configurar…"), el pedido queda
> guardado como "Pendiente de pago" y el resto de la plataforma sigue
> operando normalmente.

### Decisión previa: quién cobra y quién factura

Hoy el código usa **una sola cuenta de Wompi y una sola cuenta de Factus
para toda la plataforma**. Antes de iniciar los trámites hay que definir, con
asesoría contable y legal, uno de estos dos modelos:

- **Cada negocio con sus propias cuentas** (recomendado para facturar): la
  factura electrónica la emite legalmente el negocio que vende, con su NIT y
  su resolución. Requiere un ajuste pequeño de programación: guardar las
  credenciales por negocio en lugar de una sola global.
- **Cafexis como agregador de pagos**: Cafexis recibe el dinero y luego lo
  transfiere a cada negocio. Implica obligaciones adicionales (contratos con
  cada negocio, conciliación, manejo de dinero de terceros y facturación de
  comisiones).

### Pasarela de pagos (Wompi)

1. Tener **RUT** vigente y, si es persona jurídica, **certificado de
   existencia y representación legal** de la Cámara de Comercio reciente.
2. **Cuenta bancaria** a nombre del mismo titular, con su certificación
   bancaria.
3. Registrar el comercio en Wompi y **superar la validación de identidad
   (KYC)** con esos documentos.
4. Publicar en la web los **términos y condiciones de venta** y la
   **política de tratamiento de datos personales** (Ley 1581 de 2012).
5. Con la cuenta aprobada, obtener las llaves de **producción** (privada y
   de eventos), configurarlas como secretos (`WOMPI_PRIVATE_KEY`,
   `WOMPI_EVENTS_SECRET`, `WOMPI_API_BASE`) y registrar la URL del webhook en
   el panel de Wompi. Detalle técnico en
   [`supabase/README.md`](supabase/README.md), sección "Fase 6".
6. Hacer pagos de prueba en sandbox y luego uno real de bajo valor antes de
   abrirlo a los clientes.

### Facturación electrónica DIAN (Factus)

Por cada negocio que vaya a emitir facturas (ver la decisión previa):

1. **RUT actualizado** con la responsabilidad de facturador electrónico.
2. **Contrato con un proveedor tecnológico** autorizado por la DIAN (Factus
   es la referencia del código; se puede cambiar por otro autorizado).
3. **Habilitación como facturador electrónico** en el portal de la DIAN,
   seleccionando a ese proveedor, y aprobación del **set de pruebas**.
4. **Resolución de numeración de facturación** (prefijo y rango
   autorizados) solicitada a la DIAN y registrada en el proveedor.
5. **Certificado de firma digital** (normalmente lo gestiona el proveedor
   tecnológico).
6. Obtener el token de la API del proveedor, configurarlo como secreto
   (`FACTUS_API_TOKEN`, `FACTUS_API_BASE`) y emitir una factura de prueba en
   el ambiente de habilitación antes de pasar a producción.

### Publicación de las apps móviles

No es un trámite legal, pero también ocurre fuera del código: cuenta de
**Google Play Console** (pago único), **Apple Developer Program** (pago
anual), política de privacidad publicada, ícono definitivo en 1024×1024 y
confirmación de los identificadores `co.cafexis.clientes` /
`co.cafexis.equipo` antes de la primera publicación. Detalle en
[`mobile/README.md`](mobile/README.md).

## Estructura del repositorio

```
Cafexis/
  Documentos/     Documento de alcance, manual de marca, guías de diseño UI,
                  presentación del sistema y logotipos
  src/            Código de la aplicación web (React + Vite + TypeScript)
  public/         Assets estáticos servidos tal cual (favicon, etc.)
  supabase/       Migraciones SQL y Edge Functions (invitaciones, pagos,
                  webhook de Wompi y facturación DIAN)
  mobile/         Proyectos nativos Android/iOS de las apps (Capacitor)
  scripts/        Script de compilación de las apps móviles
```

El código del frontend vive directamente en la raíz del repositorio (no en una
subcarpeta separada). Para correrlo y ver el detalle de su arquitectura (modelo
de datos, capa de servicios, componentes, cómo conectar el futuro backend), ve
a [`README_FrontEnd.md`](README_FrontEnd.md).

Para la base de datos —qué contiene, cómo aplicarla en un proyecto de
Supabase y qué necesitas entregar para conectarla— ve a
[`supabase/README.md`](supabase/README.md).

Para compilar y publicar las apps Android e iOS, ve a
[`mobile/README.md`](mobile/README.md).

## Identidad de marca

Basada en `Documentos/Cafexis_Manual_de_Marca_V2_1.docx` y
`Documentos/Cafexis_Design_System_UI_Guidelines_V1.docx` (ediciones de trabajo;
el logotipo definitivo aún está en validación):

- **Colores:** naranja tueste `#D85A30`, teal tecnológico `#1D9E75`, crema
  cálido `#F1EFE8`, carbón `#2C2C2A`.
- **Tipografía:** Poppins (títulos) + Manrope (cuerpo).
- **Tono:** amigable y cercano (tutea al usuario), educativo, cafetero y
  profesional — nunca frío ni excesivamente técnico.

## Próximos pasos

**Técnicos (configuración, sin programar):**

1. Aplicar en Supabase las migraciones `0011` (soporte y seguridad) y
   `0012` (integraciones).
2. Desplegar las Edge Functions: volver a desplegar `invite-user`
   (obligatorio después de la `0011`) y desplegar `create-payment-link`,
   `generate-invoice` y `wompi-webhook`.
3. Agregar `co.cafexis.clientes://auth-callback` en las Redirect URLs de
   Supabase Auth para el login con Google de la app de clientes.

**Legales y comerciales (fuera de la programación):**

4. Decidir el modelo de cobro y facturación (cuentas por negocio o Cafexis
   como agregador); ver
   [Pasos fuera de la programación](#pasos-fuera-de-la-programación-pagos-y-dian).
5. Abrir y aprobar la cuenta de comercio en Wompi y configurar sus llaves.
6. Habilitar la facturación electrónica ante la DIAN con el proveedor
   tecnológico y configurar su token.
7. Crear las cuentas de Google Play y Apple Developer y publicar las apps.
