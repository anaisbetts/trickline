import { RecursiveProxyHandler } from 'electron-remote';
import { Observable } from 'rxjs/Observable';

export function create(token?: string) {
  const defaultParams = token ? {token} : {};

  return RecursiveProxyHandler.create('api', (names: Array<string>, params: Array<any>) => {
    const p = Object.assign({}, params[0], defaultParams);

    return Observable.ajax.post(`https://slack.com/api/${names.slice(1).join('.')}`, p)
      .map((x) => x.response);
  });
}