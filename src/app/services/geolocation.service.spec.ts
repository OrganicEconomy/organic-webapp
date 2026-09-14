import { TestBed } from '@angular/core/testing';

import { GeolocationService } from './geolocation.service';

describe('GeolocationService', () => {
  let service: GeolocationService;
  const originalGeolocation = (navigator as any).geolocation

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeolocationService);
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', { value: originalGeolocation, configurable: true })
  });

  describe('getCurrentPosition', () => {
    it('should resolve lat/lng when the browser grants the position', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (success: PositionCallback) => {
            success({ coords: { latitude: 45.75, longitude: 4.85 } } as GeolocationPosition)
          },
        },
      })

      const position = await service.getCurrentPosition()

      expect(position).toEqual({ lat: 45.75, lng: 4.85 })
    });

    it('should resolve null when the user denies the permission', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
            error({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError)
          },
        },
      })

      const position = await service.getCurrentPosition()

      expect(position).toBeNull()
    });

    it('should resolve null without throwing when the browser has no geolocation support', async () => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })

      const position = await service.getCurrentPosition()

      expect(position).toBeNull()
    });
  });
});
