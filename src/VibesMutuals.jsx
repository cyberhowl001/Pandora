import { useFollows } from "./FollowContext";
import VibesFeed from "./VibesFeed";
import { vibesQueries } from "./vibesQueries";

// Videos from people you follow who follow you back.
// (Named VibesMutuals because Mutuals.jsx is already the followers page.)
export default function VibesMutuals({ muted, onMute }) {
  const { mutuals } = useFollows();
  return (
    <VibesFeed
      load={vibesQueries.mutuals(mutuals)} loadKey={`mutuals:${mutuals.join(",")}`} muted={muted} onMute={onMute}
      empty="No videos from your mutuals right now."
    />
  );
}
