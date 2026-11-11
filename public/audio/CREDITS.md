# Vibrato guitar recordings

These instruments are bundled with the app and require no runtime CDN or network connection.

| Preset | Recording source | Author / project | License |
| --- | --- | --- | --- |
| Steel acoustic | 2017 Martin HD28 Vintage Series, Discord SFZ GM instrument 026 | Jeff Learman | CC0 1.0 |
| Nylon acoustic | Spanish classical guitar, version 2019-06-18 | Roberto / FreePats | CC0 1.0 |
| Warm electric | Electric Guitar FSBS clean, bridge pickup, version 2026-08-07 | FreePats | CC0 1.0 |

Upstream notices are preserved in `licenses/steel-notice.txt`, `licenses/nylon-notice.txt`, and `licenses/clean-notice.txt`. The dedication text is in `licenses/CC0-1.0.txt`.

The original recordings were converted to mono 44.1 kHz MP3, with a maximum eight-second tail and a half-second fade at the end. The electric bank includes alternate takes and soft attacks. Vibrato applies pitch transposition, per-string damping, strum timing, filtering, and room ambience during playback.

`sources.json` pins the upstream revisions; `manifest.json` records each original URL, pitch, articulation, and the bundled file's SHA-256 hash. Regenerate with `python3 scripts/prepare-samples.py` from the repository root (Python 3, ffmpeg, and network access required).

Sources:

- https://github.com/sfzinstruments/Discord-SFZ-GM-Bank
- https://github.com/freepats/spanish-classical-guitar
- https://github.com/freepats/electric-guitar-FSBS-clean
- https://creativecommons.org/publicdomain/zero/1.0/
