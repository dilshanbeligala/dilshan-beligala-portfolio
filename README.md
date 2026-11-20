# Dilshan Beligala | Software Engineering Portfolio

A personal portfolio for Dilshan Beligala featuring selected projects, engineering experience, and an interactive 3D holographic portrait.

## Features

- Homepage with selected work and contact links
- About page with professional experience and technical skills
- Interactive holographic portrait with a press-and-hold reveal
- Light, dark, and system themes with a saved preference

## Tech stack

Next.js App Router, React, TypeScript, Tailwind CSS, Three.js, React Three Fiber, and Motion.

## Run locally

Use Node.js 24, as specified in [`.nvmrc`](.nvmrc). Run these commands from the repository root.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app uses the portrait assets in `public/hologram/`. Python is only needed if you regenerate those assets.

## Project scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run lint` | Run ESLint |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build after building |

## Project structure

| Path | Contents |
| --- | --- |
| [`src/app/`](src/app/) | Homepage, About route, layout, and global styles |
| [`src/components/`](src/components/) | Navigation, portfolio sections, and interactive visuals |
| [`src/lib/`](src/lib/) | Portfolio content, theme logic, and hologram rendering utilities |
| [`public/hologram/`](public/hologram/) | Portrait assets used by the site |

See the [theme system guide](docs/theme-system.md) for appearance settings and the [portrait tooling guide](tools/hologram/README.md) for asset regeneration.
