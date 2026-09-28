import React from 'react';

export interface NavItemConfig {
  id: string;
  label: string;
  href?: string;
  badge?: string;
}

export interface NavigationProps {
  items: NavItemConfig[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  items,
  activeId,
  onSelect,
  className = '',
}) => {
  return (
    <nav className={`vyasa-nav ${className}`} aria-label="Ecosystem navigation">
      <ul className="vyasa-nav-list">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`vyasa-nav-link ${isActive ? 'vyasa-nav-link--active' : ''}`}
                onClick={() => onSelect?.(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="vyasa-badge vyasa-badge--sm vyasa-badge--gold">
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
