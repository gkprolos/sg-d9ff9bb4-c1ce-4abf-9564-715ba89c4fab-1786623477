-- Drop all versions of get_store_top_items to fix duplicate function error
DROP FUNCTION IF EXISTS public.get_store_top_items();
DROP FUNCTION IF EXISTS public.get_store_top_items(integer);
DROP FUNCTION IF EXISTS public.get_store_top_items(limit_count integer);

-- Create single correct version with proper column name (unit_price not price_per_unit)
CREATE OR REPLACE FUNCTION public.get_store_top_items(limit_count integer DEFAULT 10)
RETURNS TABLE (
  item_number text,
  item_name text,
  total_ordered bigint,
  total_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    soi.item_number,
    soi.item_name,
    SUM(soi.quantity)::bigint AS total_ordered,
    SUM(soi.subtotal) AS total_revenue
  FROM store_order_items soi
  JOIN store_orders so ON so.id = soi.order_id
  WHERE so.status != 'cancelled'
  GROUP BY soi.item_number, soi.item_name
  ORDER BY total_ordered DESC
  LIMIT limit_count;
END;
$$;