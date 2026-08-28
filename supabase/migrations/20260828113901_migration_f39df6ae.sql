-- Drop old constraint and recreate with ON DELETE CASCADE
ALTER TABLE public.coach_rates
DROP CONSTRAINT IF EXISTS coach_rates_coach_id_fkey;

ALTER TABLE public.coach_rates
ADD CONSTRAINT coach_rates_coach_id_fkey
FOREIGN KEY (coach_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Verify the change
SELECT 
  constraint_name,
  delete_rule
FROM information_schema.referential_constraints
WHERE constraint_name = 'coach_rates_coach_id_fkey';