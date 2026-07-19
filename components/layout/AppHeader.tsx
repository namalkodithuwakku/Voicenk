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
    <header className="safe-top sticky top-0 z-20 border-b border-border/80 bg-surface/90 px-5 pb-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <BrandMark compact />
        <div className="rounded-full bg-surface-soft px-3 py-1.5 text-xs font-bold text-muted">
          {pageTitles[activeTab]}
        </div>
      </div>
    </header>
  );
}
