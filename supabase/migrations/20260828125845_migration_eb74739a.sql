-- Add DELETE policy for admin users on players table
CREATE POLICY "players_delete_admin" ON public.players
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );