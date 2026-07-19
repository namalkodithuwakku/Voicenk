import type { AppTab } from "@/types/navigation";
import { MessagesIcon, GlobeIcon, UserIcon } from "@/components/ui/Icons";

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
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md shrink-0 border-t border-border/80 bg-surface/98 px-3 pt-1.5 backdrop-blur-xl">
      <div className="grid grid-cols-3 gap-1.5">
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
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl transition ${
                isActive
                  ? "bg-accent-soft text-accent-strong"
                  : "text-muted"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="text-[10px] font-extrabold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
