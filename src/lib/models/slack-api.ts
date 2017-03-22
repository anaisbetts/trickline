import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { RecursiveProxyHandler } from '../recursive-proxy-handler';
import { ChannelBase } from './api-shapes';

import '../standard-operators';

import 'rxjs/add/observable/dom/ajax';

export interface ApiCall {
  ok: boolean;
  error?: string;
}

export type Api = any;

export function createApi(token?: string): Api {
  const defaultParams: {token?: string} = token ? {token} : {};
  let socket: Subject<any>;
  let nextSendId = 1;

  return RecursiveProxyHandler.create('api', (names: Array<string>, params: Array<any>) => {
    if (names.length === 2 && names[1] === 'duplicate') return createApi(defaultParams.token);
    if (names.length === 2 && names[1] === 'token') return defaultParams.token;
    if (names.length === 2 && names[1] === 'setSocket') {
      socket = params[0];
      return null;
    }
    if (names.length === 2 && names[1] === 'send') {
      let toSend = params[0];
      nextSendId++;

      let currentId = nextSendId;
      let ret = socket
        .filter(x => x.reply_to === currentId)
        .flatMap(x => {
          if (x.ok) return Observable.of(x);
          return Observable.throw(new Error(`Error ${x.error.code} - ${x.error.message}`));
        })
        .take(1)
        .publishLast();

      ret.connect();

      socket.next(JSON.stringify(Object.assign({ id: nextSendId } , toSend)));
      return ret;
    }

    if (names.length === 2 && names[1] === 'receive') {
      return socket;
    }

    const p = Object.assign({}, params[0], defaultParams);

    return Observable.ajax.post(`https://slack.com/api/${names.slice(1).join('.')}`, p)
      .flatMap(x => {
        let resp = x.response as ApiCall;
        if (!resp.ok) { return Observable.throw(new Error(resp.error)); };
        return Observable.of(resp);
      });
  });
}

export function infoApiForChannel(id: string, api: Api): Observable<ChannelBase|null> {
  if (isChannel(id)) {
    return api.channels.info({ channel: id })
      .map((response: any) => Object.assign(response.channel, { api }));
  } else if (isGroup(id)) {
    return api.groups.info({ channel: id })
      .map((response: any) => Object.assign(response.group, { api }));
  } else if (isDM(id)) {
    return Observable.of(null);
  } else {
    throw new Error(`Unsupported model: ${id}`);
  }
}

export function channelSort(
  { value: a }: { value: ChannelBase},
  { value: b }: { value: ChannelBase}
): number {
  if (a.is_starred && !b.is_starred) return -1;
  else if (b.is_starred && !a.is_starred) return 1;

  if (isDM(a) && !isDM(b)) return 1;
  else if (isDM(b) && !isDM(a)) return -1;

  return a.name.localeCompare(b.name);
}

export function isChannel(channel: ChannelBase|string): boolean {
  return typeof channel == 'string' ?
    channel[0] === 'C' :
    !!channel.id && channel.id[0] === 'C';
}

export function isGroup(channel: ChannelBase|string): boolean {
  return typeof channel == 'string' ?
    channel[0] === 'G' :
    !!channel.id && channel.id[0] === 'G';
}

export function isDM(channel: ChannelBase|string): boolean {
  return typeof channel == 'string' ?
    channel[0] === 'D' :
    !!channel.id && channel.id[0] === 'D';
}