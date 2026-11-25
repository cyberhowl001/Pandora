import VibesFeed from "./VibesFeed";
import { vibesQueries } from "./vibesQueries";

// Newest videos from everyone, no ranking
export default function Recents(props) {
  return <VibesFeed {...props} load={vibesQueries.recents} loadKey="recents" empty="No videos yet. Tap + to post one." />;
}
