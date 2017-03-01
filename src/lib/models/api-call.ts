import { RecursiveProxyHandler } from 'electron-remote';
import { Observable } from 'rxjs/Observable';

import '../standard-operators';
import 'rxjs/add/observable/dom/ajax';

export interface ApiCall {
  ok: boolean;
  error?: string;
}

export type Api = any;

export function createApi(token?: string): Api {
  const defaultParams: {token?: string} = token ? {token} : {};

  return RecursiveProxyHandler.create('api', (names: Array<string>, params: Array<any>) => {
    if (names.length === 1 && names[0] === 'duplicate') return createApi(defaultParams.token);

    const p = Object.assign({}, params[0], defaultParams);

    return Observable.ajax.post(`https://slack.com/api/${names.slice(1).join('.')}`, p)
      .flatMap(x => {
        let resp = x.response as ApiCall;
        if (!resp.ok) { return Observable.throw(new Error(resp.error)); };
        return Observable.of(resp);
      });
  });
}