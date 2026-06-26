import { Component } from '@angular/core';
import { PageRevealDirective } from '../../../directives/page-reveal';

@Component({
  selector: 'app-dashboard-overview',
  imports: [PageRevealDirective],
  styleUrl: './dashboard-overview.scss',
  template: `
    <section class="dashboard-panel" aria-labelledby="dashboard-overview-title" appPageReveal>
      <p class="section-eyebrow">Dashboard</p>
      <h1 id="dashboard-overview-title" class="dashboard-panel__title">Welcome to Starvia</h1>
      <p class="dashboard-panel__copy">
        You are logged in. Content for this area loads from child routes — add pages under
        <code>/dashboard</code> and wire API calls in each view component.
      </p>
    </section>
  `,
})
export class DashboardOverview {}
