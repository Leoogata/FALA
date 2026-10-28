import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-[var(--line)] rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}
