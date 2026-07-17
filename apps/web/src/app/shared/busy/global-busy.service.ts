import { Injectable, signal } from "@angular/core";

export interface BusyOperation {
  end(): void;
}

@Injectable({ providedIn: "root" })
export class GlobalBusyService {
  readonly activeOperations = signal(0);
  readonly visible = signal(false);
  private visibilityTimer: number | null = null;

  begin(): BusyOperation {
    let active = true;
    this.activeOperations.update((count) => count + 1);
    if (this.activeOperations() === 1) {
      this.visibilityTimer = window.setTimeout(() => {
        this.visibilityTimer = null;
        if (this.activeOperations() > 0) {
          this.visible.set(true);
          document.documentElement.classList.add("kaklen-busy");
        }
      }, 150);
    }
    return {
      end: () => {
        if (!active) {
          return;
        }
        active = false;
        this.finishOne();
      }
    };
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const busy = this.begin();
    try {
      return await operation();
    } finally {
      busy.end();
    }
  }

  reset(): void {
    this.activeOperations.set(0);
    this.clearVisibilityTimer();
    this.visible.set(false);
    document.documentElement.classList.remove("kaklen-busy");
  }

  private finishOne(): void {
    this.activeOperations.update((count) => Math.max(0, count - 1));
    if (this.activeOperations() === 0) {
      this.clearVisibilityTimer();
      this.visible.set(false);
      document.documentElement.classList.remove("kaklen-busy");
    }
  }

  private clearVisibilityTimer(): void {
    if (this.visibilityTimer !== null) {
      window.clearTimeout(this.visibilityTimer);
      this.visibilityTimer = null;
    }
  }
}
