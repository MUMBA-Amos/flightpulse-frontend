import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SiteFooter } from './shared/site-footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteFooter],
  template: `
    <router-outlet />
    <app-site-footer />
  `,
})
export class App {}
