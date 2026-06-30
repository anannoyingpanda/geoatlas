# GeoAtlas

A personal geopolitical knowledge map. Click anywhere on the map to log an event, tag it with countries and topics, rate its severity, and write your own analysis. Filter by country, topic, or severity to study one thread at a time.

This is the Level 1 / Level 2 MVP described in the project's design notes: a static, no-backend site that runs entirely in the browser. Data persists in the browser's local storage. No build step, no server, no database required to get started.

## Admin / viewer mode

The site opens in viewer mode by default: the map is read-only, clicking a marker shows event details but no edit controls. To add or edit events, click "Unlock editing" in the top bar and enter the passphrase.

Default passphrase: `geoatlas`. Change it before sharing the site by editing `ADMIN_PASSWORD` near the top of `app.js`.

This is a convenience lock, not real security. It runs entirely in the browser, so anyone who opens developer tools can read the password check or bypass it. It is meant to prevent accidental edits while browsing your own map, not to protect data from a determined third party. If you later add a shared backend (see Suggested next steps), replace this with real authentication.

Editing state is stored per browser tab session (`sessionStorage`), so it resets when the tab is closed.

## Run locally

No installation needed for the basic version.

1. Download or clone this folder.
2. Open `index.html` directly in a browser, or serve it locally:

```bash
cd geoatlas
python3 -m http.server 8000
```

3. Visit `http://localhost:8000`.

Serving locally (rather than opening the file directly) is recommended, since some browsers block `fetch()` of `data.json` for files opened via `file://`.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to Settings, Pages.
3. Set the source to the branch and root folder containing `index.html`.
4. The site will be live at `https://<username>.github.io/<repo-name>/`.

No build step is required because this version is plain HTML, CSS, and JavaScript.

## Architecture

```
geoatlas/
  index.html       page structure and the event entry form
  style.css         design tokens and layout
  app.js            map rendering, filters, CRUD for events
  countries.js      static country and topic library, used by filters
  data.json         seed events, loaded once on first run
```

### Data model

A single entity, `Event`, carries all information. Countries and topics are arrays on the event rather than the event belonging to one country, since most geopolitical events involve multiple countries.

```js
{
  id: "ev-123",
  title: "China expands rare earth export licensing requirements",
  date: "2026-06-18",
  severity: 3,            // 0 Information, 1 Low, 2 Medium, 3 High, 4 Critical
  location: "Beijing, China",
  lat: 39.9,
  lng: 116.4,
  countries: ["China", "United States", "European Union"],
  topics: ["Export Control", "Rare Earth", "Supply Chain"],
  summary: "What happened, one to two sentences.",
  notes: "Personal analysis. This is the part that compounds in value.",
  links: ["https://..."]
}
```

Severity drives marker color and size on the map, so a region under sustained pressure becomes visible at a glance.

### Why local storage for now

This version is intentionally backend-free so it can be evaluated and deployed in a day. The data model is already shaped for a real database (Supabase or Postgres), so migrating later means writing a thin API layer, not redesigning the schema.

## Known limitations of this version

- Data lives only in the browser that created it. It does not sync across devices and is lost if browser storage is cleared.
- No authentication, multi-user support, or sharing.
- No timeline view, topic graph, or country detail page yet.
- Country and topic libraries are static lists in `countries.js`, not pulled from an external API.

## Suggested next steps, in order

1. **Country detail page.** Clicking a country name should open a page showing its full event count, severity breakdown, and a list of related laws, companies, and papers, as outlined in the original design notes.
2. **Timeline view.** A horizontal chronological view of filtered events, to make escalation patterns visible across time, not just space.
3. **Persistent backend.** Move from local storage to Supabase or a similar Postgres-backed service so data survives across devices and can be backed up.
4. **Laws, companies, papers as linked entities**, rather than free text inside an event's notes.
5. **Topic graph.** A node-link view showing how topics and countries connect, for example Rare Earth to EV to Battery to China to Export Control.

Build in that order. Each step is additive and does not require redesigning what came before.
