# kidtbot

A kid-friendly web UI for a **MidTBot** ESP32 pen plotter (Grbl_ESP32 firmware).
Kids draw on a tablet or scribble a shape, hit one big button, and the plotter
draws it.

Built for a 5- and a 7-year-old, so the rule is: one screen, one button, no
settings a child can break. Everything a parent needs is behind the ⚙️ gear.

---

## Running it

```bash
npm install
npm start
```

Then open **http://localhost:3000**, or from a tablet on the same Wi-Fi,
`http://<your-pc-ip>:3000`.

The server must run on a machine that can reach the plotter on your LAN.

---

## Testing without the plotter

The gcode is replayed through a simulator that draws what the pen *would* put
on the paper. This catches mirrored axes, wrong scaling, off-paper moves and
stuck-pen bugs with no hardware at all.

```bash
npm run preview -- --all        # render every preset to out/*.png
npm run preview -- smiley       # just one
```

Each run writes `out/<name>.png` (the picture) and `out/<name>.gcode` (the
commands). In the picture:

| | |
|---|---|
| **black** | pen down — ink on paper |
| **blue dashed** | pen up — travel moves |
| **red** | pen down during a rapid — a dragged line, always a bug |
| **green cross** | machine origin (0,0) |
| **grey box** | the configured plot area |

The same thing is available over HTTP while the server runs:

```bash
curl -X POST localhost:3000/api/preview -H 'Content-Type: application/json' \
     -d '{"strokes":[[{"x":0,"y":0},{"x":1,"y":1}]]}' -o preview.png
```

Add `?format=json` to get stats, warnings and the raw gcode instead of a PNG.

---

## Watching it draw

Point a camera at the plotter so a run can be checked without standing over it.

**Easiest: a spare phone.** Install an IP-camera app — on Android,
*IP Webcam* works well — start the server in the app, and note the still-image
URL it shows, usually:

```
http://<phone-ip>:8080/shot.jpg
```

Put that in the ⚙️ settings under **Camera snapshot URL**, or set `cameraUrl`
in `config.json`. Then:

```bash
npm run watch                        # one frame -> out/cam-<ts>.jpg
npm run watch -- --every 10 --for 120   # a frame every 10s for 2 minutes
```

The server also proxies it at `/api/camera/snapshot`, so the browser can show
a live view without cross-origin problems.

---

## Plotting from the command line

```bash
npm run plot -- smiley        # send a preset to the plotter
npm run plot -- --dry smiley  # preview only, nothing is sent
npm run plot -- --json my-strokes.json
```

---

## Settings

All live in `config.json` and are editable from the ⚙️ gear in the UI.

| key | what it does |
|---|---|
| `esp32Ip` | the plotter's address on your network |
| `plotWidth` / `plotHeight` | drawable area in mm; drawings are scaled to fit with a 5% margin |
| `penDownCmd` / `penUpCmd` | servo commands, e.g. `M3 S90` / `M5` |
| `drawSpeed` / `moveSpeed` | mm/min while drawing / travelling |
| `cmdDelayMs` | pause between commands — flow control, see below |
| `penLiftDelay` | ms to let the servo finish moving |
| `penLiftZ` | lift height in mm. **0 = servo only.** Only set this if your machine really has a Z axis |
| `simplifyEps` | smoothing tolerance, normalized units. `0.004` ≈ 0.24mm. `0` disables |
| `cameraUrl` | still-image URL of the camera watching the plotter |

### About `simplifyEps`

A touchscreen emits a point per frame, so three seconds of scribbling is ~180
points per stroke — far finer than the pen can draw, and every point costs a
full `cmdDelayMs` round trip. Simplification removes points that don't change
the shape.

Measured on a synthetic 6-stroke, 1080-point scribble:

| `simplifyEps` | tolerance | points | total time |
|---|---|---|---|
| `0` (off) | — | 1080 | **6.9 min** |
| `0.002` | 0.12mm | 105 | 1.2 min |
| `0.004` *(default)* | 0.24mm | 62 | **1.0 min** |
| `0.008` | 0.48mm | 45 | 0.9 min |

The rendered result is visually identical at `0.004`.

### About `cmdDelayMs`

Commands go one at a time over HTTP with a fixed pause. At the current
settings that pause is roughly **30× longer than the machine's actual motion**,
so job time is dominated by the delay, not by drawing. Lowering it speeds
everything up until the plotter's buffer starts dropping commands — the real
fix is to read Grbl's `ok` responses and keep the planner buffer full, which
isn't implemented yet.

---

## Layout

```
server.js            Express server, job queue, SSE progress
lib/gcode.js         strokes -> gcode (pure, testable)
lib/simulate.js      gcode -> picture of the result
lib/png.js           minimal PNG encoder, no native deps
tools/preview.js     render presets without hardware
tools/watch.js       grab camera frames
tools/plot.js        plot from the command line
public/              the kids' UI
out/                 generated previews and snapshots (gitignored)
```

## Hardware notes

Grbl_ESP32 with the ESP3D web UI. Commands are sent as
`GET /command?commandText=<line>`.

Default AP is SSID `GRBL_ESP` / password `12345678` at `192.168.0.1`. To put it
on your home Wi-Fi:

```
$Sta/SSID=<your-ssid>
$Sta/Password=<your-password>
$Radio/Mode=STA
```

It then picks up an address from your router — find it there, and put it in
`esp32Ip`.
