import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/profile";

export type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};
