const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

// Strip trailing punctuation that's almost never meant to be part of the
// URL ("check https://x.com." should link just https://x.com), while still
// allowing a closing ) or ] that balances an opening one earlier in the URL
// (e.g. Wikipedia's .../Example_(disambiguation)).
function trimTrailingPunctuation(url: string): { url: string; trailing: string } {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (".,!?;:'\"".includes(ch)) {
      end--;
      continue;
    }
    if (ch === ")" || ch === "]") {
      const open = ch === ")" ? "(" : "[";
      const opens = (url.slice(0, end).match(new RegExp("\\" + open, "g")) ?? []).length;
      const closes = (url.slice(0, end).match(new RegExp("\\" + ch, "g")) ?? []).length;
      if (closes > opens) {
        end--;
        continue;
      }
    }
    break;
  }
  return { url: url.slice(0, end), trailing: url.slice(end) };
}

/** Renders free text with any http(s) URLs inside it turned into clickable
 *  links, leaving everything else as plain text. Drop-in replacement for
 *  displaying a note/message/description field: `<LinkifyText text={note} />`
 *  instead of `{note}`. */
export default function LinkifyText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const { url, trailing } = trimTrailingPunctuation(match[0]);
    if (!url) continue;
    const index = match.index;
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-700 underline underline-offset-2 hover:text-brand-800 break-all"
      >
        {url}
      </a>
    );
    lastIndex = index + url.length;
    if (trailing) {
      parts.push(trailing);
      lastIndex += trailing.length;
    }
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return className ? <span className={className}>{parts}</span> : <>{parts}</>;
}
