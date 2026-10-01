export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  isExternal?: boolean;
  requiredRoles?: string[];
  badge?: string;
}

export interface NavigationSection {
  title: string;
  items: NavItem[];
}
