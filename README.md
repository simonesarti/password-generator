# Password Generator

A fast, private password generator that runs entirely in the browser. It's a static site with no build step and no dependencies, hosted on GitHub Pages.

- **Live site:** [simonesarti.github.io/password-generator](https://simonesarti.github.io/password-generator/)
- **Repository:** [github.com/simonesarti/password-generator](https://github.com/simonesarti/password-generator)

## Features

The options follow what Bitwarden, 1Password and LastPass offer.

**Password**
- Length 8–128 (slider or typed)
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
- Works offline and can be installed as an app (web app manifest + service worker)
- Your settings are remembered in `localStorage`. Generated values are never stored.

## Security

- Randomness comes from `crypto.getRandomValues` (Web Crypto CSPRNG). Rejection sampling removes modulo bias.
- Every enabled character type is guaranteed to appear at least once, and the characters are then shuffled with Fisher–Yates.
- Entropy is calculated from how the value was generated (pool size, word count), not from how it looks.
- A strict Content Security Policy is set: only same-origin scripts, styles, manifest and service worker, and no network connections from the page.
- The service worker only caches the site's own files, network-first, so online visitors always get the latest version.
- No analytics, cookies, fonts, CDNs or other third-party requests.

## Run locally

Clone the repository, then open `index.html` directly or serve the folder:

```sh
git clone git@github.com:simonesarti/password-generator.git
cd password-generator
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

The generator logic (`assets/js/generator.js`) has no DOM dependencies and is tested with Node's built-in test runner (Node 18+):

```sh
node --test tests/*.test.js
```

## Deployment

The site is served by GitHub Pages from the root of the `main` branch, at [simonesarti.github.io/password-generator](https://simonesarti.github.io/password-generator/). Every push to `main` redeploys it automatically, usually within a minute or two.

To set this up again (for example on a fork), go to **Settings → Pages → Build and deployment** in the repository, set **Source** to "Deploy from a branch", select `main` and `/ (root)`, and click **Save**.

The empty `.nojekyll` file tells GitHub Pages to serve the files as they are, without running Jekyll.

## Search engines

`sitemap.xml` lists the site for crawlers. To get it indexed, add `https://simonesarti.github.io/password-generator/` as a **URL-prefix** property in [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters), then submit `https://simonesarti.github.io/password-generator/sitemap.xml`.

There is no `robots.txt`: crawlers only read it from the root of a domain (`simonesarti.github.io/robots.txt`), not from a project subfolder, and without one everything may be crawled.

When `index.html` changes significantly, update `<lastmod>` in `sitemap.xml`. When the list of site files changes, update `PRECACHE` in `sw.js` and bump its `CACHE` version.

## Project structure

```
index.html               page markup, SEO and link-preview tags, structured data
favicon.svg
manifest.webmanifest     web app manifest (installable app)
sw.js                    service worker (offline support)
sitemap.xml              sitemap for search engines
assets/og-image.png      1200×630 link-preview image
assets/icons/            app icons (192, 512, maskable, Apple touch)
assets/css/style.css     styles (light/dark themes)
assets/js/theme.js       applies the saved theme before first paint
assets/js/wordlist.js    EFF Long Wordlist
assets/js/generator.js   generation, entropy and strength logic (pure, testable)
assets/js/app.js         UI wiring
tests/                   Node unit tests for generator.js
```

## Credits

The passphrase word list is the [EFF Long Wordlist](https://www.eff.org/dice) by the Electronic Frontier Foundation, licensed under [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/).
