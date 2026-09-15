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

Esta es una etapa temprana: **solo existe el frontend web**, y únicamente para
el panel del negocio (rol administrador/dueño). Todavía no hay backend ni base
de datos — el frontend funciona con datos de ejemplo a través de una capa de
servicios ya preparada para conectarse a una API real cuando exista.

| Componente | Estado |
|---|---|
| Frontend web · Panel del negocio | ✅ En desarrollo, ver [`frontend/`](frontend/) |
| Frontend web · Vista barista/vendedor | ⬜ Pendiente |
| Frontend web · Catálogo y checkout del cliente final | ⬜ Pendiente |
| Backend / API | ⬜ Pendiente |
| Base de datos | ⬜ Pendiente |
| Apps Android / iOS | ⬜ Pendiente |
| Facturación electrónica (DIAN) | ⬜ Pendiente |

## Estructura del repositorio

```
Cafexis/
  Documentos/     Documento de alcance, manual de marca, guías de diseño UI,
                  presentación del sistema y logotipos
  frontend/       Aplicación web (React + Vite + TypeScript) — panel del negocio
```

Para correr el frontend y ver el detalle de su arquitectura (modelo de datos,
capa de servicios, componentes, cómo conectar el futuro backend), ve a
[`frontend/README.md`](frontend/README.md).

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

1. Definir y construir el backend (API + base de datos) que reemplace la capa
   mock del frontend.
2. Vistas para los roles barista/vendedor y cliente final.
3. Aplicaciones Android e iOS.
4. Integración con un proveedor de facturación electrónica autorizado por la
   DIAN.
