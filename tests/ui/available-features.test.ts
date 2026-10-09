// La web solo presenta funciones que existen: el escáner y las guías conservan su
// ruta, pero nada enlaza a ellas; las alertas solo se ofrecen si pueden enviarse.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { resolveAlertsAvailable } from "@/alerts/availability";
import { createMailerFromEnv, isMailerConfigured } from "@/alerts/email";
import { mainNav, mobileTabs } from "@/config/navigation";
import { routes } from "@/lib/routes";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

/** Archivos .ts/.tsx de una carpeta del proyecto, con ruta relativa y barras normales. */
function sourceFiles(folder: string): string[] {
  const root = join(process.cwd(), folder);
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return /\.tsx?$/.test(entry.name) ? [relative(process.cwd(), path).split(sep).join("/")] : [];
    });
  return walk(root);
}

describe("navegación: solo secciones que existen", () => {
  it("ni el menú ni la barra móvil llevan al escáner; las guías, que ya existen, sí están", () => {
    const hrefs = [...mainNav, ...mobileTabs].map((item) => item.href);
    assert.ok(!hrefs.includes(routes.scan));
    assert.deepEqual(mainNav.map((item) => item.label), ["Palas", "Ofertas", "Comparar", "Guías", "Pala ideal"]);
  });

  it("ninguna página ni componente en uso enlaza al escáner", () => {
    // Su propia página y el componente que se conserva sin usar para cuando exista.
    const allowed = new Set([
      "app/escanear/page.tsx",
      "components/pala/ScannerBanner.tsx",
      // No enlaza: solo oculta la barra en la pantalla del escáner.
      "components/layout/TabBar.tsx",
    ]);
    const offenders = [...sourceFiles("app"), ...sourceFiles("components")].filter((file) => {
      if (allowed.has(file)) return false;
      return /routes\.scan\b|["'`]\/escanear\//.test(readFileSync(join(process.cwd(), file), "utf8"));
    });
    assert.deepEqual(offenders, []);
  });

  it("el componente guardado del escáner no se renderiza en ninguna página", () => {
    const users = [...sourceFiles("app"), ...sourceFiles("components")].filter((file) => {
      if (file === "components/pala/ScannerBanner.tsx") return false;
      return /\bScannerBanner\b/.test(readFileSync(join(process.cwd(), file), "utf8"));
    });
    assert.deepEqual(users, []);
  });

  it("la barra móvil no lleva ningún botón flotante encima", () => {
    const tabBar = readFileSync(join(process.cwd(), "components/layout/TabBar.tsx"), "utf8");
    assert.doesNotMatch(tabBar, /absolute/);
    assert.doesNotMatch(tabBar, /Escanear/);
  });
});

describe("alertas de precio: solo se ofrecen si funcionan", () => {
  const configured = env({ RESEND_API_KEY: "re_x", ALERTS_FROM_EMAIL: "PalaRadar <alertas@example.com>" });

  it("hace falta la clave de envío y el remitente", () => {
    assert.equal(isMailerConfigured(env({})), false);
    assert.equal(isMailerConfigured(env({ RESEND_API_KEY: "re_x" })), false);
    assert.equal(isMailerConfigured(env({ ALERTS_FROM_EMAIL: "a@example.com" })), false);
    assert.equal(isMailerConfigured(env({ RESEND_API_KEY: "  ", ALERTS_FROM_EMAIL: "a@example.com" })), false);
    assert.equal(isMailerConfigured(configured), true);
  });

  it("coincide con que exista con qué enviar", () => {
    for (const values of [env({}), env({ RESEND_API_KEY: "re_x" }), configured]) {
      assert.equal(isMailerConfigured(values), createMailerFromEnv(values) !== null);
    }
  });

  it("sin envío de correo, o sin base de datos, no hay alertas que ofrecer", () => {
    assert.equal(resolveAlertsAvailable("database", env({})), false);
    assert.equal(resolveAlertsAvailable("mock", configured), false);
    assert.equal(resolveAlertsAvailable("database", configured), true);
  });

  it("la ficha y el recomendador solo enseñan la alerta si está disponible", () => {
    const ficha = readFileSync(join(process.cwd(), "app/pala/[slug]/page.tsx"), "utf8");
    // El ancla sale de la disponibilidad, y el formulario solo se monta con ella.
    assert.match(ficha, /const alertHref = alertsAvailable\(\) \? `#\$\{ALERT_ID\}` : null;/);
    assert.match(ficha, /\{alertHref && \(\s*<div[^>]*>\s*<AlertBox/);

    const finder = readFileSync(join(process.cwd(), "components/finder/FinderResults.tsx"), "utf8");
    assert.match(finder, /\{alertsEnabled && \(\s*<Link/);
  });
});
