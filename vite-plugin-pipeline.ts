import type { Plugin } from "vite";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export default function pipelinePlugin(): Plugin {
  return {
    name: "local-pipeline",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/pipeline/import", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        let body = "";
        req.on("data", (chunk) => (body += chunk.toString()));
        req.on("end", () => {
          const log: string[] = [];

          try {
            const data = JSON.parse(body);
            const root = server.config.root;
            const importsDir = join(root, "data", "processed", "imports");

            mkdirSync(importsDir, { recursive: true });

            const filename = `${data.variable_id}_${data.operation}.json`;
            const filepath = join(importsDir, filename);
            writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
            log.push(`✓ Archivo escrito: data/processed/imports/${filename}`);

            // import_variable.py ejecuta combine síncrono + dispara layer1 en background
            const python = process.env.PYTHON_CMD ?? "python";
            const cmd = `${python} scripts/import_variable.py`;
            log.push(`\n$ ${cmd}`);
            try {
              const out = execSync(cmd, { cwd: root, encoding: "utf-8", stderr: "pipe", timeout: 120_000 });
              log.push(out.trim());
            } catch (err: any) {
              const msg = err.stderr ?? err.stdout ?? String(err);
              log.push(`✗ Error:\n${msg}`);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, log }));
              return;
            }

            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true, log }));
          } catch (err: any) {
            log.push(`✗ ${String(err)}`);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, log }));
          }
        });
      });
    },
  };
}
