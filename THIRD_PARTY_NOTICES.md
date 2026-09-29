# Licenses and third-party notices

## Viora

Viora is free software: you can redistribute it and/or modify it under the terms of the [GNU General Public License, version 3](LICENSE), as published by the Free Software Foundation. It is distributed in the hope that it will be useful, but **without any warranty**; without even the implied warranty of merchantability or fitness for a particular purpose. See the license for details.

Viora is a modified version of **[Nuvio Mobile](https://github.com/NuvioMedia/NuvioMobile)**, licensed under the GNU General Public License v3.0. The corresponding source code of every Viora release is published with that release ([details](docs/SOURCE.md)).

## Adapted work

| Project | License | What Viora uses |
| --- | --- | --- |
| [Nuvio Mobile](https://github.com/NuvioMedia/NuvioMobile) | GPL-3.0 | The application Viora is built from |
| [Harbor](https://github.com/harborstremio/harbor) | MIT | Discover (daily rows, taste model, discovery queue, Voyages, filter rails), the awards, studio, collection and Voyage datasets, the animated streaming-service hero, casting behaviour (receiver discovery, Cast v2 and DLNA control, device capability table) |
| [MaxStream](https://github.com/chila254/maxstream) | MIT (see below) | The stream extractor behind VIP Viora's source discovery (Android), from commit `7a6a503` |
| [BitChord](https://github.com/kushagrasinghx/BitChord) | GPL-3.0 | The design of the account control in the top corner |
| [react-native-jelly-tabs](https://github.com/felipe-software/react-native-jelly-tabs) | MIT | The jelly navigation animation, ported to Android |
| [Silero VAD](https://github.com/snakers4/silero-vad) | MIT | Voice-activity model used for subtitle synchronisation |
| [LAPSE](https://github.com/Schwponaco-org/lapse) | GPL-3.0 | The subtitle-to-dialogue alignment method, re-implemented in Kotlin |
| [ffsubsync](https://github.com/smacke/ffsubsync) | MIT | The edge-aware overlap score of its split aligner |

**MaxStream.** The MaxStream README states that the project is released under the MIT License. The repository does not include a separate LICENSE file, so no copyright line is available; the MIT License text is reproduced below with attribution to its author.

## Libraries

| Library | License |
| --- | --- |
| Kotlin, kotlinx.coroutines, kotlinx.serialization, atomicfu | Apache-2.0 |
| Compose Multiplatform, AndroidX (Activity, Lifecycle, Navigation 3, Work, Core) | Apache-2.0 |
| [AndroidX Media3 / ExoPlayer](https://github.com/androidx/media) | Apache-2.0 |
| [Ktor](https://github.com/ktorio/ktor) | Apache-2.0 |
| [Coil](https://github.com/coil-kt/coil) | Apache-2.0 |
| [Kermit](https://github.com/touchlab/Kermit) | Apache-2.0 |
| [Haze](https://github.com/chrisbanes/haze) | Apache-2.0 |
| [Reorderable](https://github.com/Calvin-LL/Reorderable) | Apache-2.0 |
| [quickjs-kt](https://github.com/dokar3/quickjs-kt) | Apache-2.0 |
| [ksoup](https://github.com/fleeksoft/ksoup) | MIT |
| [kmpalette](https://github.com/jordond/kmpalette) | MIT |
| [supabase-kt](https://github.com/supabase-community/supabase-kt) | MIT |
| [Sentry Java SDK](https://github.com/getsentry/sentry-java) (included, not enabled in public builds) | MIT |
| [libass-android](https://github.com/peerless2012/libass-android) with [libass](https://github.com/libass/libass) | MIT, ISC |
| mpv-android-lib with [mpv](https://github.com/mpv-player/mpv) and [FFmpeg](https://ffmpeg.org) | mpv and FFmpeg: LGPL-2.1-or-later, with GPL-licensed parts where enabled |

The Apache License 2.0 is available at <https://www.apache.org/licenses/LICENSE-2.0>. The exact versions of every library are listed in `gradle/libs.versions.toml` and the build files inside each release's source archive.

## Data and media

- Award winners and nominees were compiled from Wikipedia award pages, available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- This product uses the TMDB API but is not endorsed or certified by TMDB.
- Test data in the source archive includes *Tears of Steel* (CC BY 3.0, © Blender Foundation | mango.blender.org). It is not part of the app.

## License texts

<details>
<summary><b>Harbor — MIT License</b></summary>

```
MIT License

Copyright (c) 2026 Harbor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

</details>

<details>
<summary><b>MaxStream — MIT License</b></summary>

```
MIT License

MaxStream, by chila254 (https://github.com/chila254/maxstream)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

</details>

<details>
<summary><b>react-native-jelly-tabs — MIT License</b></summary>

```
The MIT License (MIT)

Copyright (c) 2026 Felipe.Software

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

</details>

<details>
<summary><b>Silero VAD — MIT License</b></summary>

```
MIT License

Copyright (c) 2020-present Silero Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

</details>

The licenses of the other MIT, ISC and Apache-2.0 libraries listed above are available in their repositories, linked in the tables.
