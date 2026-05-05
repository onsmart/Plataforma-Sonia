BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_agent_voice_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES public.tb_agents(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'elevenlabs',
    voice_id text NOT NULL,
    voice_name text NULL,
    model_id text NULL,
    stability numeric NULL,
    similarity_boost numeric NULL,
    style numeric NULL,
    speed numeric NULL,
    use_speaker_boost boolean NOT NULL DEFAULT true,
    preview_text text NULL,
    enabled boolean NOT NULL DEFAULT true,
    calls_enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tb_agent_voice_profiles_provider_check CHECK (provider IN ('elevenlabs')),
    CONSTRAINT tb_agent_voice_profiles_stability_check CHECK (stability IS NULL OR (stability >= 0 AND stability <= 1)),
    CONSTRAINT tb_agent_voice_profiles_similarity_boost_check CHECK (similarity_boost IS NULL OR (similarity_boost >= 0 AND similarity_boost <= 1)),
    CONSTRAINT tb_agent_voice_profiles_style_check CHECK (style IS NULL OR (style >= 0 AND style <= 1)),
    CONSTRAINT tb_agent_voice_profiles_speed_check CHECK (speed IS NULL OR (speed >= 0.7 AND speed <= 1.2))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tb_agent_voice_profiles_agent_id
  ON public.tb_agent_voice_profiles (agent_id);

CREATE INDEX IF NOT EXISTS idx_tb_agent_voice_profiles_provider
  ON public.tb_agent_voice_profiles (provider);

CREATE OR REPLACE FUNCTION public.update_tb_agent_voice_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_tb_agent_voice_profiles_updated_at ON public.tb_agent_voice_profiles;
CREATE TRIGGER trigger_update_tb_agent_voice_profiles_updated_at
  BEFORE UPDATE ON public.tb_agent_voice_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tb_agent_voice_profiles_updated_at();

ALTER TABLE public.tb_agent_voice_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tb_agent_voice_profiles'
      AND policyname = 'tb_agent_voice_profiles_company_access'
  ) THEN
    CREATE POLICY tb_agent_voice_profiles_company_access
      ON public.tb_agent_voice_profiles
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.tb_agents a
          JOIN public.tb_company_users cu
            ON cu.companies_id = a.companies_id
          WHERE a.id = tb_agent_voice_profiles.agent_id
            AND cu.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tb_agents a
          JOIN public.tb_company_users cu
            ON cu.companies_id = a.companies_id
          WHERE a.id = tb_agent_voice_profiles.agent_id
            AND cu.user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tb_agent_voice_profiles TO authenticated;
GRANT ALL ON public.tb_agent_voice_profiles TO service_role;

COMMENT ON TABLE public.tb_agent_voice_profiles IS
  'Perfil de voz por agente para TTS/STT e futuras experiencias realtime.';

COMMENT ON COLUMN public.tb_agent_voice_profiles.preview_text IS
  'Texto padrao usado pela UI ao gerar previews temporarios da voz do agente.';

COMMENT ON COLUMN public.tb_agent_voice_profiles.speed IS
  'Velocidade natural da fala enviada para a ElevenLabs. 1.0 e normal; acima disso acelera a fala.';

COMMENT ON COLUMN public.tb_agent_voice_profiles.calls_enabled IS
  'Controla se o agente pode atender chamadas de voz recebidas via WhatsApp Calling.';

COMMIT;
