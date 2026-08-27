import { useEffect, useRef } from "react";
import { useProfiles } from "./profiles";
import { resetForProfile as resetTrakt } from "./trakt/session";
import { resetForProfile as resetSimkl } from "./simkl/session";
import { resetForProfile as resetSimklCache } from "./simkl/activities/store";

export function TrackerProfileBridge() {
  const { activeProfile } = useProfiles();
  const id = activeProfile?.id;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    resetSimklCache();
    resetTrakt();
    resetSimkl();
  }, [id]);
  return null;
}
