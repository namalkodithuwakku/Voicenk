import { BrandMark } from "@/components/ui/BrandMark";
import type { AppTab } from "@/types/navigation";

const pageTitles: Record<AppTab, string> = {
  messages: "Messages",
  interpreter: "Interpreter",
  profile: "Me",
};

type AppHeaderProps = {
  activeTab: AppTab;
};

export function AppHeader({ activeTab }: AppHeaderProps) {
  return (
    <header className="safe-top z-20 shrink-0 border-b border-border/80 bg-surface/95 px-4 pb-2.5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <BrandMark compact />
        <div className="rounded-full bg-surface-soft px-2.5 py-1 text-[10px] font-bold text-muted">
          {pageTitles[activeTab]}
        </div>
      </div>
    </header>
  );
}
