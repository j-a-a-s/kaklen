import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AuthUser } from "../auth/auth.models";
import { AuthService } from "../auth/auth.service";

@Component({
  selector: "kaklen-dashboard",
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow">Dashboard</p>
          <h1>Hello, {{ user()?.firstName || "there" }}</h1>
          <p>{{ user()?.email }}</p>
        </div>
        <button type="button" class="secondary" (click)="logout()" [disabled]="loading()">
          Logout
        </button>
      </section>

      <section class="dashboard-panel">
        <h2>Account</h2>
        <dl *ngIf="user() as currentUser">
          <div>
            <dt>Status</dt>
            <dd>{{ currentUser.status }}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>{{ currentUser.id }}</dd>
          </div>
        </dl>
      </section>
    </main>
  `
})
export class DashboardComponent implements OnInit {
  readonly loading = signal(false);
  readonly user = signal<AuthUser | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.user.set(await this.authService.me());
    } finally {
      this.loading.set(false);
    }
  }

  async logout(): Promise<void> {
    this.loading.set(true);
    try {
      await this.authService.logout();
      await this.router.navigateByUrl("/login");
    } finally {
      this.loading.set(false);
    }
  }
}
