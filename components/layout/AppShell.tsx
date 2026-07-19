"use client";

import { useState } from "react";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { MessagesScreen } from "@/features/messages/components/MessagesScreen";
import { InterpreterScreen } from "@/features/interpreter/components/InterpreterScreen";
import { ProfileScreen } from "@/features/profile/components/ProfileScreen";
import { AuthModal } from "@/features/auth/components/AuthModal";
import { ProfileSetupModal } from "@/features/auth/components/ProfileSetupModal";
import type { AppTab } from "@/types/navigation";

export function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>("interpreter");
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-surface shadow-[var(--shadow-soft)]">
      <AppHeader activeTab={activeTab} />

      <section className="min-h-0 flex-1 overflow-hidden px-4 pb-20">
        {activeTab === "messages" && (
          <MessagesScreen onSignIn={() => setAuthOpen(true)} />
        )}
        {activeTab === "interpreter" && <InterpreterScreen />}
        {activeTab === "profile" && (
          <ProfileScreen onSignIn={() => setAuthOpen(true)} />
        )}
      </section>

      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <ProfileSetupModal />
    </main>
  );
}
