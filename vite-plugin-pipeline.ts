import type { Plugin } from "vite";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

function runScript(
  server: Parameters<NonNullable<Plugin["configureServer"]>>[0],
  scriptArgs: string[],
  log: string[]
): boolean {
  const python = process.env.PYTHON_CMD ?? "python";
  log.push(`\n$ ${python} ${scriptArgs.join(" ")}`);
  try {
    const out = execFileSync(python, scriptArgs, { cwd: server.config.root, encoding: "utf-8", stdio: "pipe", timeout: 120_000 });
    log.push(out.trim());
    return true;
  } catch (err: any) {
    const detail = err.stderr?.trim() || err.stdout?.trim() || String(err);
    log.push(`✗ Error:\n${detail}`);
    return false;
  }
}

export default function pipelinePlugin(): Plugin {
  return {
    name: "local-pipeline",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/pipeline/update-metadata", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (chunk) => (body += chunk.toString()));
        req.on("end", () => {
          const log: string[] = [];
          try {
            const data = JSON.parse(body);
            const root = server.config.root;
            const importsDir = join(root, "data", "processed", "imports");
            mkdirSync(importsDir, { recursive: true });
            const filename = `${data.variable_id}_metadata.json`;
            const filepath = join(importsDir, filename);
            writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
            log.push(`✓ Payload escrito: data/processed/imports/${filename}`);
            const ok = runScript(server, ["scripts/update_variable_metadata.py"], log);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = ok ? 200 : 500;
            res.end(JSON.stringify({ ok, log }));
          } catch (err: any) {
            log.push(`✗ ${String(err)}`);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, log }));
          }
        });
      });

      server.middlewares.use("/api/pipeline/delete-variable", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (chunk) => (body += chunk.toString()));
        req.on("end", () => {
          const log: string[] = [];
          try {
            const { variable_id } = JSON.parse(body);
            if (!variable_id || typeof variable_id !== "string") throw new Error("variable_id requerido");
            const ok = runScript(server, ["scripts/delete_variable.py", variable_id], log);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = ok ? 200 : 500;
            res.end(JSON.stringify({ ok, log }));
          } catch (err: any) {
            log.push(`✗ ${String(err)}`);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, log }));
          }
        });
      });

      server.middlewares.use("/api/pipeline/run-pca", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (chunk) => (body += chunk.toString()));
        req.on("end", () => {
          const log: string[] = [];
          try {
            const config = JSON.parse(body);
            if (!config.id || !config.variables?.length) throw new Error("id y variables son requeridos");
            const root = server.config.root;
            const pcaConfigDir = join(root, "data", "processed", "pca_configs");
            mkdirSync(pcaConfigDir, { recursive: true });
            const configPath = join(pcaConfigDir, `${config.id}.json`);
            writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
            log.push(`✓ Config escrita: ${configPath}`);
            const ok = runScript(server, ["scripts/analytics/run_custom_pca.py", configPath], log);
            let manifest = null;
            let results = null;
            if (ok) {
              const pcaDir = join(root, "public", "data", "outputs", "pca");
              const manifestPath = join(pcaDir, "manifest.json");
              const resultsPath  = join(pcaDir, config.id, "pca_results.json");
              if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
              if (existsSync(resultsPath))  results  = JSON.parse(readFileSync(resultsPath,  "utf-8"));
            }
            res.setHeader("Content-Type", "application/json");
            res.statusCode = ok ? 200 : 500;
            res.end(JSON.stringify({ ok, log, manifest, results }));
          } catch (err: any) {
            log.push(`✗ ${String(err)}`);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, log }));
          }
        });
      });

      server.middlewares.use("/api/pipeline/import", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }

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
            const ok = runScript(server, ["scripts/import_variable.py"], log);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = ok ? 200 : 500;
            res.end(JSON.stringify({ ok, log }));
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
