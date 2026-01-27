type MarkdownProps = {
  content: string;
};

export default function Markdown({ content }: MarkdownProps) {
  const blocks = content.split("\n");
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
        if (!trimmed) {
          return <div key={index} className="markdown-spacer" />;
        }
        if (trimmed.startsWith("###")) {
          return (
            <h3 key={index} className="markdown-h3">
              {trimmed.replace(/^###\s*/, "")}
            </h3>
          );
        }
        if (trimmed.startsWith("##")) {
          return (
            <h2 key={index} className="markdown-h2">
              {trimmed.replace(/^##\s*/, "")}
            </h2>
          );
        }
        if (trimmed.startsWith("#")) {
          return (
            <h1 key={index} className="markdown-h1">
              {trimmed.replace(/^#\s*/, "")}
            </h1>
          );
        }
        if (trimmed.startsWith("-")) {
          return (
            <p key={index} className="markdown-li">
              <span>•</span>
              {renderInline(trimmed.replace(/^-+\s*/, ""))}
            </p>
          );
        }
        return (
          <p key={index} className="markdown-p">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
