// Subtitle synchronisation against the audio track lived here: it pulled a few
// windows of PCM out of the media with an ffmpeg sidecar, correlated them
// against the subtitle cue timings and reported an offset. Android cannot spawn
// bundled executables, so the whole path was unreachable.
//
// What survives is the OpenSubtitles movie hash, which is pure arithmetic over
// the first and last 64 KiB of the file and is what identifies a release when
// searching for subtitles. The player still syncs subtitles -- see
// use-reference-sync.ts, which times one subtitle against another and needs no
// decoder at all.
pub mod moviehash;
