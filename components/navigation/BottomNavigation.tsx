import type { AppTab } from "@/types/navigation";
import { GlobeIcon, MessagesIcon, UserIcon } from "@/components/ui/Icons";

type BottomNavigationProps = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
};

const items = [
  { id: "messages" as const, label: "Messages", icon: MessagesIcon },
  { id: "interpreter" as const, label: "Interpreter", icon: GlobeIcon },
  { id: "profile" as const, label: "Me", icon: UserIcon },
];

export function BottomNavigation({
  activeTab,
  onChange,
}: BottomNavigationProps) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-border/80 bg-surface/95 px-4 pt-2 backdrop-blur-xl">
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl transition ${
                isActive
                  ? "bg-accent-soft text-accent-strong"
                  : "text-muted hover:bg-surface-soft"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-extrabold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
