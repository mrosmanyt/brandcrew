-- CINEM Pro — Supabase public schema: profiles + RLS
-- Apply AFTER `npx prisma migrate deploy` against this project's Postgres.
-- Project: viejyuiiyjmhxfhyuvpa (ap-south-1)

-- ---------------------------------------------------------------------------
-- profiles (id = auth.users.id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'en',
  preferred_mode TEXT NOT NULL DEFAULT 'desk',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profiles_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Prisma app tables — users read own rows; writes via service role / API only
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "InviteRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "MobileCompanionPair" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UserProviderKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ImageGenAsyncResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "SiteConfig" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_select_own" ON "User";
CREATE POLICY "user_select_own"
  ON "User" FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "invite_redemption_select_own" ON "InviteRedemption";
CREATE POLICY "invite_redemption_select_own"
  ON "InviteRedemption" FOR SELECT
  TO authenticated
  USING (auth.uid()::text = "inviterId" OR auth.uid()::text = "inviteeId");

DROP POLICY IF EXISTS "companion_pair_select_own" ON "MobileCompanionPair";
CREATE POLICY "companion_pair_select_own"
  ON "MobileCompanionPair" FOR SELECT
  TO authenticated
  USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "byok_select_own" ON "UserProviderKey";
CREATE POLICY "byok_select_own"
  ON "UserProviderKey" FOR SELECT
  TO authenticated
  USING (auth.uid()::text = "userId");

-- Image async jobs: readable by authenticated (job ids are opaque uuids)
DROP POLICY IF EXISTS "image_gen_select_authenticated" ON "ImageGenAsyncResult";
CREATE POLICY "image_gen_select_authenticated"
  ON "ImageGenAsyncResult" FOR SELECT
  TO authenticated
  USING (true);

-- Founding counter: no direct client access (server / service role only)
DROP POLICY IF EXISTS "site_config_deny_all" ON "SiteConfig";
CREATE POLICY "site_config_deny_all"
  ON "SiteConfig" FOR ALL
  TO authenticated
  USING (false);

-- BYOK ciphertext is never client-writable
REVOKE INSERT, UPDATE, DELETE ON "UserProviderKey" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "SiteConfig" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "InviteRedemption" FROM authenticated;
