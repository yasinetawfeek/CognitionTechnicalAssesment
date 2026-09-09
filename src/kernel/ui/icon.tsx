import { icons, type LucideProps } from "lucide-react";

export type IconName = keyof typeof icons;

/** Render a lucide icon by name (manifests store icon names as strings). */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = icons[name as IconName] ?? icons.Box;
  return <Cmp aria-hidden {...props} />;
}
