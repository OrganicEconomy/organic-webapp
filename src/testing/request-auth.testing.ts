import type { HttpRequest } from '@angular/common/http';
import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';

const SERVER_INFO = {
  protocolVersion: 1,
  apiVersion: '1',
  name: 'Serveur de test',
  serverPk: '03e7e050c53dcaba20afd83512b355cd0b966fa4af726c1d6cee75b2c11a29f189',
  corePk: null,
  stats: { users: 1 },
};

type RequestMatch = string | ((req: HttpRequest<unknown>) => boolean);

export function expectAuthenticated(httpMock: HttpTestingController, match: RequestMatch): TestRequest {
  httpMock.match((req) => req.url.endsWith('/api/v1/info')).forEach((info) => info.flush(SERVER_INFO));
  return httpMock.expectOne(match);
}
