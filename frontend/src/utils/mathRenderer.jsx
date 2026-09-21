import React from 'react';
import katex from 'katex';

/**
 * Common HTML entities and special characters mapping for mathematical notation.
 */
const SPECIAL_CHAR_MAP = {
  '&times;': '×',
  '&#215;': '×',
  '&plusmn;': '±',
  '&#177;': '±',
  '&le;': '≤',
  '&#8804;': '≤',
  '&ge;': '≥',
  '&#8805;': '≥',
  '&ne;': '≠',
  '&#8800;': '≠',
  '&approx;': '≈',
  '&#8776;': '≈',
  '&infin;': '∞',
  '&#8734;': '∞',
  '&radic;': '√',
  '&#8730;': '√',
  '&sum;': '∑',
  '&#8721;': '∑',
  '&prod;': '∏',
  '&#8719;': '∏',
  '&int;': '∫',
  '&#8747;': '∫',
  '&pi;': 'π',
  '&#960;': 'π',
  '&alpha;': 'α',
  '&beta;': 'β',
  '&gamma;': 'γ',
  '&delta;': 'δ',
  '&theta;': 'θ',
  '&lambda;': 'λ',
  '&mu;': 'μ',
  '&sigma;': 'σ',
  '&omega;': 'ω',
  '&Delta;': 'Δ',
  '&Omega;': 'Ω',
  '&rarr;': '→',
  '&larr;': '←',
  '&harr;': '↔',
  '&rArr;': '⇒',
  '&lArr;': '⇐',
  '&hArr;': '⇔',
};

/**
 * Normalizes special character entities in text.
 */
export function normalizeSpecialCharacters(str) {
  if (!str || typeof str !== 'string') return '';
  let result = str;
  for (const [entity, char] of Object.entries(SPECIAL_CHAR_MAP)) {
    if (result.includes(entity)) {
      result = result.split(entity).join(char);
    }
  }
  return result;
}

/**
 * Render a single TeX expression to HTML using KaTeX.
 */
export function renderKatexToString(tex, displayMode = false) {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
    });
  } catch (err) {
    console.warn('KaTeX render error:', err);
    return `<span class="katex-error" title="${err.message}">${tex}</span>`;
  }
}

/**
 * Process a text or HTML string, replacing math delimiters ($$, $, \[, \()
 * with pre-rendered KaTeX HTML.
 */
export function renderMathInHtml(content) {
  if (!content || typeof content !== 'string') return '';

  let processed = normalizeSpecialCharacters(content);

  // 1. Display math $$ ... $$
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    return `<div class="math-display">${renderKatexToString(math, true)}</div>`;
  });

  // 2. Display math \[ ... \]
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    return `<div class="math-display">${renderKatexToString(math, true)}</div>`;
  });

  // 3. Inline math $ ... $ (avoid matching escaped \$ or empty $$)
  processed = processed.replace(/(^|[^\\])\$([^\$\n\r]+?)\$/g, (_, prefix, math) => {
    return `${prefix}<span class="math-inline">${renderKatexToString(math, false)}</span>`;
  });

  // 4. Inline math \( ... \)
  processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
    return `<span class="math-inline">${renderKatexToString(math, false)}</span>`;
  });

  return processed;
}

/**
 * Parses a string and returns an array of React elements, rendering inline and
 * display math with KaTeX, and supporting optional search query highlighting.
 */
export function renderMathNodes(text, query = '') {
  if (!text || typeof text !== 'string') return null;

  const normalized = normalizeSpecialCharacters(text);

  // Split text by math delimiters:
  // Regex matches: $$...$$, \[...\], $...$, \(...\)
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n\r]+?\$|\\\(.+?\\\))/g;
  const parts = normalized.split(mathRegex);

  const queryRegex = query && query.trim()
    ? new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    : null;

  return parts.map((part, index) => {
    if (!part) return null;

    // 1. Display math $$...$$
    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
      const math = part.slice(2, -2);
      return (
        <span
          key={`math-disp-${index}`}
          className="math-display-wrap"
          dangerouslySetInnerHTML={{ __html: renderKatexToString(math, true) }}
        />
      );
    }

    // 2. Display math \[...\]
    if (part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4) {
      const math = part.slice(2, -2);
      return (
        <span
          key={`math-disp-bracket-${index}`}
          className="math-display-wrap"
          dangerouslySetInnerHTML={{ __html: renderKatexToString(math, true) }}
        />
      );
    }

    // 3. Inline math $...$
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      const math = part.slice(1, -1);
      return (
        <span
          key={`math-inline-${index}`}
          className="math-inline-wrap"
          dangerouslySetInnerHTML={{ __html: renderKatexToString(math, false) }}
        />
      );
    }

    // 4. Inline math \(...\)
    if (part.startsWith('\\(') && part.endsWith('\\)') && part.length >= 4) {
      const math = part.slice(2, -2);
      return (
        <span
          key={`math-inline-paren-${index}`}
          className="math-inline-wrap"
          dangerouslySetInnerHTML={{ __html: renderKatexToString(math, false) }}
        />
      );
    }

    // 5. Standalone LaTeX special symbols outside of delimiters (e.g. \times, \pm, \leq, \geq)
    if (/\\(times|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|sigma|theta|omega|pi|sum|prod|sqrt)/.test(part)) {
      // Replace standalone macros with KaTeX rendering or clean unicode
      const macroParts = part.split(/(\\(?:times|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|sigma|theta|omega|pi|sum|prod|sqrt(?:\{[^}]+\})?))/g);
      return (
        <React.Fragment key={`macro-block-${index}`}>
          {macroParts.map((mPart, mIdx) => {
            if (mPart.startsWith('\\')) {
              return (
                <span
                  key={`macro-${mIdx}`}
                  className="math-inline-wrap"
                  dangerouslySetInnerHTML={{ __html: renderKatexToString(mPart, false) }}
                />
              );
            }
            return renderPlainTextSegment(mPart, queryRegex, `macro-txt-${mIdx}`);
          })}
        </React.Fragment>
      );
    }

    // 6. Regular text with optional query highlighting
    return renderPlainTextSegment(part, queryRegex, `txt-${index}`);
  });
}

function renderPlainTextSegment(text, queryRegex, baseKey) {
  if (!text) return null;
  if (!queryRegex) return text;

  const subparts = text.split(queryRegex);
  return subparts.map((sub, sIdx) => {
    if (queryRegex.test(sub)) {
      return (
        <mark key={`${baseKey}-mark-${sIdx}`} className="ocr-search-highlight">
          {sub}
        </mark>
      );
    }
    return sub;
  });
}

/**
 * Drop-in React component to render any text containing math formulas and special characters.
 */
export default function MathText({ text, query = '', className = '', style = {} }) {
  if (!text) return null;
  return (
    <span className={`math-text-container ${className}`} style={style}>
      {renderMathNodes(text, query)}
    </span>
  );
}
