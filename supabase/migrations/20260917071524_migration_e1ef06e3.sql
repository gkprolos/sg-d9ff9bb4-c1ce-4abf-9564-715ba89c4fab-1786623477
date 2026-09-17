-- Trigger 1: Auto-generate order_number (ORD-YYYY-XXXX)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  new_number TEXT;
BEGIN
  IF NEW.order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  year_part := TO_CHAR(NEW.created_at, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 'ORD-' || year_part || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM store_orders
  WHERE order_number LIKE 'ORD-' || year_part || '-%';
  
  new_number := 'ORD-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
  NEW.order_number := new_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_order_number ON store_orders;
CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON store_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

COMMENT ON FUNCTION generate_order_number() IS 'Auto-generate order number: ORD-2026-0001';