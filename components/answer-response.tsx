'use client';

import React from 'react';
import { useTheme } from '../lib/theme/theme-context';
import { MarkdownRenderer } from './markdown-renderer';

interface AnswerResponseProps {
  children: React.ReactNode;
  textColor?: string;
}

/**
 * AnswerResponse component - Displays answer portion of verification messages with custom styling
 * 
 * Features:
 * - Indented (1.5rem left margin)
 * - Italic text
 * - Lighter background color
 * - Subtle border
 * - Theme-aware styling
 * - Markdown rendering support
 */
export function AnswerResponse({ children, textColor }: AnswerResponseProps) {
  const { theme, chrome } = useTheme();
  
  return (
    <div 
      style={{
        marginLeft: '1.5rem',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        backgroundColor: chrome.input || (theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
        fontStyle: 'italic',
        display: 'inline-block',
        opacity: 0.9,
        border: `1px solid ${chrome.border || (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')}`,
      }}
    >
      {typeof children === 'string' ? (
        <MarkdownRenderer content={`*${children}*`} textColor={textColor} />
      ) : (
        children
      )}
    </div>
  );
}



