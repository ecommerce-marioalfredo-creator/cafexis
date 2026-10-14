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

El sistema reconoce distintos roles —supervisor técnico, administrador/dueño,
barista/vendedor y cliente final— cada uno con acceso solo a lo que necesita
para su labor.

El detalle completo del alcance está en
[`Documentos/documento_alcance_proyecto.pdf`](Documentos/documento_alcance_proyecto.pdf).

## Estado actual del proyecto

La plataforma web está construida de punta a punta sobre Supabase (Postgres +
autenticación + Row Level Security por negocio): panel del negocio, vista del
barista y experiencia web del cliente final. Lo que falta son las
integraciones externas (pagos en línea, DIAN, suscripciones) y las apps
móviles.

El desarrollo avanza por fases; las migraciones de cada una están en
[`supabase/migrations/`](supabase/migrations/).

| Fase | Estado | Qué incluye | Migración |
|---|---|---|---|
| 0 · Base y ajustes | ✅ | Autenticación, negocios multi-tenant, usuarios e invitaciones por rol, productos y recetas, "Ventas de hoy" filtrado por fecha | `0001`–`0004` |
| 1 · Datos base | ✅ | Inventario editable (alta, edición, ajuste de existencias y umbrales), datos y logo del negocio, proveedores compartidos por NIT con sucursales, lotes de café ligados a productos empacados | `0005` |
| 2 · Operación diaria | ✅ | Punto de venta (efectivo, tarjeta, transferencia, Nequi), descuento automático de inventario al vender, propuestas de compra automáticas, órdenes manuales, recepción (suma al inventario) y cancelación | `0006` |
| 3 · Roles y personal | ✅ | Rutas y menú según rol, vista del barista con la receta de cada pedido, supervisor técnico operando cualquier negocio desde un selector | `0007`, `0008` |
| 4 · Inteligencia del negocio | ✅ | Historial de movimientos de inventario, los 4 reportes predefinidos con gráficas, generador de reportes personalizados, proyección de reposición en Compras | `0009` |
| 5 · Cliente final (web) | ✅ | Página pública de trazabilidad por lote con QR real, catálogo/menú público por negocio (`/c/:slug`) con QR, pedido con carrito y mesa/referencia, historial y estado de pedidos del cliente | `0010` |
| 6 · Integraciones externas | ⬜ | Pasarela de pagos en línea, facturación electrónica DIAN, suscripciones y período de prueba | — |
| 7 · Plataforma y móvil | ⬜ | Consola del equipo de soporte multi-negocio, apps Android e iOS | — |

| Componente | Estado |
|---|---|
| Frontend web · Panel del negocio (administrador / supervisor) | ✅ Ver [`src/`](src/) |
| Frontend web · Vista barista/vendedor | ✅ Tablero de pedidos con recetas |
| Frontend web · Catálogo, pedido e historial del cliente final | ✅ Sin cobro en línea (se registra el método de pago) |
| Base de datos (Supabase) | ✅ Migraciones `0001`–`0010`, ver [`supabase/`](supabase/) |
| Gestión de usuarios y roles (invitaciones) | ✅ Construido, falta desplegar la Edge Function |
| Despliegue web | ✅ Configurado para Vercel ([`vercel.json`](vercel.json)) |
| Backend / API propia | ⬜ No hace falta por ahora (Supabase + RLS + funciones SQL la reemplazan) |
| Pagos en línea | ⬜ Pendiente (Fase 6) |
| Facturación electrónica (DIAN) | ⬜ Pendiente (Fase 6) |
| Suscripciones | ⬜ Pendiente (Fase 6) |
| Apps Android / iOS | ⬜ Pendiente (Fase 7) |

## Estructura del repositorio

```
Cafexis/
  Documentos/     Documento de alcance, manual de marca, guías de diseño UI,
                  presentación del sistema y logotipos
  src/            Código de la aplicación web (React + Vite + TypeScript)
  public/         Assets estáticos servidos tal cual (favicon, etc.)
  supabase/       Esquema de base de datos (migraciones SQL) para Supabase
```

El código del frontend vive directamente en la raíz del repositorio (no en una
subcarpeta separada). Para correrlo y ver el detalle de su arquitectura (modelo
de datos, capa de servicios, componentes, cómo conectar el futuro backend), ve
a [`README_FrontEnd.md`](README_FrontEnd.md).

Para la base de datos —qué contiene, cómo aplicarla en un proyecto de
Supabase y qué necesitas entregar para conectarla— ve a
[`supabase/README.md`](supabase/README.md).

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

1. Crear el usuario demo en Supabase Auth (`laura@micafeteria.co`) para poder
   probar el login con datos de ejemplo — ver el paso 4 en `supabase/README.md`.
2. Desplegar la Edge Function `invite-user` y configurar su clave secreta
   para que el botón "Invitar usuario" funcione — ver la sección
   "Gestión de usuarios y roles" en `supabase/README.md`.
3. Aplicar en Supabase las migraciones `0009` (reportes) y `0010` (cliente
   final); sin ellas fallan los reportes y las páginas públicas.
4. Fase 6: pasarela de pagos en línea, facturación electrónica con un
   proveedor autorizado por la DIAN y modelo de suscripción con período de
   prueba.
5. Fase 7: consola del equipo de soporte y aplicaciones Android e iOS.
