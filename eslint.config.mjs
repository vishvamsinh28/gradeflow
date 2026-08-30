import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", ".next-build/**", "src/generated/**", "node_modules/**"]),
  {
    rules: {
      // Every hit is the same idiom: a dialog resetting its fields when it
      // opens, guarded by `if (!open) return` — one pass per open, no cascade.
      // Worth seeing in `npm run lint` output, not worth failing the build
      // until those dialogs move to key-based remounts.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
