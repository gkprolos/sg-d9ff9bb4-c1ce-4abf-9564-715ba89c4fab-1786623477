-- Create store_suppliers table
CREATE TABLE IF NOT EXISTS public.store_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Add supplier_id to store_items
ALTER TABLE public.store_items 
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.store_suppliers(id);

-- Enable RLS
ALTER TABLE public.store_suppliers ENABLE ROW LEVEL SECURITY;

-- RLS policies for store_suppliers (admin/coach access)
CREATE POLICY "store_suppliers_admin_all" ON public.store_suppliers
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'coach')
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_suppliers_active ON public.store_suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_store_suppliers_name ON public.store_suppliers(name);
CREATE INDEX IF NOT EXISTS idx_store_items_supplier ON public.store_items(supplier_id);

COMMENT ON TABLE public.store_suppliers IS 'Dobavitelji klubske opreme';
COMMENT ON COLUMN public.store_items.supplier_id IS 'Dobavitelj artikla';