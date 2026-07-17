import { Component, Input } from "@angular/core";
import {
  Archive,
  ArrowLeft,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  CircleUserRound,
  Copy,
  Download,
  Ellipsis,
  FileText,
  Flag,
  Home,
  LogIn,
  LucideAngularModule,
  Mail,
  Menu,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Users,
  UserPlus,
  X,
  XCircle
} from "lucide-angular";

export type UiIconName =
  | "archive"
  | "arrow-left"
  | "bell"
  | "building"
  | "calendar"
  | "check"
  | "check-circle"
  | "clock"
  | "copy"
  | "download"
  | "ellipsis"
  | "file-text"
  | "flag"
  | "home"
  | "mail"
  | "log-in"
  | "menu"
  | "message-circle"
  | "package"
  | "pencil"
  | "phone"
  | "play"
  | "plus"
  | "refresh"
  | "search"
  | "settings"
  | "user"
  | "user-plus"
  | "users"
  | "x"
  | "x-circle";

const ICONS = {
  archive: Archive,
  "arrow-left": ArrowLeft,
  bell: Bell,
  building: Building2,
  calendar: Calendar,
  check: Check,
  "check-circle": CheckCircle2,
  clock: Clock3,
  copy: Copy,
  download: Download,
  ellipsis: Ellipsis,
  "file-text": FileText,
  flag: Flag,
  home: Home,
  mail: Mail,
  "log-in": LogIn,
  menu: Menu,
  "message-circle": MessageCircle,
  package: Package,
  pencil: Pencil,
  phone: Phone,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  search: Search,
  settings: Settings,
  user: CircleUserRound,
  "user-plus": UserPlus,
  users: Users,
  x: X,
  "x-circle": XCircle
} as const;

@Component({
  selector: "kaklen-icon",
  standalone: true,
  imports: [LucideAngularModule],
  template: `<lucide-icon [img]="ICONS[name]" [size]="size" [strokeWidth]="strokeWidth" aria-hidden="true" />`
})
export class UiIconComponent {
  @Input({ required: true }) name!: UiIconName;
  @Input() size = 18;
  @Input() strokeWidth = 2;
  readonly ICONS = ICONS;
}
