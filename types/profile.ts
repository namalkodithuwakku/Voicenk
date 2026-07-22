export type VoiceCategory = "male" | "female" | "neutral";
export type ProfileVisibility = "visible" | "invisible";

export type Profile = {
  id: string;
  display_name: string;
  voicenk_id: string;
  preferred_language: string;
  preferred_voice: string;
  voice_category: VoiceCategory;
  profile_visibility: ProfileVisibility;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};
