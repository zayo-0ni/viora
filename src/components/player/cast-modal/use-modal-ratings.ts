import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { omdbScores, type OmdbScores } from "@/lib/providers/omdb";
import { useMdblistScores } from "@/lib/providers/mdblist";
import { harborImdbTitle } from "@/lib/providers/viora-imdb";

export function useModalRatings(imdbId: string | null, mediaType: "movie" | "show") {
  const { settings } = useSettings();
  const [scores, setScores] = useState<OmdbScores | null>(null);
  const [harborImdb, setVioraImdb] = useState<string | null>(null);
  const mdblist = useMdblistScores(settings.mdblistKey, imdbId, mediaType);

  useEffect(() => {
    if (!imdbId || !settings.omdbKey) {
      setScores(null);
      return;
    }
    let cancelled = false;
    setScores(null);
    omdbScores(settings.omdbKey, imdbId)
      .then((s) => {
        if (!cancelled) setScores(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imdbId, settings.omdbKey]);

  useEffect(() => {
    if (!imdbId?.startsWith("tt")) {
      setVioraImdb(null);
      return;
    }
    let cancelled = false;
    setVioraImdb(null);
    harborImdbTitle(imdbId)
      .then((r) => {
        if (!cancelled && r != null) setVioraImdb(r.toFixed(1));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imdbId]);

  return { scores, mdblist, harborImdb };
}
