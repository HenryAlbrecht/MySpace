# am-lyrics source snapshot

- Upstream: https://github.com/binimum/am-lyrics
- Upstream version: `1.7.4`
- Exact upstream commit: `4676f22044bb16a9e548b1f0085b03ad747725c9`
- Upstream license: MPL-2.0 (`LICENSE`)
- App artifact: `../../dist/vendor/am-lyrics-1.7.4.js`
- Build: `pnpm install --frozen-lockfile` then `pnpm build`

The TypeScript files in `src/` come from that upstream commit. MySpace changes
are maintained in those files and recorded in `dist/vendor/am-lyrics-NOTICE.md`.
The local package manifest and Rollup config pin the standalone browser build;
they do not add TypeScript, Lit, or a bundler to the MySpace runtime.
