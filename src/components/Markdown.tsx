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
    const parts: Array<
      | { type: "text"; value: string }
      | { type: "link"; label: string; href: string }
      | { type: "bold"; value: string }
    > = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      if (match[1] && match[2]) {
        parts.push({ type: "link", label: match[1], href: match[2] });
      } else if (match[3]) {
        parts.push({ type: "bold", value: match[3] });
      } else if (match[4]) {
        parts.push({ type: "bold", value: match[4] });
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: "text", value: text.slice(lastIndex) });
    }
    return parts.map((part, index) => {
      if (part.type === "text") {
        return <span key={index}>{part.value}</span>;
      }
      if (part.type === "bold") {
        return <strong key={index}>{part.value}</strong>;
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
