'use client';

import React from 'react';
import { ThemedPage } from './themed-page';

/**
 * Client wrapper component for ThemedPage
 * Allows server components to use ThemedPage by wrapping content
 */
interface ThemedPageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ThemedPageWrapper({ children, className }: ThemedPageWrapperProps) {
  return <ThemedPage className={className}>{children}</ThemedPage>;
}

