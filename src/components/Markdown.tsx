type MarkdownProps = {
  content: string;
  caret?: boolean;
  caretClassName?: string;
};

export default function Markdown({
  content,
  caret = false,
  caretClassName = "typing-caret",
}: MarkdownProps) {
  const blocks = content.split("\n");
  const lastRenderableIndex = (() => {
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      const trimmed = blocks[i].trim();
      if (!trimmed) {
        continue;
      }
      if (/^<!--\s*more\s*-->$/i.test(trimmed)) {
        continue;
      }
      if (trimmed.startsWith("```")) {
        continue;
      }
      return i;
    }
    return -1;
  })();
  const renderInline = (text: string) => {
    const parts: Array<string | { label: string; href: string }> = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push({ label: match[1], href: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts.map((part, index) => {
      if (typeof part === "string") {
        return <span key={index}>{part}</span>;
      }
      return (
        <a key={index} href={part.href} target="_blank" rel="noreferrer">
          {part.label}
        </a>
      );
    });
  };

  return (
    <div className="markdown">
      {blocks.map((line, index) => {
        const trimmed = line.trim();
        if (/^<!--\s*more\s*-->$/i.test(trimmed)) {
          return null;
        }
        if (!trimmed) {
          return <div key={index} className="markdown-spacer" />;
        }
        if (trimmed.startsWith("```")) {
          return null;
        }
        if (trimmed.startsWith("###")) {
          return (
            <h3 key={index} className="markdown-h3">
              {trimmed.replace(/^###\s*/, "")}
              {caret && index === lastRenderableIndex ? (
                <span className={caretClassName} aria-hidden="true" />
              ) : null}
            </h3>
          );
        }
        if (trimmed.startsWith("##")) {
          return (
            <h2 key={index} className="markdown-h2">
              {trimmed.replace(/^##\s*/, "")}
              {caret && index === lastRenderableIndex ? (
                <span className={caretClassName} aria-hidden="true" />
              ) : null}
            </h2>
          );
        }
        if (trimmed.startsWith("#")) {
          return (
            <h1 key={index} className="markdown-h1">
              {trimmed.replace(/^#\s*/, "")}
              {caret && index === lastRenderableIndex ? (
                <span className={caretClassName} aria-hidden="true" />
              ) : null}
            </h1>
          );
        }
        if (trimmed.startsWith("-")) {
          return (
            <p key={index} className="markdown-li">
              <span>•</span>
              {renderInline(trimmed.replace(/^-+\s*/, ""))}
              {caret && index === lastRenderableIndex ? (
                <span className={caretClassName} aria-hidden="true" />
              ) : null}
            </p>
          );
        }
        return (
          <p key={index} className="markdown-p">
            {renderInline(trimmed)}
            {caret && index === lastRenderableIndex ? (
              <span className={caretClassName} aria-hidden="true" />
            ) : null}
          </p>
        );
      })}
    </div>
  );
}
