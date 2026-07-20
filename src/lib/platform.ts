export type Platform =
  | "LinkedIn Learning"
  | "Coursera"
  | "Coursera PLUS"
  | "MasterClass";

export function platformClasses(p: string) {
  switch (p) {
    case "LinkedIn Learning":
      return "bg-platform-linkedin text-white";
    case "Coursera PLUS":
      return "bg-platform-coursera-plus text-white";
    case "Coursera":
      return "bg-platform-coursera text-white";
    case "MasterClass":
      return "bg-platform-masterclass text-white";
    default:
      return "bg-muted text-foreground";
  }
}

export function platformShort(p: string) {
  switch (p) {
    case "LinkedIn Learning":
      return "LinkedIn Learning";
    case "Coursera PLUS":
      return "Coursera PLUS";
    case "Coursera":
      return "Coursera";
    case "MasterClass":
      return "MasterClass";
    default:
      return p;
  }
}

export function formatDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}