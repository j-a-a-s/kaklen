import { Injectable } from "@angular/core";

export interface KeyboardSequenceOptions {
  timeoutMs: number;
}

const PRIMARY_KEY = "k";
const SECONDARY_KEY = "o";

@Injectable({ providedIn: "root" })
export class KeyboardSequenceService {
  listen(options: KeyboardSequenceOptions, callback: () => void): () => void {
    let waitingForSecondaryKey = false;
    let timeoutId: number | null = null;

    const clear = (): void => {
      waitingForSecondaryKey = false;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const arm = (): void => {
      clear();
      waitingForSecondaryKey = true;
      timeoutId = window.setTimeout(clear, options.timeoutMs);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) {
        return;
      }

      const key = event.key.toLowerCase();
      const primaryModifierPressed = event.metaKey || event.ctrlKey;

      if (primaryModifierPressed && key === PRIMARY_KEY) {
        event.preventDefault();
        arm();
        return;
      }

      if (waitingForSecondaryKey && !primaryModifierPressed && key === SECONDARY_KEY) {
        event.preventDefault();
        clear();
        callback();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });

    return (): void => {
      clear();
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }
}
