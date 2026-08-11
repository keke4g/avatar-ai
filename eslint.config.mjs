import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local tooling and generated browser/runtime artifacts are not product code.
    ".agents/**",
    ".codex/**",
    ".audit*/**",
    ".diagnostic*/**",
    ".playwright*/**",
    ".venv*/**",
    ".vercel/**",
    ".market-scraper-cache/**",
    ".market-scraper-crawl/**",
    "output/**",
    "scratch/**",
    "backend-local/**",
    "android/app/build/**",
    "public/**/*.js",
  ]),
  {
    rules: {
      // The project is incrementally replacing legacy service payloads. TypeScript
      // still checks them during `next build`; this rule should not block releases.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["scripts/**/*.{js,cjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/**",
                "@/components/**",
                "@/features/**",
                "**/app/**",
                "**/components/**",
                "**/features/**",
              ],
              message: "lib es una capa inferior y no debe depender de app, features ni components.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/**", "@/features/**", "**/app/**", "**/features/**"],
              message: "Un componente compartido no debe conocer rutas ni funciones consumidoras.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/**", "**/app/**"],
              message: "Una función no debe depender de la capa de rutas app.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
