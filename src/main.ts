import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { inject as injectAnalytics } from '@vercel/analytics';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Vercel Web Analytics: visitor counts, without cookies. Production builds
// only, so local development (ng serve) doesn't add visits.
if (!isDevMode()) {
  injectAnalytics({ mode: 'production' });
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
