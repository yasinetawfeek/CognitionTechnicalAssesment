import { logoutAction } from "./actions";
import { NotificationBell } from "./notification-bell";
import { Icon } from "@/kernel/ui/icon";

export function Topbar({ user }: { user: { name: string; email: string; roles: string[] } }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/90 px-6 backdrop-blur lg:px-8">
      <div className="text-xs text-muted">
        Signed in as <span className="font-medium text-fg">{user.name}</span>
        {user.roles.length > 0 && <span className="ml-2 rounded-full bg-bg px-2 py-0.5">{user.roles.join(" · ")}</span>}
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <form action={logoutAction}>
          <button type="submit" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-bg hover:text-fg" title={user.email}>
            <Icon name="LogOut" className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
