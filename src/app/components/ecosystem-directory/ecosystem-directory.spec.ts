import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { EcosystemDirectory } from './ecosystem-directory';
import { ConnectedUserService } from '../../services/connected-user.service';
import { GeolocationService } from '../../services/geolocation.service';

const SERVER_URL = 'https://trifouillis.fr';
const LIST_URL = `${SERVER_URL}/api/v1/ecosystems`;

let fakeAccount: any;
let stubConnectedUserService: any;
let stubGeolocationService: any;

describe('EcosystemDirectory', () => {
  let component: EcosystemDirectory;
  let fixture: ComponentFixture<EcosystemDirectory>;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    fakeAccount = { name: 'Farid', publickey: 'farid-pk', serverUrl: SERVER_URL };
    stubConnectedUserService = { getConnectedUser: () => fakeAccount };
    stubGeolocationService = { getCurrentPosition: () => Promise.resolve(null) };

    await TestBed.configureTestingModule({
      imports: [EcosystemDirectory, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: GeolocationService, useValue: stubGeolocationService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(EcosystemDirectory);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('should redirect to /user-selection if there is no connected user', async () => {
    stubConnectedUserService.getConnectedUser = () => null;

    await createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/user-selection']);
  });

  describe('constructor', () => {
    it('should request the directory without coordinates when geolocation is denied', async () => {
      await createComponent();

      const req = httpMock.expectOne((r) => r.url === LIST_URL);
      expect(req.request.params.has('lat')).toBeFalse();
      expect(req.request.params.has('lng')).toBeFalse();
      req.flush([]);
    });

    it('should request the directory with resolved coordinates when geolocation is granted', async () => {
      stubGeolocationService.getCurrentPosition = () => Promise.resolve({ lat: 45.75, lng: 4.85 });

      await createComponent();

      const req = httpMock.expectOne((r) => r.url === LIST_URL);
      expect(req.request.params.get('lat')).toBe('45.75');
      expect(req.request.params.get('lng')).toBe('4.85');
      req.flush([]);
    });

    it('should store the ecosystems returned by the server', async () => {
      await createComponent();

      httpMock.expectOne((r) => r.url === LIST_URL).flush([
        { publickey: 'eco-pk', name: 'Boulangerie associative', description: null, lat: null, lng: null, iscore: false, distanceKm: 1.2 },
      ]);

      expect(component.ecosystems.length).toBe(1);
      expect(component.ecosystems[0].name).toBe('Boulangerie associative');
    });

    it('should treat a request error as an empty list, without throwing', async () => {
      await createComponent();

      httpMock.expectOne((r) => r.url === LIST_URL).error(new ProgressEvent('network error'));

      expect(component.ecosystems).toEqual([]);
    });
  });

  describe('formatDistance', () => {
    it('should format a distance in km with a comma decimal separator', async () => {
      await createComponent();
      httpMock.expectOne((r) => r.url === LIST_URL).flush([]);

      expect(component.formatDistance(1.2)).toBe('1,2 km');
    });
  });
});
