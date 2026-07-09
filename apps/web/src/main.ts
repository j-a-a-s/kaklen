import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import type { HealthResponse } from "@kaklen/shared";

@Component({
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
})
class AppComponent {
  readonly health = signal<HealthResponse | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.loadHealth();
  }

  statusLabel(): string {
    if (this.health()?.status === "ok") {
      return "API saludable";
    }

    return this.error() ?? "Conectando con la API";
  }

  private async loadHealth(): Promise<void> {
    try {
      const response = await fetch("http://localhost:3000/api/health");

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      this.health.set((await response.json()) as HealthResponse);
    } catch {
      this.error.set("API no disponible");
    }
  }
}

bootstrapApplication(AppComponent).catch((error: unknown) => {
  console.error(error);
});
