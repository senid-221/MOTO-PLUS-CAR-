/**
 * The icon set used by the header, the phone tab bar, the sign-in steps and the
 * service list.
 *
 * These are real Lucide glyphs — the same open-source icon library the reference
 * product renders in its own markup (`viewBox 0 0 24 24`, stroke `currentColor`,
 * stroke-width 2, round caps) — imported from the `lucide-react` package rather
 * than drawn or generated here. They inherit `currentColor`, so the navy and
 * lime tokens decide how they look and an active tab turns icon and label
 * together. Nothing is fetched at runtime: an icon is markup, which keeps the
 * first paint independent of the hosted API.
 */
import {
  ArrowRight,
  Bike,
  CalendarClock,
  Check,
  GraduationCap,
  HardHat,
  House,
  Info,
  KeyRound,
  Languages,
  LayoutGrid,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Newspaper,
  Package,
  PhoneCall,
  RefreshCw,
  ShoppingBasket,
  Store,
  User,
  UserPlus,
  Users,
} from 'lucide-react';

export const HomeIcon = House;
export const ServicesIcon = LayoutGrid;
export const NewsIcon = Newspaper;
export const SafetyIcon = GraduationCap;
export const AboutIcon = Info;
export const ContactIcon = Mail;
export const AccountIcon = User;
export const GlobeIcon = Languages;
export const CheckIcon = Check;
export const LoginIcon = LogIn;
export const RegisterIcon = UserPlus;
export const RetryIcon = RefreshCw;
export const LogoutIcon = LogOut;
export const NextIcon = ArrowRight;
/** Spins while a call is in flight; the class carries the animation. */
export const SpinnerIcon = LoaderCircle;

export const RideIcon = Bike;
export const CargoIcon = Package;
export const ShoppingIcon = ShoppingBasket;
export const MonthlyIcon = CalendarClock;
export const MarketIcon = Store;
export const CooperativeIcon = Users;

/* The three Safety Academy reminders. */
export const HelmetIcon = HardHat;
export const NightRideIcon = Moon;

/* The two steps of sign-in that have no service tile of their own. */
export const PhoneStepIcon = PhoneCall;
export const CodeStepIcon = KeyRound;

/** The prop shape every icon here accepts, for typed lists of tiles. */
export type AppIcon = typeof HomeIcon;
