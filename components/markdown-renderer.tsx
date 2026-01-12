'use client';

import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import { useTheme } from '../lib/theme/theme-context';

interface MarkdownRendererProps {
  content: string;
  textColor?: string;
}

// Type-safe code component props
interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// Configure rehype-sanitize to allow safe markdown elements
const sanitizeConfig = {
  tagNames: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
             'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'hr', 'table', 
             'thead', 'tbody', 'tr', 'th', 'td'],
  attributes: {
    a: ['href', 'title', 'target', 'rel'],
  },
};

export const MarkdownRenderer = memo(function MarkdownRenderer({ 
  content, 
  textColor 
}: MarkdownRendererProps) {
  const { theme, chrome } = useTheme();
  
  // Theme-aware syntax highlighting style
  const syntaxStyle = theme === 'dark' ? oneDark : oneLight;
  
  // Theme-aware colors derived from chrome colors and theme
  // Note: chrome doesn't have link colors, so we use theme-based fallbacks
  const linkColor = theme === 'dark' ? '#60a5fa' : '#2563eb';
  const linkHoverColor = theme === 'dark' ? '#93c5fd' : '#1d4ed8';
  const codeBgColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)';
  const blockquoteBorderColor = chrome.border || (theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)');
  
  // Memoize components to avoid recreating on every render
  const components: Components = useMemo(() => ({
    // Headers
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-bold mt-4 mb-2" style={{ color: textColor }} {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl font-bold mt-3 mb-2" style={{ color: textColor }} {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-lg font-semibold mt-2 mb-1" style={{ color: textColor }} {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="text-base font-semibold mt-2 mb-1" style={{ color: textColor }} {...props}>
        {children}
      </h4>
    ),
    h5: ({ children, ...props }) => (
      <h5 className="text-sm font-semibold mt-1 mb-1" style={{ color: textColor }} {...props}>
        {children}
      </h5>
    ),
    h6: ({ children, ...props }) => (
      <h6 className="text-xs font-semibold mt-1 mb-1" style={{ color: textColor }} {...props}>
        {children}
      </h6>
    ),
    
    // Paragraphs
    p: ({ children, ...props }) => (
      <p className="mb-2" style={{ color: textColor }} {...props}>
        {children}
      </p>
    ),
    
    // Lists
    ul: ({ children, ...props }) => (
      <ul className="list-disc list-outside mb-2 space-y-1 ml-6 pl-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal list-outside mb-2 space-y-1 ml-6 pl-2" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="pl-1" style={{ color: textColor }} {...props}>
        {children}
      </li>
    ),
    
    // Text formatting
    strong: ({ children, ...props }) => (
      <strong className="font-semibold" style={{ color: textColor }} {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em className="italic" style={{ color: textColor }} {...props}>
        {children}
      </em>
    ),
    
    // Code blocks and inline code
    code: ({ inline, className, children, ...props }: CodeProps) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && language) {
        return (
          <SyntaxHighlighter
            style={syntaxStyle}
            language={language}
            PreTag="div"
            customStyle={{
              borderRadius: '0.375rem',
              padding: '1rem',
              margin: '0.5rem 0',
              fontSize: '0.875rem',
            }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        );
      }
      
      return (
        <code
          className="px-1 py-0.5 rounded text-sm font-mono"
          style={{
            backgroundColor: codeBgColor,
            color: textColor,
          }}
          {...props}
        >
          {children}
        </code>
      );
    },
    
    // Links
    a: ({ href, children, ...props }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        style={{
          color: linkColor,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = linkHoverColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = linkColor;
        }}
        {...props}
      >
        {children}
      </a>
    ),
    
    // Blockquotes
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="border-l-4 pl-4 my-2 italic"
        style={{
          borderLeftColor: blockquoteBorderColor,
          color: textColor,
        }}
        {...props}
      >
        {children}
      </blockquote>
    ),
    
    // Horizontal rules
    hr: ({ ...props }) => (
      <hr
        className="my-4"
        style={{
          borderColor: blockquoteBorderColor,
          borderWidth: '1px',
        }}
        {...props}
      />
    ),
    
    // Tables (GFM)
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-2">
        <table className="border-collapse border" style={{ borderColor: blockquoteBorderColor }} {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead style={{ backgroundColor: codeBgColor }} {...props}>
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }) => (
      <tbody {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }) => (
      <tr {...props}>
        {children}
      </tr>
    ),
    th: ({ children, ...props }) => (
      <th
        className="border px-2 py-1 text-left font-semibold"
        style={{
          borderColor: blockquoteBorderColor,
          color: textColor,
        }}
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        className="border px-2 py-1"
        style={{
          borderColor: blockquoteBorderColor,
          color: textColor,
        }}
        {...props}
      >
        {children}
      </td>
    ),
  }), [textColor, syntaxStyle, linkColor, linkHoverColor, codeBgColor, blockquoteBorderColor]);
  
  return (
    <div className="markdown-content" style={{ color: textColor }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeConfig]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

