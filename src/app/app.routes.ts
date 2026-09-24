import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'FlightPulse',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'dashboard',
    title: 'Dashboard · FlightPulse',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'insights',
    title: 'Delay insights · FlightPulse',
    loadComponent: () => import('./pages/insights/insights').then((m) => m.Insights),
  },
  {
    path: 'weather',
    title: 'Airport weather · FlightPulse',
    loadComponent: () => import('./pages/weather/weather').then((m) => m.Weather),
  },
  { path: '**', redirectTo: '' },
];
