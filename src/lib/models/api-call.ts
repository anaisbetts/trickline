import { RecursiveProxyHandler } from 'electron-remote';
import { Observable } from 'rxjs/Observable';

import { User } from './api-shapes';

import '../standard-operators';
import 'rxjs/add/observable/dom/ajax';

export interface ApiCall {
  ok: boolean;
  error?: string;
}

export interface UserResponse extends ApiCall {
  user: User;
}

export function createApi(token?: string): any {
  const defaultParams = token ? {token} : {};

  return RecursiveProxyHandler.create('api', (names: Array<string>, params: Array<any>) => {
    if (names.length === 1 && names[0] === 'token') return defaultParams.token;

    const p = Object.assign({}, params[0], defaultParams);

    return Observable.ajax.post(`https://slack.com/api/${names.slice(1).join('.')}`, p)
      .flatMap(x => {
        let resp = x.response as ApiCall;
        if (!resp.ok) { return Observable.throw(new Error(resp.error)); };
        return Observable.of(resp);
      });
  });
}