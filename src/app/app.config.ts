import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { ConnectedUserService } from './services/connected-user.service';
import { ChainSyncService } from './services/chain-sync.service';

async function resumeTheTabSessionThenSync(): Promise<void> {
  const userService = inject(ConnectedUserService);
  const chainSync = inject(ChainSyncService);
  try {
    await userService.resumeTabSession();
    await chainSync.syncTheConnectedAccount();
  } catch (error) {
    console.error('The session of this tab could not be resumed and synced.', error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),
    provideAppInitializer(resumeTheTabSessionThenSync),
  ],
};
