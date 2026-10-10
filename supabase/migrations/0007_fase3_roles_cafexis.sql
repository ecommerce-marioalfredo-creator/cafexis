-- =============================================================================
-- Cafexis · Fase 3 — Roles y personal
--
-- El supervisor técnico ya podía LEER cualquier negocio (0002_rls_cafexis.sql
-- le agregó "or auth_is_supervisor_cafexis()" a cada policy de select), pero
-- no podía ESCRIBIR en un negocio que no fuera el suyo: las policies de
-- insert/update/delete de las tablas de negocio solo comprobaban
-- "business_id = auth_business_id_cafexis()", sin esa cláusula.
--
-- Esta migración las recrea añadiendo el mismo "or auth_is_supervisor_cafexis()"
-- que ya tienen las de select, para que el selector de negocio del supervisor
-- (Fase 3 del frontend) pueda operar de verdad y no solo mirar.
--
-- Las tablas hijas sin business_id propio (product_recipe_items_cafexis,
-- order_items_cafexis, purchase_order_lines_cafexis) ya cubren al supervisor
-- porque su policy "for all" usa un exists(...) contra la tabla padre que ya
-- incluye auth_is_supervisor_cafexis() — no requieren cambio.
-- =============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'inventory_items_cafexis',
    'products_cafexis',
    'coffee_lots_cafexis',
    'orders_cafexis',
    'purchase_orders_cafexis',
    'custom_reports_cafexis',
    'business_suppliers_cafexis'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on %I;', t || '_insert', t);
    execute format(
      'create policy %I on %I for insert with check (business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis());',
      t || '_insert', t
    );

    execute format('drop policy if exists %I on %I;', t || '_update', t);
    execute format(
      'create policy %I on %I for update using (business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis());',
      t || '_update', t
    );

    execute format('drop policy if exists %I on %I;', t || '_delete', t);
    execute format(
      'create policy %I on %I for delete using (business_id = auth_business_id_cafexis() or auth_is_supervisor_cafexis());',
      t || '_delete', t
    );
  end loop;
end $$;
