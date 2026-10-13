import { createClient } from "@supabase/supabase-js";
import { authConfiguration } from "./config";

export const supabase = authConfiguration.configured
  ? createClient(authConfiguration.projectUrl, authConfiguration.publicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "social-media-studio-auth",
      },
    })
  : null;
