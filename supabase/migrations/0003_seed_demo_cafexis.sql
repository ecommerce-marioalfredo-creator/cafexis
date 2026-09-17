-- =============================================================================
-- Cafexis · Datos de ejemplo del negocio demo ("Mi Cafetería")
-- Equivalente a src/services/mock/data.ts, para probar el sistema con datos
-- reales apenas se conecte el frontend a Supabase.
--
-- Nota: el usuario demo (Laura Gómez, laura@micafeteria.co) NO se crea aquí
-- porque los usuarios viven en auth.users (Supabase Auth). Ver el paso
-- "Crear el usuario demo" en supabase/README.md — una vez creado ese usuario
-- en Supabase Auth, se inserta su fila en app_users_cafexis con el mismo id.
-- =============================================================================

do $$
declare
  v_business_id uuid := '11111111-1111-1111-1111-111111111111';
  v_inv_leche uuid := gen_random_uuid();
  v_inv_cafe_huila uuid := gen_random_uuid();
  v_inv_vasos uuid := gen_random_uuid();
  v_inv_azucar uuid := gen_random_uuid();
  v_inv_vainilla uuid := gen_random_uuid();
  v_inv_leche_avena uuid := gen_random_uuid();
  v_inv_cafe_narino uuid := gen_random_uuid();
  v_inv_tapas uuid := gen_random_uuid();
  v_p_latte uuid := gen_random_uuid();
  v_p_coldbrew uuid := gen_random_uuid();
  v_p_espresso uuid := gen_random_uuid();
  v_p_cappuccino uuid := gen_random_uuid();
  v_p_bolsa_huila uuid := gen_random_uuid();
  v_p_bolsa_narino uuid := gen_random_uuid();
  v_sup_cafe_sur uuid := gen_random_uuid();
  v_sup_lacteos uuid := gen_random_uuid();
  v_sup_empaques uuid := gen_random_uuid();
  v_sup_finca uuid := gen_random_uuid();
begin
  -- Negocio demo
  insert into businesses_cafexis (id, name, type, country, primary_color)
  values (v_business_id, 'Mi Cafetería', 'mixto', 'Colombia', '#D85A30')
  on conflict (id) do nothing;

  -- Inventario
  insert into inventory_items_cafexis (id, business_id, name, unit, quantity, low_stock_threshold) values
    (v_inv_leche, v_business_id, 'Leche entera', 'l', 3, 8),
    (v_inv_cafe_huila, v_business_id, 'Café Huila (molido)', 'kg', 2, 5),
    (v_inv_vasos, v_business_id, 'Vasos 12oz', 'uds', 40, 100),
    (v_inv_azucar, v_business_id, 'Azúcar', 'kg', 12, 5),
    (v_inv_vainilla, v_business_id, 'Jarabe de vainilla', 'l', 4, 2),
    (v_inv_leche_avena, v_business_id, 'Leche de avena', 'l', 0, 4),
    (v_inv_cafe_narino, v_business_id, 'Café Nariño (grano)', 'kg', 18, 6),
    (v_inv_tapas, v_business_id, 'Tapas para vaso', 'uds', 210, 100);

  -- Productos
  insert into products_cafexis (id, business_id, name, category, price) values
    (v_p_latte, v_business_id, 'Latte vainilla', 'Bebidas', 9500),
    (v_p_coldbrew, v_business_id, 'Cold brew', 'Bebidas', 8000),
    (v_p_espresso, v_business_id, 'Espresso doble', 'Bebidas', 6000),
    (v_p_cappuccino, v_business_id, 'Cappuccino', 'Bebidas', 8500),
    (v_p_bolsa_huila, v_business_id, 'Café de origen · Huila (bolsa 500g)', 'Café empacado', 32000),
    (v_p_bolsa_narino, v_business_id, 'Café Nariño (bolsa 340g)', 'Café empacado', 26000);

  -- Recetas
  insert into product_recipe_items_cafexis (product_id, inventory_item_id, quantity, unit) values
    (v_p_latte, v_inv_cafe_huila, 0.02, 'kg'),
    (v_p_latte, v_inv_leche, 0.2, 'l'),
    (v_p_latte, v_inv_vainilla, 0.03, 'l'),
    (v_p_coldbrew, v_inv_cafe_huila, 0.03, 'kg'),
    (v_p_espresso, v_inv_cafe_huila, 0.018, 'kg'),
    (v_p_cappuccino, v_inv_cafe_huila, 0.02, 'kg'),
    (v_p_cappuccino, v_inv_leche, 0.15, 'l');

  -- Lotes de café (trazabilidad)
  insert into coffee_lots_cafexis (business_id, code, variety, process, origin_country, origin_region, origin_farm, story, quantity_kg, harvest_year) values
    (v_business_id, 'HUI-2026-04', 'Caturra', 'lavado', 'Colombia', 'Huila', 'Finca La Esperanza',
      'Cultivado a 1.750 msnm por la familia Perdomo, este lote de Caturra se procesa con lavado tradicional y secado en camas africanas.', 42, 2026),
    (v_business_id, 'NAR-2026-01', 'Castillo', 'honey', 'Colombia', 'Nariño', 'Finca El Mirador',
      'Proceso honey que resalta notas dulces y frutales, cosechado en las laderas del volcán Galeras.', 18, 2026),
    (v_business_id, 'CAU-2025-11', 'Típica', 'natural', 'Colombia', 'Cauca', null, null, 9, 2025);

  -- Proveedores (directorio compartido) + relación con el negocio demo
  insert into suppliers_cafexis (id, nit, name, location) values
    (v_sup_cafe_sur, '900123456-1', 'Distribuidora Café del Sur', 'Neiva, Huila'),
    (v_sup_lacteos, '901987654-2', 'Lácteos La Sabana', 'Bogotá, Cundinamarca'),
    (v_sup_empaques, '900555222-3', 'Empaques y Desechables JR', 'Medellín, Antioquia'),
    (v_sup_finca, '901222333-4', 'Finca El Mirador (venta directa)', 'Nariño')
  on conflict (nit) do nothing;

  insert into supplier_branches_cafexis (supplier_id, branch_name) values
    (v_sup_cafe_sur, 'Neiva'),
    (v_sup_cafe_sur, 'Pitalito');

  insert into business_suppliers_cafexis (business_id, supplier_id) values
    (v_business_id, v_sup_cafe_sur),
    (v_business_id, v_sup_lacteos),
    (v_business_id, v_sup_empaques),
    (v_business_id, v_sup_finca)
  on conflict do nothing;

  -- Pedidos de ejemplo
  insert into orders_cafexis (business_id, code, customer_name, table_or_reference, total, status, payment_method, created_at) values
    (v_business_id, 'A-101', 'Mesa 3', 'Mesa 3', 19000, 'entregado', 'tarjeta', now() - interval '5 hours'),
    (v_business_id, 'A-102', 'Juan Pérez', 'Para llevar', 8000, 'en_preparacion', 'transferencia', now() - interval '1 hour'),
    (v_business_id, 'A-103', 'Mesa 5', 'Mesa 5', 23000, 'pedido', 'efectivo', now() - interval '12 minutes'),
    (v_business_id, 'A-104', 'María Torres', null, 32000, 'entregado', 'billetera_digital', now() - interval '20 hours'),
    (v_business_id, 'A-105', 'Mesa 1', 'Mesa 1', 9500, 'listo', 'tarjeta', now() - interval '30 minutes'),
    (v_business_id, 'A-106', 'Carlos Ibáñez', null, 52000, 'pedido', 'efectivo', now() - interval '6 minutes'),
    (v_business_id, 'A-107', 'Mesa 2', 'Mesa 2', 12000, 'entregado', 'tarjeta', now() - interval '3 hours'),
    (v_business_id, 'A-108', 'Sofía Ramírez', 'Para llevar', 8500, 'en_preparacion', 'transferencia', now() - interval '18 minutes');

  insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
  select o.id, v_p_latte, 'Latte vainilla', 2, 9500 from orders_cafexis o where o.business_id = v_business_id and o.code = 'A-101';
  insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
  select o.id, v_p_coldbrew, 'Cold brew', 1, 8000 from orders_cafexis o where o.business_id = v_business_id and o.code = 'A-102';
  insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
  select o.id, v_p_cappuccino, 'Cappuccino', 2, 8500 from orders_cafexis o where o.business_id = v_business_id and o.code = 'A-103';
  insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
  select o.id, v_p_espresso, 'Espresso doble', 1, 6000 from orders_cafexis o where o.business_id = v_business_id and o.code = 'A-103';
  insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
  select o.id, v_p_bolsa_huila, 'Café de origen · Huila (bolsa 500g)', 1, 32000 from orders_cafexis o where o.business_id = v_business_id and o.code = 'A-104';
  insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
  select o.id, v_p_latte, 'Latte vainilla', 1, 9500 from orders_cafexis o where o.business_id = v_business_id and o.code = 'A-105';
  insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
  select o.id, v_p_bolsa_narino, 'Café Nariño (bolsa 340g)', 2, 26000 from orders_cafexis o where o.business_id = v_business_id and o.code = 'A-106';
  insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
  select o.id, v_p_espresso, 'Espresso doble', 2, 6000 from orders_cafexis o where o.business_id = v_business_id and o.code = 'A-107';
  insert into order_items_cafexis (order_id, product_id, product_name, quantity, unit_price)
  select o.id, v_p_cappuccino, 'Cappuccino', 1, 8500 from orders_cafexis o where o.business_id = v_business_id and o.code = 'A-108';

  -- Órdenes de compra
  insert into purchase_orders_cafexis (business_id, code, supplier_id, origin, reason, status, created_at) values
    (v_business_id, 'OC-2026-014', v_sup_lacteos, 'sugerida_sistema', 'La leche entera está por debajo del umbral mínimo (3 l de 8 l).', 'propuesta', now() - interval '2 hours'),
    (v_business_id, 'OC-2026-013', v_sup_cafe_sur, 'sugerida_sistema', 'Café Huila molido por debajo del umbral mínimo (2 kg de 5 kg).', 'propuesta', now() - interval '6 hours'),
    (v_business_id, 'OC-2026-012', v_sup_empaques, 'manual', null, 'confirmada', now() - interval '2 days');

  insert into purchase_order_lines_cafexis (purchase_order_id, inventory_item_id, quantity, unit)
  select po.id, v_inv_leche, 20, 'l' from purchase_orders_cafexis po where po.business_id = v_business_id and po.code = 'OC-2026-014';
  insert into purchase_order_lines_cafexis (purchase_order_id, inventory_item_id, quantity, unit)
  select po.id, v_inv_cafe_huila, 10, 'kg' from purchase_orders_cafexis po where po.business_id = v_business_id and po.code = 'OC-2026-013';
  insert into purchase_order_lines_cafexis (purchase_order_id, inventory_item_id, quantity, unit)
  select po.id, v_inv_vasos, 300, 'uds' from purchase_orders_cafexis po where po.business_id = v_business_id and po.code = 'OC-2026-012';
end $$;
