import { fileURLToPath } from "node:url";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const cachedLayout = local("../../.next/dev/static/css/app/layout.css");
if (!existsSync(cachedLayout))
  throw new Error(
    "Run the Next recovery-shell browser check first to populate the approved brand fonts",
  );
const faces =
  readFileSync(cachedLayout, "utf8")
    .match(/@font-face\s*\{[\s\S]*?\}/g)
    ?.join("\n") ?? "";
export default defineConfig({
  root: local("./"),
  publicDir: local("../../public"),
  plugins: [
    react(),
    {
      name: "recovery-approved-fonts",
      transformIndexHtml(html) {
        return html.replace(
          "</head>",
          `<style>${faces}:root{--font-dm-sans:'DM Sans';--font-tajawal:'Tajawal'}</style></head>`,
        );
      },
      configureServer(server) {
        server.middlewares.use(
          "/_next/static/media/",
          (request, response, next) => {
            const filename = basename(request.url?.split("?")[0] ?? "");
            const file = join(local("../../.next/dev/static/media"), filename);
            if (!/^[a-zA-Z0-9_.-]+\.woff2$/.test(filename) || !existsSync(file))
              return next();
            response.setHeader("Content-Type", "font/woff2");
            createReadStream(file).pipe(response);
          },
        );
      },
    },
  ],
  resolve: {
    alias: [
      ...["link", "image", "navigation"].map((name) => ({
        find: new RegExp(`^next/${name}$`),
        replacement: local(`./${name}.${name === "navigation" ? "ts" : "tsx"}`),
      })),
      { find: /^@clerk\/nextjs$/, replacement: local("./clerk.tsx") },
      { find: "@", replacement: local("../../src") },
    ],
  },
  define: {
    "process.env": JSON.stringify({
      NODE_ENV: "test",
      NEXT_PUBLIC_CLIENT_MODE: "test",
      NEXT_PUBLIC_ENABLE_MOCKS: "false",
      NEXT_PUBLIC_API_URL: "",
      NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT: "development",
    }),
  },
  server: {
    host: "127.0.0.1",
    port: 43168,
    strictPort: true,
    fs: { allow: [local("../../")] },
    proxy: { "/api": "http://127.0.0.1:43169" },
  },
});
