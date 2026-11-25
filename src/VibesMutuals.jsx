import { useFollows } from "./FollowContext";
import VibesFeed from "./VibesFeed";
import { vibesQueries } from "./vibesQueries";

// Videos from people you follow who follow you back (named VibesMutuals because Mutuals.jsx is the followers page)
export default function VibesMutuals(props) {
  const { mutuals } = useFollows();
  return (
    <VibesFeed
      {...props}
      load={vibesQueries.mutuals(mutuals)} loadKey={`mutuals:${mutuals.join(",")}`}
      empty="No videos from your mutuals right now."
    />
  );
}
