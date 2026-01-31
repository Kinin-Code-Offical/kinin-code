"use client";

import { useMemo, useState } from "react";
import Markdown from "@/components/Markdown";

type MarkdownCollapsibleProps = {
  content: string;
  marker?: string;
  moreLabel?: string;
  lessLabel?: string;
  initialExpanded?: boolean;
  buttonClassName?: string;
};

export default function MarkdownCollapsible({
  content,
  marker = "<!--more-->",
  moreLabel = "More",
  lessLabel = "Less",
  initialExpanded = false,
  buttonClassName = "button ghost",
}: MarkdownCollapsibleProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const { intro, rest } = useMemo(() => {
    const parts = content.split(marker);
    const [first, ...tail] = parts;
    return {
      intro: first ?? "",
      rest: tail.length > 0 ? tail.join(marker) : "",
    };
  }, [content, marker]);

  if (!rest || rest.trim().length === 0) {
    return <Markdown content={content} />;
  }

  return (
    <div className="markdown-collapsible">
      <Markdown content={intro.trimEnd()} />
      {expanded && <Markdown content={rest.trimStart()} />}
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setExpanded((current) => !current)}>
        {expanded ? lessLabel : moreLabel}
      </button>
    </div>
  );
}
