import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import * as i0 from "@angular/core";
class AppComponent {
    health = signal(null, ...(ngDevMode ? [{ debugName: "health" }] : []));
    error = signal(null, ...(ngDevMode ? [{ debugName: "error" }] : []));
    constructor() {
        void this.loadHealth();
    }
    statusLabel() {
        if (this.health()?.status === "ok") {
            return "API saludable";
        }
        return this.error() ?? "Conectando con la API";
    }
    async loadHealth() {
        try {
            const response = await fetch("http://localhost:3000/api/health");
            if (!response.ok) {
                throw new Error(`API responded with ${response.status}`);
            }
            this.health.set((await response.json()));
        }
        catch {
            this.error.set("API no disponible");
        }
    }
    static ɵfac = function AppComponent_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || AppComponent)(); };
    static ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: AppComponent, selectors: [["kaklen-root"]], decls: 15, vars: 4, consts: [[1, "shell"], ["aria-labelledby", "title", 1, "hero"], [1, "eyebrow"], ["id", "title"], [1, "summary"], [1, "status-panel"], [1, "status-dot"]], template: function AppComponent_Template(rf, ctx) { if (rf & 1) {
            i0.ɵɵdomElementStart(0, "main", 0)(1, "section", 1)(2, "p", 2);
            i0.ɵɵtext(3, "Kaklen Foundation");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(4, "h1", 3);
            i0.ɵɵtext(5, "Base ejecutable para construir producto.");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(6, "p", 4);
            i0.ɵɵtext(7, " Angular 20 conectado a una API NestJS 11 con Prisma, PostgreSQL, Swagger y Helmet. ");
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(8, "div", 5);
            i0.ɵɵdomElement(9, "span", 6);
            i0.ɵɵdomElementStart(10, "div")(11, "strong");
            i0.ɵɵtext(12);
            i0.ɵɵdomElementEnd();
            i0.ɵɵdomElementStart(13, "small");
            i0.ɵɵtext(14);
            i0.ɵɵdomElementEnd()()()()();
        } if (rf & 2) {
            let tmp_0_0;
            let tmp_2_0;
            i0.ɵɵadvance(9);
            i0.ɵɵclassProp("status-dot--ok", ((tmp_0_0 = ctx.health()) == null ? null : tmp_0_0.status) === "ok");
            i0.ɵɵadvance(3);
            i0.ɵɵtextInterpolate(ctx.statusLabel());
            i0.ɵɵadvance(2);
            i0.ɵɵtextInterpolate(((tmp_2_0 = ctx.health()) == null ? null : tmp_2_0.timestamp) || "Esperando respuesta de la API");
        } }, dependencies: [CommonModule], encapsulation: 2 });
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(AppComponent, [{
        type: Component,
        args: [{
                selector: "kaklen-root",
                standalone: true,
                imports: [CommonModule],
                template: `
    <main class="shell">
      <section class="hero" aria-labelledby="title">
        <p class="eyebrow">Kaklen Foundation</p>
        <h1 id="title">Base ejecutable para construir producto.</h1>
        <p class="summary">
          Angular 20 conectado a una API NestJS 11 con Prisma, PostgreSQL, Swagger y Helmet.
        </p>

        <div class="status-panel">
          <span class="status-dot" [class.status-dot--ok]="health()?.status === 'ok'"></span>
          <div>
            <strong>{{ statusLabel() }}</strong>
            <small>{{ health()?.timestamp || "Esperando respuesta de la API" }}</small>
          </div>
        </div>
      </section>
    </main>
  `
            }]
    }], () => [], null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(AppComponent, { className: "AppComponent", filePath: "src/main.ts", lineNumber: 30 }); })();
bootstrapApplication(AppComponent).catch((error) => {
    console.error(error);
});
//# sourceMappingURL=main.js.map