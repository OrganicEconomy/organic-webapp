import { routes } from './app.routes';
import { MainLayout } from './components/main-layout/main-layout';

describe('routes', () => {
  const mainLayoutRoute = routes.find((route) => route.component === MainLayout);
  const childPaths = (mainLayoutRoute?.children ?? []).map((route) => route.path);

  const expectedNestedPaths = [
    'home',
    'pay',
    'contacts',
    'account',
    'addcontact',
    'cashpapers',
    'printpapers',
    'pay-offline',
    'receive-offline',
    'transactions',
    'validations',
    'validations/:pk',
    'scan-candidate',
    'ecosystems',
    'ecosystems/new',
    'ecosystems/:pk',
    'ecosystems/:pk/invest',
    'ecosystems/:pk/roles',
    'ecosystems/:pk/order',
  ];

  for (const path of expectedNestedPaths) {
    it(`should nest "${path}" under MainLayout so it keeps the bottom nav`, () => {
      expect(childPaths).toContain(path);
    });
  }
});
