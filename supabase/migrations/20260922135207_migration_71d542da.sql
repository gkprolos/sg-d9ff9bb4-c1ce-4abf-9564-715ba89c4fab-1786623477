-- Add delivery_address field to store_orders table
ALTER TABLE public.store_orders 
ADD COLUMN IF NOT EXISTS delivery_address text;

COMMENT ON COLUMN public.store_orders.delivery_address IS 'Naslov dostave - vpiše starš ob naročilu';