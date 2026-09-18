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

El frontend web (panel del negocio, rol administrador/dueño) ya está
conectado a una base de datos real en Supabase: autenticación, negocios,
usuarios, inventario, productos y recetas, pedidos, compras, proveedores,
trazabilidad y reportes se leen y escriben directamente en Postgres, con
seguridad por negocio (Row Level Security) activada.

| Componente | Estado |
|---|---|
| Frontend web · Panel del negocio | ✅ En desarrollo, ver [`src/`](src/) |
| Frontend web · Vista barista/vendedor | ⬜ Pendiente |
| Frontend web · Catálogo y checkout del cliente final | ⬜ Pendiente |
| Base de datos (Supabase) | ✅ Esquema aplicado, ver [`supabase/`](supabase/) |
| Conexión frontend ↔ Supabase | ✅ Autenticación y datos ya conectados |
| Gestión de usuarios y roles (invitaciones) | ✅ Construido, falta desplegar la Edge Function |
| Backend / API propia | ⬜ No hace falta por ahora (Supabase + RLS la reemplaza) |
| Apps Android / iOS | ⬜ Pendiente |
| Facturación electrónica (DIAN) | ⬜ Pendiente |

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
3. Vistas para los roles barista/vendedor y cliente final.
4. Aplicaciones Android e iOS.
5. Integración con un proveedor de facturación electrónica autorizado por la
   DIAN.
