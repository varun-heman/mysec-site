# mySecurity — marketing site

Static marketing site for **mySecurity**, an AI security system for residential
and commercial property (CCTV, automatic gates, visitor management, asset
monitoring, emergency response).

No build step, no framework, no dependencies. Plain HTML, CSS and ES modules,
deployed to Netlify straight from this repository.

---

## Structure

```
.
├── index.html              Home
├── platform.html           How the product works (architecture + capabilities)
├── residential.html        Homes, apartments, gated communities
├── commercial.html         Offices, retail, warehousing, manufacturing, portfolios
├── pricing.html            Plans, what isn't included, pricing FAQ
├── about.html              Company, beliefs, careers
├── contact.html            Demo request form (Netlify Forms)
├── privacy.html            Privacy & security notice  ⚠ template
├── terms.html              Terms of service           ⚠ template
├── 404.html                Not-found page (uses absolute asset paths)
│
├── assets/
│   ├── css/
│   │   ├── tokens.css      Design tokens only — colour, type, spacing, motion,
│   │   │                   plus the dark and light theme scopes
│   │   ├── base.css        Reset, document defaults, bare element typography
│   │   ├── layout.css      Page shell, dashed frame, sections, grids,
│   │   │                   header/footer, utility classes
│   │   └── components.css  Named components: buttons, cards, feed, accordion,
│   │                       tabs, forms, pricing, prose, diagrams
│   ├── js/
│   │   ├── theme-init.js   Sync <head> script — sets the theme before paint
│   │   ├── main.js         Entry point; imports and wires up the modules
│   │   ├── theme.js        Theme toggle + persistence + OS preference
│   │   ├── nav.js          Sticky header, mobile menu, current-page marking
│   │   ├── reveal.js       IntersectionObserver scroll reveals
│   │   ├── disclosure.js   Accordion and tabs (ARIA patterns)
│   │   ├── feed.js         Demo event feed in the hero console
│   │   ├── counters.js     Count-up animation for stat blocks
│   │   ├── form.js         Progressive-enhancement form submission
│   │   └── util.js         Small shared helpers
│   └── img/
│       ├── icons.svg       SVG sprite — referenced via <use href="…#icon-name">
│       ├── logo.svg        Standalone brand mark
│       ├── favicon.svg     Favicon
│       └── og-image.svg    Social share card
│
├── netlify.toml            Publish dir, headers, CSP, caching, redirects
├── robots.txt
└── sitemap.xml
```

### Separation of concerns

The brief was strict separation, so:

- **No inline `style` attributes and no `<style>` blocks** anywhere in the HTML.
  Anything that looked like a one-off is a utility class in `layout.css`.
- **No inline `<script>` blocks.** `theme-init.js` is a separate file loaded
  synchronously in `<head>` (it has to run before first paint to avoid a theme
  flash); everything else is an ES module behind `main.js`.
- The Content-Security-Policy in `netlify.toml` enforces this — it has no
  `'unsafe-inline'`, so re-introducing an inline style or script will visibly
  break in production.
- Inline `<svg>` in the HTML is markup, not styling: the diagrams carry classes
  and are styled entirely from `components.css` so they respond to the theme.

Each `init*()` function is a no-op when its markup isn't present, so one module
graph serves every page.

---

## Local development

Any static file server works. The SVG sprite is loaded cross-file, which does
not work over `file://` — use a server, not a double-click.

```bash
python3 -m http.server 4321
```

Then open <http://localhost:4321>.

A `.claude/launch.json` is included so the Claude Code preview tooling can start
the same server by name (`mysec-static`).

---

## Deploying to Netlify

1. Push this repository to GitHub.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
3. Leave the build command empty and set the publish directory to `.`
   (`netlify.toml` already declares both, so the defaults should be correct).
4. Deploy.

`netlify.toml` also configures:

- **Pretty URLs** — `/platform` serves `platform.html`. Internal links use the
  `.html` form so the site also works when opened from a plain file server.
- **Security headers** — HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
  a restrictive `Permissions-Policy`, and a CSP that allows only same-origin
  scripts plus Google Fonts.
- **Caching** — HTML revalidates every request; assets are cached for a day
  (images a week). See the note below before making these immutable.
- **Redirects** — `/demo`, `/home`, `/business`, `/security`.

### The contact form

`contact.html` uses **Netlify Forms**: the `data-netlify="true"` attribute and
the hidden `form-name` field register the form at deploy time, and
`netlify-honeypot="company-website"` provides spam filtering. No configuration
is needed beyond deploying.

`form.js` posts it over `fetch` and swaps in an inline success message. With
JavaScript disabled the browser submits normally and Netlify shows its own
confirmation page. Submissions appear under **Forms** in the Netlify dashboard;
add notification emails there.

---

## Before you launch

These are deliberate placeholders, not oversights:

| Item | Where | What's needed |
| --- | --- | --- |
| Legal copy | `privacy.html`, `terms.html` | Both carry a visible "template — not yet legally reviewed" banner. A security product's privacy notice has to be reviewed by counsel (DPDP Act and GDPR both bite here). Remove the banner once it has been. |
| Performance claims | `index.html`, `commercial.html` | The stat blocks (92% fewer false alarms, 1.8s median, 70% alert reduction, 99.9% uptime) are illustrative. Substantiate them from real deployment data or soften the wording. |
| The testimonial | `index.html` | Attributed generically ("Facilities lead — 9-building logistics park"). Replace with a real, approved quote or remove the section. |
| Pricing | `pricing.html` | Indicative INR figures. Confirm against your actual rate card. |
| Contact details | Every footer | `hello@mysecurity.ai`, `+91 80 0000 0000` and the office addresses are placeholders. |
| Canonical host | Every `<head>`, `robots.txt`, `sitemap.xml` | Currently `mysecurity.example.com`. Search-and-replace with the real domain. |
| Social links | Every footer | Currently `href="#"`. |
| OG image | `assets/img/og-image.svg` | Several platforms don't render SVG share cards. Export a 1200×630 PNG and update the `og:image` tags. |

### Known trade-offs

- **Header and footer are duplicated across pages.** That's the cost of having
  no build step. If page count grows much past this, introduce a tiny
  templating step (Eleventy is the smallest sensible option) rather than
  hand-maintaining ten copies.
- **Asset filenames aren't fingerprinted**, so the cache headers in
  `netlify.toml` are conservative. If you add a build step, hash the filenames
  and switch those to `immutable`.
- **Google Fonts is the one external dependency.** Self-hosting the three
  families would remove it and speed up first paint; the CSP already scopes the
  exception narrowly.

---

## Design

The visual language follows the Cloudflare blog and product pages, with
`#00B074` replacing Cloudflare's orange as the accent:

- Near-black canvas (`#0D0D0D`) with hairline borders and a subtle dot grid
- Dashed vertical measuring rails with square corner markers where section
  rules meet them
- Inter Tight for display, Inter for UI, JetBrains Mono for the uppercase
  eyebrow labels
- Large, tight display headings against small body copy
- Fully rounded pill buttons, accent used sparingly

Both dark and light themes are complete. The theme follows the OS preference
until the visitor picks one with the header toggle, after which their choice is
remembered in `localStorage`.

Changing the accent colour is a one-line edit: `--brand-500` in `tokens.css`.
The rest of the ramp and every tint, ring and glow derive from the theme tokens
directly below it.
