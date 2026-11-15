# 🐱 purr

**Gam Lub** is a browser-game hub featuring 18 games and interactive experiences. Browse them as floating orbs in the 3D hub, or use search and the mobile-friendly grid view.

## Play

**Online:** [Open Gam Lub on GitHub Pages](https://anas68755.github.io/purr/). The included GitHub Actions workflow deploys the site when changes are pushed to `main`. To enable it, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

**Locally:** run a static web server from the repository root, then open the address it prints:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. A local server is recommended because the hub and some games load JavaScript modules and other assets.

## Games

| Game | File |
|---|---|
| Truth or Dare | [`games/truda.html`](games/truda.html) |
| Chess Cards | [`games/chard.html`](games/chard.html) |
| Horror game | [`games/horror.html`](games/horror.html) |
| Void Breaker | [`games/voidbreaker.html`](games/voidbreaker.html) |
| Calc Chall | [`games/calc-chall.html`](games/calc-chall.html) |
| Purr Clicker | [`games/purr-clicker.html`](games/purr-clicker.html) |
| Shadow Rise | [`games/notavailable.html`](games/notavailable.html) |
| Clash Kingdoms | [`games/clash.html`](games/clash.html) |
| Catch The Cat | [`games/purch.html`](games/purch.html) |
| Tik Tak Toe | [`games/tiktak.html`](games/tiktak.html) |
| Civilization Evo Sim | [`games/civilization/index.html`](games/civilization/index.html) |
| الساحر الناجي | [`games/survivor-ar.html`](games/survivor-ar.html) |
| CyberHack Sim | [`games/cack.html`](games/cack.html) |
| Russian Roulette | [`games/revolver.html`](games/revolver.html) |
| 2048 | [`games/2048.html`](games/2048.html) |
| Neon Monopoly X | [`games/monopoly.html`](games/monopoly.html) |
| Keyboar | [`games/keyboar.html`](games/keyboar.html) |
| Echo Cartographer | [`games/echo.html`](games/echo.html) |

## Add a game to the hub

1. Add the game under `games/`. A standalone game can be a single HTML file; games with multiple assets can use a folder.
2. Add an entry to the `ORBS` array near the top of the script in `index.html`:

```js
["My Game", "🎲", "Short description", "my-game"],
```

For a game in a subfolder, use a path such as `"my-folder/index"`. The hub resolves game IDs to files under `games/` and picks up the entry for its globe, search, and grid views.

## Notes

- Game progress, high scores, and saves are stored in the browser's `localStorage` on that device.
- Some experiences load libraries or fonts from external CDNs, so those features require an internet connection.
- There is no license file in the repository yet. Add one if you want to specify reuse terms.
