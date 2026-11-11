import {
  Bank,
  Book,
  Bus,
  Car,
  Category,
  Chart,
  Clock,
  Danger,
  DocumentText,
  Headphone,
  Home,
  Location,
  Map as MapIcon,
  Notification,
  People,
  Personalcard,
  Profile2user,
  ProfileCircle,
  Radar,
  Receipt,
  Routing,
  SearchNormal,
  Mobile,
  Setting,
  Brush,
  Teacher,
  Hierarchy,
  type Icon,
} from "iconsax-react-v2";
import { cn } from "@/shared/lib/cn";

export const icons = {
  home: Home,
  building: Bank,
  document: DocumentText,
  grid: Category,
  live: Radar,
  history: Clock,
  settings: Setting,
  platform: Mobile,
  branding: Brush,
  support: Headphone,
  chart: Chart,
  subscription: Receipt,
  driver: Personalcard,
  vehicle: Bus,
  car: Car,
  attendant: Profile2user,
  people: People,
  student: Teacher,
  university: Book,
  route: Routing,
  map: MapIcon,
  location: Location,
  incident: Danger,
  bell: Notification,
  search: SearchNormal,
  branch: Hierarchy,
  profile: ProfileCircle,
} satisfies Record<string, Icon>;

export type IconName = keyof typeof icons;

export function NavIcon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const Component = icons[name];

  return (
    <Component
      variant="Linear"
      color="currentColor"
      size={20}
      className={className}
      aria-hidden
    />
  );
}

export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className={cn("size-2.5 shrink-0", className)}
    >
      <path
        d="M2.2 3.6 5 6.4 7.8 3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
