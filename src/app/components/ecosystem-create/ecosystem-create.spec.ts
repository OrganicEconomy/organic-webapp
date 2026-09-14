import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { EcosystemCreate } from './ecosystem-create';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';
import { GeolocationService } from '../../services/geolocation.service';

const SERVER_URL = 'https://trifouillis.fr';
const CREATE_URL = `${SERVER_URL}/api/v1/ecosystems`;
const FOUNDER_SK_HEX = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f';

let fakeAccount: any;
let stubConnectedUserService: any;
let stubViewedEcosystemService: any;
let stubGeolocationService: any;

describe('EcosystemCreate', () => {
  let component: EcosystemCreate;
  let fixture: ComponentFixture<EcosystemCreate>;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    fakeAccount = { name: 'Farid', publickey: 'farid-pk', serverUrl: SERVER_URL };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => FOUNDER_SK_HEX,
      refreshMyEcosystems: jasmine.createSpy('refreshMyEcosystems'),
    };
    stubViewedEcosystemService = { setViewedEcosystem: jasmine.createSpy('setViewedEcosystem') };
    stubGeolocationService = { getCurrentPosition: jasmine.createSpy('getCurrentPosition').and.resolveTo(null) };

    await TestBed.configureTestingModule({
      imports: [EcosystemCreate, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ViewedEcosystemService, useValue: stubViewedEcosystemService },
        { provide: GeolocationService, useValue: stubGeolocationService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(EcosystemCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should redirect to /user-selection if there is no connected user', () => {
    stubConnectedUserService.getConnectedUser = () => null;

    const localFixture = TestBed.createComponent(EcosystemCreate);
    localFixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/user-selection']);
  });

  describe('create', () => {
    it('should not request geolocation when "use my position" is unchecked', async () => {
      component.name = 'Boulangerie associative';
      component.usePosition = false;

      await component.create();

      expect(stubGeolocationService.getCurrentPosition).not.toHaveBeenCalled();
      const req = httpMock.expectOne((r) => r.url === CREATE_URL);
      expect(req.request.body.name).toBe('Boulangerie associative');
      expect(req.request.body.lat).toBeUndefined();
      expect(req.request.body.lng).toBeUndefined();
      req.flush({ publickey: 'eco-pk', blocks: [], iscore: false });
    });

    it('should include resolved coordinates when "use my position" is checked', async () => {
      stubGeolocationService.getCurrentPosition.and.resolveTo({ lat: 45.75, lng: 4.85 });
      component.name = 'Boulangerie associative';
      component.usePosition = true;

      await component.create();

      const req = httpMock.expectOne((r) => r.url === CREATE_URL);
      expect(req.request.body.lat).toBe(45.75);
      expect(req.request.body.lng).toBe(4.85);
      req.flush({ publickey: 'eco-pk', blocks: [], iscore: false });
    });

    it('should populate the viewed ecosystem from the form values and the response, without a second GET', async () => {
      component.name = 'Boulangerie associative';
      component.description = 'Pain bio local';

      await component.create();

      httpMock.expectOne((r) => r.url === CREATE_URL).flush({ publickey: 'eco-pk', blocks: [{ some: 'block' }], iscore: true });

      expect(stubViewedEcosystemService.setViewedEcosystem).toHaveBeenCalledWith({
        publickey: 'eco-pk',
        name: 'Boulangerie associative',
        description: 'Pain bio local',
        lat: null,
        lng: null,
        iscore: true,
        blocks: [{ some: 'block' }],
      });
    });

    it('should refresh myEcosystems and navigate to the new ecosystem detail page on success', async () => {
      component.name = 'Boulangerie associative';

      await component.create();

      httpMock.expectOne((r) => r.url === CREATE_URL).flush({ publickey: 'eco-pk', blocks: [], iscore: false });

      expect(stubConnectedUserService.refreshMyEcosystems).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/ecosystems', 'eco-pk']);
    });

    it('should show an inline error and not navigate when the server rejects the creation', async () => {
      component.name = 'Boulangerie associative';

      await component.create();

      httpMock.expectOne((r) => r.url === CREATE_URL).error(new ProgressEvent('network error'));

      expect(component.actionError).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalledWith(['/ecosystems', 'eco-pk']);
    });
  });
});
