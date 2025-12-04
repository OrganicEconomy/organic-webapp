import { TestBed } from '@angular/core/testing';

import { openDB } from 'idb';

import { UserHandler, User } from './user-handler';

describe('UserHandler', () => {
  let service: UserHandler;

  async function clearStore() {
    const db = await openDB('OrganicMoney', 1);
    const tx = db.transaction('users', 'readwrite');
    await tx.store.clear()
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserHandler);

    await clearStore();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('fetchAllUsers', () => {
    it('should fetch the data', async () => {
      let result = await service.fetchAllUsers()

      expect(result.length).toEqual(0);
    });
  });

  describe('fetchUser', () => {
    it('should fetch the data', async () => {
      let user = <User>{
        pk: "121212",
        name: "michel",
        sk: "aazazazaz",
        blockchain: {},
        contacts: []
      }
      await service.addUser(user)

      let result = await service.fetchUser("121212")

      expect(result).toEqual(user);
    });
  });

  describe('addUser', () => {
    it('should add the given user', async () => {
      let user = <User>{
        pk: "121212",
        name: "michel",
        sk: "aazazazaz",
        blockchain: {},
        contacts: []
      }
      await service.addUser(user)

      let result = await service.fetchAllUsers()
      expect(result.length).toEqual(1);
      expect(result[0]).toEqual(user);
    });
  });
});
