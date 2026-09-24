import { HttpErrorResponse } from '@angular/common/http';

/** A calm, visitor-friendly explanation of why data didn't load. */
export function describeHttpError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 429) {
      return 'Lots of requests right now. Please try again in a minute.';
    }
    if (err.status === 404) {
      return "We couldn't find that.";
    }
    // Server errors or no connection: usually the data source is updating or briefly unavailable.
    return 'Flight data is updating. Please check back shortly.';
  }
  return 'Something went wrong while loading data. Please try again.';
}
