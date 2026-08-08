CREATE TABLE public.player_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.campaign_members(id) ON DELETE CASCADE,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'sheet_access_request',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_notifications TO authenticated;
GRANT ALL ON public.player_notifications TO service_role;

ALTER TABLE public.player_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player reads own notifications"
  ON public.player_notifications FOR SELECT TO authenticated
  USING (auth.uid() = player_user_id OR auth.uid() = from_user_id);

CREATE POLICY "player updates own notifications"
  ON public.player_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = player_user_id)
  WITH CHECK (auth.uid() = player_user_id);

CREATE POLICY "dm sends notifications for own campaign"
  ON public.player_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id AND campaign_id IS NOT NULL AND public.is_campaign_dm(campaign_id));

CREATE POLICY "player or sender deletes notifications"
  ON public.player_notifications FOR DELETE TO authenticated
  USING (auth.uid() = player_user_id OR auth.uid() = from_user_id);

CREATE TRIGGER trg_player_notifications_updated_at
  BEFORE UPDATE ON public.player_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_player_notifications_player ON public.player_notifications (player_user_id, is_read);

ALTER TABLE public.campaign_members REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_members;