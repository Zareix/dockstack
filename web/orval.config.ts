import { defineConfig } from "orval"

export default defineConfig({
  dockstack: {
    input: "http://localhost:3000/api/openapi.json",
    output: {
      target: "./src/lib/api/generated",
      schemas: "./src/lib/api/generated/model",
      client: "react-query",
      httpClient: "fetch",
      mode: "tags-split",
      baseUrl: "",

      override: {
        mutator: {
          path: "./src/lib/api/orval-mutator.ts",
          name: "orvalInstance",
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
})
