import VibesFeed from "./VibesFeed";
import { vibesQueries } from "./vibesQueries";

// Newest videos from everyone, no ranking
export default function Recents({ muted, onMute }) {
  return (
    <VibesFeed
      load={vibesQueries.recents} loadKey="recents" muted={muted} onMute={onMute}
      empty="No videos yet. Post one from the + button on the feed."
    />
  );
}
