import { useAuth } from "./AuthContext";
import VibesFeed from "./VibesFeed";
import { vibesQueries } from "./vibesQueries";

// Videos from other people, most engaging first
export default function ForYou({ muted, onMute }) {
  const { currentUser } = useAuth();
  return (
    <VibesFeed
      load={vibesQueries.forYou(currentUser.id)} loadKey="foryou" muted={muted} onMute={onMute}
      empty="Nothing here yet. Check back soon."
    />
  );
}
