import { RecursiveProxyHandler } from 'electron-remote';
import { Observable } from 'rxjs/Observable';

export interface ApiCall {
  ok: boolean;
  error?: string;
}

export function createApi(token?: string): any {
  const defaultParams = token ? {token} : {};

  return RecursiveProxyHandler.create('api', (names: Array<string>, params: Array<any>) => {
    const p = Object.assign({}, params[0], defaultParams);

    return Observable.ajax.post(`https://slack.com/api/${names.slice(1).join('.')}`, p)
      .flatMap(x => {
        let resp = x.response as ApiCall;
        if (!resp.ok) { return Observable.throw(new Error(resp.error)); };
        return Observable.of(resp);
      });
  });
}