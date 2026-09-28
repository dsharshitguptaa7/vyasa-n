import React from 'react';

export interface SectionHeadingProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  eyebrow,
  description,
  align = 'left',
  className = '',
}) => {
  return (
    <div
      className={`vyasa-section-heading ${align === 'center' ? 'vyasa-section-heading--center' : ''} ${className}`}
    >
      {eyebrow && <div className="vyasa-section-heading__eyebrow">{eyebrow}</div>}
      <h2 className="vyasa-section-heading__title">{title}</h2>
      {description && <p className="vyasa-section-heading__desc">{description}</p>}
      <div className="vyasa-section-heading__divider" aria-hidden="true" />
    </div>
  );
};
