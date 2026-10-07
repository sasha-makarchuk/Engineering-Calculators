# Engineering Calculators

A React + TypeScript + Tailwind CSS engineering calculator site built with Vite.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4 with the Vite plugin
- KaTeX for equations
- Font Awesome for icons
- Vitest for engineering-core tests

## Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Type checking and tests

```bash
npm run typecheck
npm test
```

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages

The Vite base path is configured for this repository:

`/Engineering-Calculators/`

GitHub Pages should use **GitHub Actions** as the publishing source. The included workflow builds `dist` and deploys it on every push to `main`.

The app uses hash routing so calculator URLs work on GitHub Pages without server-side route rewrites.

## Architecture

```text
src/
├── components/       Shared UI components
├── data/             Calculator catalog metadata
├── engineering/     Typed engineering calculations and unit conversions
├── pages/            Application pages
├── App.tsx           Lightweight hash router
└── main.tsx          React entry point
```

Engineering math lives in `src/engineering/` and is independent of the React UI. This is intentional so additional calculators can be added without embedding calculations inside components.

## Adding a calculator

1. Add a calculation module under `src/engineering/`.
2. Add reusable input/output components under `src/components/` when a pattern is shared.
3. Add a page under `src/pages/`.
4. Add a route in `src/App.tsx`.
5. Add the calculator metadata to `src/data/calculators.ts`.
6. Add unit conversions to `src/engineering/units.ts` if the calculator introduces a new quantity.
7. Add calculation tests beside the engineering module.
