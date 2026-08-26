import { TestBed } from '@angular/core/testing';
import type { EcosystemInfoResponse } from 'organic-protocol';

import { ViewedEcosystemService } from './viewed-ecosystem.service';
import { ConnectedUserService } from './connected-user.service';
import { makeDefaultAccount } from '../models/account';

describe('ViewedEcosystemService', () => {
  let service: ViewedEcosystemService;

  const ECO_INFO: EcosystemInfoResponse = {
    publickey: 'eco-pk', name: 'Boulangerie associative', description: null, lat: null, lng: null, iscore: false, blocks: [],
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ViewedEcosystemService);
  });

  it('should have no viewed ecosystem before setViewedEcosystem is called', () => {
    expect(service.getViewedEcosystem()).toBeNull();
  });

  it('should attach a live EcosystemBlockchain instance to the viewed ecosystem', () => {
    service.setViewedEcosystem(ECO_INFO);

    expect(typeof service.getViewedEcosystem()?.blockchain.isAdmin).toBe('function');
  });

  it('should never affect ConnectedUserService when setting the viewed ecosystem', () => {
    const connectedUserService = TestBed.inject(ConnectedUserService);
    const account: any = makeDefaultAccount('pk-1')
    connectedUserService.setConnectedUser(account, 'sk')

    service.setViewedEcosystem(ECO_INFO);

    expect(connectedUserService.getConnectedUser().publickey).toBe('pk-1');
  });
});
