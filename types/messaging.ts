export type ContactProfile = {
  id: string;
  display_name: string;
  voicenk_id: string;
  preferred_language: string;
  preferred_voice: string;
  voice_category: "male" | "female" | "neutral";
  profile_visibility?: "visible" | "invisible";
  avatar_url: string | null;
};

export type ConversationSummary = {
  id: string;
  contact: ContactProfile;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type VoiceMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  audio_path: string;
  original_transcript: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  translation_status: "required" | "completed" | "not_required" | "failed";
  sender_voice: string;
  created_at: string;
  delivered_at: string | null;
  played_at: string | null;
};

export type ContactRequest = {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  sender?: ContactProfile;
  recipient?: ContactProfile;
};

export type ContactRecord = {
  id: string;
  user_id: string;
  contact_id: string;
  conversation_id: string;
  created_at: string;
  profile: ContactProfile;
};
