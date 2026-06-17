import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { tokens, breadcrumbStyle, breadcrumbSepStyle } from '../ui/theme';

export interface Crumb {
  label: string;
  /** When present the crumb is a Link; the current (last) crumb omits it and renders as text. */
  to?: string;
}

/**
 * Year › Course › Period trail. Crumbs with a `to` are clickable Links; the
 * trailing crumb (the current location) is plain text. Renders nothing for an
 * empty trail so callers can pass a still-loading [].
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      style={{ ...breadcrumbStyle(), padding: `${tokens.space(1)}px ${tokens.space(3)}px` }}
    >
      {items.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          {i > 0 && (
            <span aria-hidden="true" style={breadcrumbSepStyle()}>
              ›
            </span>
          )}
          {c.to ? (
            <Link to={c.to} style={{ color: tokens.color.teal, textDecoration: 'none' }}>
              {c.label}
            </Link>
          ) : (
            <span style={{ color: tokens.color.text }}>{c.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
