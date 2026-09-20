import React from 'react';

/**
 * Lightweight, dependency-free Markdown renderer for evaluation reports.
 * Renders headings, markdown tables, code blocks, lists, and formatted text
 * without requiring external heavy markdown packages.
 */
export default function MarkdownReportRenderer({ content }) {
  if (!content) {
    return <p style={{ color: '#64748b' }}>No detailed evaluation markdown available.</p>;
  }

  // Parse lines into structured blocks
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Markdown Table detection
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: 'table', lines: tableLines });
      continue;
    }

    // 2. Headings
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.replace(/^#\s+/, '') });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '') });
    } else if (line.startsWith('#### ')) {
      blocks.push({ type: 'h4', text: line.replace(/^####\s+/, '') });
    }
    // 3. Bullet points
    else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items: listItems });
      continue;
    }
    // 4. Numbered list
    else if (/^\d+\.\s+/.test(line.trim())) {
      const numItems = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        numItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items: numItems });
      continue;
    }
    // 5. Horizontal rule
    else if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
    }
    // 6. Regular paragraph (if not empty)
    else if (line.trim().length > 0) {
      blocks.push({ type: 'p', text: line.trim() });
    }

    i++;
  }

  // Inline formatting helper: **bold**, `code`, *italic*
  const formatInline = (text) => {
    if (!text) return null;

    // Split by markdown delimiters
    const tokens = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Code span `...`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        tokens.push(<code key={key++} className="inline-code">{codeMatch[1]}</code>);
        remaining = remaining.substring(codeMatch[0].length);
        continue;
      }

      // Bold **...**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        tokens.push(<strong key={key++}>{boldMatch[1]}</strong>);
        remaining = remaining.substring(boldMatch[0].length);
        continue;
      }

      // Italic *...*
      const italicMatch = remaining.match(/^\*([^*]+)\*/);
      if (italicMatch) {
        tokens.push(<em key={key++}>{italicMatch[1]}</em>);
        remaining = remaining.substring(italicMatch[0].length);
        continue;
      }

      // Plain text up to next special char
      const nextSpecial = remaining.search(/[`*]/);
      if (nextSpecial === -1) {
        tokens.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        // Stray character
        tokens.push(remaining[0]);
        remaining = remaining.substring(1);
      } else {
        tokens.push(remaining.substring(0, nextSpecial));
        remaining = remaining.substring(nextSpecial);
      }
    }

    return tokens;
  };

  const renderTable = (tableLines, blockIdx) => {
    if (tableLines.length < 2) return null;

    const parseRow = (rowLine) => {
      return rowLine
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
    };

    const headerCells = parseRow(tableLines[0]);
    // tableLines[1] is separator e.g. |---|---:|
    const bodyRows = tableLines.slice(2).map(parseRow);

    return (
      <div key={blockIdx} className="report-markdown-table-wrap">
        <table className="report-markdown-table">
          <thead>
            <tr>
              {headerCells.map((h, idx) => (
                <th key={idx}>{formatInline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx}>{formatInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="report-markdown-container">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return <h2 key={idx} className="md-heading-1">{formatInline(block.text)}</h2>;
          case 'h2':
            return <h3 key={idx} className="md-heading-2">{formatInline(block.text)}</h3>;
          case 'h3':
            return <h4 key={idx} className="md-heading-3">{formatInline(block.text)}</h4>;
          case 'h4':
            return <h5 key={idx} className="md-heading-4">{formatInline(block.text)}</h5>;
          case 'table':
            return renderTable(block.lines, idx);
          case 'ul':
            return (
              <ul key={idx} className="md-list">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{formatInline(item)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="md-ordered-list">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{formatInline(item)}</li>
                ))}
              </ol>
            );
          case 'hr':
            return <hr key={idx} className="md-divider" />;
          case 'p':
          default:
            return <p key={idx} className="md-paragraph">{formatInline(block.text)}</p>;
        }
      })}
    </div>
  );
}
