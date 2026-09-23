import { HttpErrorResponse } from '@angular/common/http';

export function describeHttpError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0 || err.status === 502 || err.status === 504) {
      return 'Could not reach the FlightPulse API. Please try again in a moment.';
    }
    return `The FlightPulse API returned an error (${err.status} ${err.statusText}).`;
  }
  return 'Something went wrong while loading data.';
}
