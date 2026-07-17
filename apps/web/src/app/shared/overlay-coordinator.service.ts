import { Injectable } from "@angular/core";

export type OverlayCloseHandler = (returnFocus: boolean) => void;

@Injectable({ providedIn: "root" })
export class OverlayCoordinatorService {
  private activeOwner: object | null = null;
  private activeClose: OverlayCloseHandler | null = null;

  open(owner: object, close: OverlayCloseHandler): void {
    if (this.activeOwner && this.activeOwner !== owner) {
      this.activeClose?.(false);
    }
    this.activeOwner = owner;
    this.activeClose = close;
  }

  closed(owner: object): void {
    if (this.activeOwner === owner) {
      this.activeOwner = null;
      this.activeClose = null;
    }
  }

  closeAll(returnFocus = false): void {
    const close = this.activeClose;
    this.activeOwner = null;
    this.activeClose = null;
    close?.(returnFocus);
  }
}
