# 🐱 purr

**Gam Lub**: a hub of 18 small browser games. Every game is a single HTML file, with no build step and no backend.

The hub (`index.html`) shows the games on a draggable 3D globe, with a search box and a grid view for phones.

## Play

**Online (GitHub Pages):** after pushing, go to *Settings → Pages → Source: GitHub Actions*. The included workflow deploys the site on every push to `main` at `https://<your-username>.github.io/purr/`.

**Locally:** serve the folder with any static server, for example

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly with `file://` also works for most games, but a local server is more reliable.

## Games

| Game | File |
|---|---|
| Truth or Dare | `games/truda.html` |
| Chess Cards | `games/chard.html` |
| Horror game | `games/horror.html` |
| Void Breaker | `games/voidbreaker.html` |
| Calc Chall | `games/calc-chall.html` |
| Purr Clicker | `games/purr-clicker.html` |
| Shadow Rise | `games/survivor.html` |
| Clash Kingdoms | `games/clash.html` |
| Catch The Cat | `games/purch.html` |
| Tik Tak Toe | `games/tiktak.html` |
| Bat in the Shadows | `games/bat-in-the-shadows.html` |
| Arcane Survivor 2.0 (الساحر الناجي) | `games/survivor-ar.html` |
| CyberHack Sim | `games/cack.html` |
| Russian Roulette | `games/revolver.html` |
| 2048 | `games/2048.html` |
| Neon Monopoly X | `games/monopoly.html` |
| Keyboar | `games/keyboar.html` |
| Echo Cartographer | `games/echo.html` |

## Adding a game

1. Put `my-game.html` in `games/`.
2. Add one line to the `GAMES` list near the top of the script in `index.html`:

```js
["My Game", "🎲", "short description", "my-game"],
```

That's all; the globe, search and grid pick it up automatically.

## Notes

- Progress (high scores, saves) is stored in each browser's `localStorage`, so it stays on the device.
- Some games load libraries from a CDN at runtime (three.js from jsDelivr or cdnjs, Tailwind from `cdn.tailwindcss.com`, Google Fonts), so they need an internet connection.
- No license file is included yet. Add one (for example MIT) if you want others to reuse the code.
