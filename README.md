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
| `npm run typecheck` | Generate Next.js route types and check TypeScript |
| `npm test` | Run the Node.js unit tests |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build after building |

## CI and deployment

Portfolio CI runs on pull requests to `main`, pushes to `main`, and manual runs. With the Node.js version from `.nvmrc`, run the same checks locally.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

On a fresh checkout, `npm run typecheck` generates App Router types such as `LayoutProps` before running TypeScript. The build also needs network access to fetch the existing Geist fonts.

Vercel's Git integration handles preview and production deployments. For AI-assisted review or failure diagnosis, use check logs and redacted reports. Review proposed fixes in a pull request and require checks to pass before merging. Keep approval and deployment decisions with maintainers.

## Project structure

| Path | Contents |
| --- | --- |
| [`src/app/`](src/app/) | Homepage, About route, layout, and global styles |
| [`src/components/`](src/components/) | Navigation, portfolio sections, and interactive visuals |
| [`src/lib/`](src/lib/) | Portfolio content, theme logic, and hologram rendering utilities |
| [`public/hologram/`](public/hologram/) | Portrait assets used by the site |

See the [theme system guide](docs/theme-system.md) for appearance settings and the [portrait tooling guide](tools/hologram/README.md) for asset regeneration.
