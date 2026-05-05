ALTER TABLE public.tb_agent_voice_profiles
  ADD COLUMN IF NOT EXISTS speed numeric NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tb_agent_voice_profiles_speed_check'
  ) THEN
    ALTER TABLE public.tb_agent_voice_profiles
      ADD CONSTRAINT tb_agent_voice_profiles_speed_check
      CHECK (speed IS NULL OR (speed >= 0.7 AND speed <= 1.2));
  END IF;
END $$;

COMMENT ON COLUMN public.tb_agent_voice_profiles.speed IS
  'Velocidade da fala para ElevenLabs: 1 = normal; entre 0.7 e 1.2.';
