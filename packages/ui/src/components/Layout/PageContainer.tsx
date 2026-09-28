import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  narrow?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  narrow = false,
  className = '',
  style,
  id,
}) => {
  return (
    <div
      id={id}
      style={style}
      className={`vyasa-page-container ${narrow ? 'vyasa-page-container--narrow' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
