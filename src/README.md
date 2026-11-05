# Source index

- [App.tsx](App.tsx) renders bill entry, photo scan review, printed-total check, people, allocation, local draft management, and installation guidance.
- [locale.ts](locale.ts) contains English, Portuguese, and Spanish interface copy and system-language detection; [locale.test.ts](locale.test.ts) verifies locale selection.
- [locale-preference.ts](locale-preference.ts) reads and writes the shared `plu.nz` language cookie; [locale-preference.test.ts](locale-preference.test.ts) verifies migration and precedence.
- [style.css](style.css) contains the mobile-first Darkppuccin interface styles and product-specific rules layered over `@plunz/storybook/styles.css`.
- [core.ts](core.ts) defines bill/participant types, decimal parsing, and exact allocation; [core.test.ts](core.test.ts) verifies money and reconciliation.
- [scan.ts](scan.ts) checks image signatures and parses AI proposals; [scan.test.ts](scan.test.ts) verifies validation.
- [worker.ts](worker.ts) serves the app and handles bounded, rate-limited AI scans.
- [main.tsx](main.tsx) mounts the SolidJS app.

Return to the [repository overview](../README.md) for setup, privacy, and deployment.
