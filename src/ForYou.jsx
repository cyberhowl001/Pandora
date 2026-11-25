import { useAuth } from "./AuthContext";
import VibesFeed from "./VibesFeed";
import { vibesQueries } from "./vibesQueries";

// Videos from other people, most engaging first
export default function ForYou(props) {
  const { currentUser } = useAuth();
  return <VibesFeed {...props} load={vibesQueries.forYou(currentUser.id)} loadKey="foryou" empty="Nothing here yet. Check back soon." />;
}
