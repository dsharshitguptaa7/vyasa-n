import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  narrow?: boolean;
  fluid?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  narrow = false,
  fluid = false,
  className = '',
  style,
  id,
}) => {
  const classes = [
    'vyasa-page-container',
    narrow ? 'vyasa-page-container--narrow' : '',
    fluid ? 'vyasa-page-container--fluid' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div id={id} style={style} className={classes}>
      {children}
    </div>
  );
};
