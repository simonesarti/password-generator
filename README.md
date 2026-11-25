# Password Generator

A fast, private password generator that runs entirely in the browser. It's a static site with no build step and no dependencies, so it's ready for GitHub Pages.

## Features

The options follow what Bitwarden, 1Password and LastPass offer.

**Password**
- Length 5–128 (slider or typed)
- Uppercase, lowercase, numbers, symbols
- Avoid ambiguous characters (`0 O 1 l I |`)
- Minimum numbers and minimum symbols
- Custom symbol set, for sites that only accept certain symbols
- Characters to never use

**Passphrase** (EFF Long Wordlist, 7,776 words)
- 3–20 words
- Separator: hyphen, space, period, comma, underscore, none, random numbers, or random numbers and symbols
- Capitalize words
- Include a number

**PIN**: 4–12 digits

**Also**
- Strength meter with entropy in bits and an estimated crack time
- Numbers and symbols are colour-coded so similar-looking characters are easy to tell apart
- One-click copy, plus a list of values copied this session (kept in memory only)
- Light and dark themes, responsive layout, keyboard-accessible tabs and toggles
- Your settings are remembered in `localStorage`. Generated values are never stored.

## Security

- Randomness comes from `crypto.getRandomValues` (Web Crypto CSPRNG). Rejection sampling removes modulo bias.
- Every enabled character type is guaranteed to appear at least once, and the characters are then shuffled with Fisher–Yates.
- Entropy is calculated from how the value was generated (pool size, word count), not from how it looks.
- A strict Content Security Policy is set: only same-origin scripts and styles, and no network connections.
- No analytics, cookies, fonts, CDNs or other third-party requests.

## Run locally

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

The generator logic (`assets/js/generator.js`) has no DOM dependencies and is tested with Node's built-in test runner (Node 18+):

```sh
node --test tests/*.test.js
```

## Deploy to GitHub Pages

```sh
git init
git add .
git commit -m "Password generator"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then, in the repository on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, select `main` and `/ (root)`, and click **Save**. The site will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

The empty `.nojekyll` file tells GitHub Pages to serve the files as they are, without running Jekyll.

## Project structure

```
index.html               page markup
favicon.svg
assets/css/style.css     styles (light/dark themes)
assets/js/theme.js       applies the saved theme before first paint
assets/js/wordlist.js    EFF Long Wordlist
assets/js/generator.js   generation, entropy and strength logic (pure, testable)
assets/js/app.js         UI wiring
tests/                   Node unit tests for generator.js
```

## Credits

The passphrase word list is the [EFF Long Wordlist](https://www.eff.org/dice) by the Electronic Frontier Foundation, licensed under [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/).
