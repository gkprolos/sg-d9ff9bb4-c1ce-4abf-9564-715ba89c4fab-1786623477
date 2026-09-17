-- Trigger 2: Auto-create collection periods (1st and 15th of month, 3 months ahead)
CREATE OR REPLACE FUNCTION create_collection_periods()
RETURNS void AS $$
DECLARE
  current_month DATE;
  period_1st DATE;
  period_15th DATE;
  i INTEGER;
BEGIN
  current_month := DATE_TRUNC('month', CURRENT_DATE);
  
  FOR i IN 0..2 LOOP
    period_1st := (current_month + (i || ' months')::INTERVAL)::DATE;
    period_15th := (current_month + (i || ' months')::INTERVAL + INTERVAL '14 days')::DATE;
    
    INSERT INTO store_collection_periods (period_date)
    VALUES (period_1st), (period_15th)
    ON CONFLICT (period_date) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ensure_collection_periods()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_collection_periods();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_collection_periods ON store_orders;
CREATE TRIGGER trigger_ensure_collection_periods
  BEFORE INSERT ON store_orders
  FOR EACH STATEMENT
  EXECUTE FUNCTION ensure_collection_periods();

COMMENT ON FUNCTION create_collection_periods() IS 'Auto-create collection periods for next 3 months (1st and 15th)';

-- Inicializiraj zbirnike za naslednja 3 obdobja
SELECT create_collection_periods();