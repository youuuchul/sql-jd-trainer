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
    // 셀렉이 런타임 원본의 바이트 동일 사본
    "components/selecky/selecky-runtime.js",
    "components/selecky/runtime-source.generated.ts",
  ]),
]);

export default eslintConfig;
