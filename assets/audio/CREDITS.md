# Foley credits

`foley.m4a` is a sprite of short slices from these recordings. All are dedicated to the public
domain under **CC0 1.0** (licences checked on each sound's Freesound page, November 2026).
Attribution is not required; it is given here anyway, with thanks.

| Cue(s) | Recording | Recordist |
|---|---|---|
| key-down, key-up | [Cassette player buttons](https://freesound.org/people/not_yr/sounds/680832/) | not_yr |
| latch, stop, motor | [cassette tape deck start, stop +play, clicks](https://freesound.org/people/kyles/sounds/452905/) | kyles |
| door-open, door-close | [reel to reel tape machine or cassette deck slot open close](https://freesound.org/people/kyles/sounds/635656/) | kyles |
| case-open, case-close | [Cassette box - cassette case](https://freesound.org/people/not_yr/sounds/680834/) | not_yr |
| lift | [Cassette handling](https://freesound.org/people/not_yr/sounds/680835/) | not_yr |
| seat | [handling c cassette](https://freesound.org/people/lartti/sounds/507532/) | lartti |
| insert | [cassette_being_inserted_into_a_deck](https://freesound.org/people/submergent/sounds/826353/) | submergent |
| tick | [Sony Vintage Casette Player Knob Snap](https://freesound.org/people/Joao_Janz/sounds/477685/) | Joao_Janz |
| switch | [Close switch/hatch on tape machine](https://freesound.org/people/hanneswannerberger/sounds/275630/) | hanneswannerberger |
| spinup | [Walkman motor (+ turning on and off)](https://freesound.org/people/robni7/sounds/680721/) | robni7 |
| wind | [CassettePlayer-RWD-FWD-STOP](https://freesound.org/people/kingsrow/sounds/348079/) | kingsrow |

Rebuild: download each sound's preview to `<dir>/<id>.mp3`, convert to 44.1 kHz mono WAV with
`afconvert -f WAVE -d LEI16@44100 -c 1 in.mp3 <dir>/<id>.wav`, then
`python3 tools/make_foley.py <dir> /tmp/foley && afconvert -f m4af -d aac -b 96000 -c 1 /tmp/foley.wav assets/audio/foley.m4a && cp /tmp/foley.json assets/audio/`.

The music on the tapes is not recorded: `assets/music.js` composes and renders it in the browser.
