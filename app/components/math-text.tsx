'use client';
import { useEffect, useRef } from 'react';
import { normalizeMath } from '@/lib/math-format';
import renderMathInElement from 'katex/contrib/auto-render';
export function MathText({ text, formula = false, inline = false }: { text: string; formula?: boolean; inline?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current; if (!element) return;
    // Write as text, then render only math delimiters; no HTML/Markdown from the model is trusted.
    element.textContent = formula ? (inline ? `\\(${text}\\)` : `\\[${text}\\]`) : normalizeMath(text);
    renderMathInElement(element, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }, { left: '$', right: '$', display: false }], throwOnError: false, trust: false, strict: 'warn' });
  }, [text, formula, inline]);
  return <span ref={ref} className={`math-text ${formula && !inline ? 'math-formula' : ''}`}>{text}</span>;
}
