import { usePosts } from "./PostsContext";

// #hashtags open the topic page; http(s) links open in a new tab
const TOKEN = /(#[\p{L}\p{N}_]+|https?:\/\/[^\s<]+)/gu;

export function RichPostText({ text, className = "" }) {
  const { openTopic } = usePosts();
  if (!text) return null;
  const parts = text.split(TOKEN); // captured tokens land on the odd positions
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((s, i) => {
        if (i % 2 === 0) return s;
        if (s.startsWith("#")) {
          return (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); openTopic(s.slice(1)); }}
              className="text-violet-500 font-semibold hover:underline"
            >
              {s}
            </button>
          );
        }
        const clean = s.replace(/[.,!?)\]]+$/, "");
        const tail = s.slice(clean.length);
        return (
          <span key={i}>
            <a
              href={clean} target="_blank" rel="noopener noreferrer nofollow"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-500 underline underline-offset-2"
            >
              {clean}
            </a>
            {tail}
          </span>
        );
      })}
    </p>
  );
}
