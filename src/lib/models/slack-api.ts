import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { RecursiveProxyHandler } from '../recursive-proxy-handler';
import { ChannelBase, User, Message, MsgTimestamp } from './api-shapes';

import '../standard-operators';

import 'rxjs/add/observable/dom/ajax';

export const MESSAGE_PAGE_SIZE = 1 * 60 * 60 /*sec*/;

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

    const rq = {
      url: `https://slack.com/api/${names.slice(1).join('.')}`,
      method: 'POST',
      body: Object.assign({}, params[0], defaultParams),
      crossDomain: true,
    };

    return Observable.ajax(rq)
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

export function userForId(user: string, api: Api): Observable<User> {
  return api.users.info({user})
    .map((x: any) => {
      let u = x.user! as User;
      u.api = api;
      return u;
    });
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

export function tsToTimestamp(ts: string): MsgTimestamp {
  return parseInt(ts.replace('.', ''));
}

export function timestampToTs(timestamp: MsgTimestamp) {
  return timestamp.toString().replace(/(\d{6})$/, '.$1');
}

export function timestampToPage(timestamp: MsgTimestamp): number {
  return Math.floor(timestamp / 1000000 / MESSAGE_PAGE_SIZE);
}

export function pageToTimestamp(page: number): MsgTimestamp {
  return page * MESSAGE_PAGE_SIZE * 1000000;
}

export function dateToTimestamp(date: Date) {
  let unixTime = date.getTime() / 1000;
  return unixTime * 1000000;
}

export function timestampToDate(timestamp: MsgTimestamp): Date {
  let unixTime = Math.floor(timestamp / 1000000);
  return new Date(unixTime * 1000);
}

export function fetchSingleMessage(channel: string, timestamp: MsgTimestamp, api: Api): Observable<Message> {
  let ts = timestampToTs(timestamp);

  return api.channels.history({
    channel, latest: ts, inclusive: true, count: 1
  }).map((x: any) => {
    let m = x.messages[0] as Message;
    m.channel = channel;
    m.api = api; m.ts = tsToTimestamp(ts);
    return m;
  });
}

async function fetchMessagesForPageAsync(channel: string, page: number, api: Api): Promise<Message[]> {
  let latest = timestampToTs(pageToTimestamp(page + 1));
  let oldest = timestampToTs(pageToTimestamp(page));

  let acc: Message[] = [];
  let result;
  do {
    result = await api.channels.history({ channel, latest, oldest, count: 1000 }).toPromise();
    latest = result.latest;

    acc = acc.concat(result.messages.map((x: Message) => {
      x.api = api;
      x.channel = channel;
      x.ts = tsToTimestamp(x.ts as string);
      return x;
    }));
  } while (result.has_more);

  return acc;
}

async function fetchMessagesPastPageAsync(
    channel: string,
    page: number,
    directionIsForward: boolean,
    api: Api): Promise<{ messages: Message[], page: number}> {
  let filterCriteria;
  if (directionIsForward) {
    filterCriteria = { oldest: timestampToTs(pageToTimestamp(page + 1)) };
  } else {
    filterCriteria = { latest: timestampToTs(pageToTimestamp(page)) };
  }

  let result = await api.channels.history(Object.assign({ channel, count: 10, inclusive: false }, filterCriteria)).toPromise();
  let messages: Message[] = result.messages.map((x: Message) => {
      x.api = api;
      x.channel = channel;
      x.ts = tsToTimestamp(x.ts as string);
      return x;
  });

  if (directionIsForward) {
    let oldest = messages.reduce((acc: number, x) => {
      let thisPage = timestampToPage(x.ts);

      // Return the smallest number that is larger than thisPage
      if (thisPage <= page) return acc;
      if (thisPage > page && acc === page) return thisPage;

      return acc > thisPage ? thisPage : acc;
    }, page);

    return { messages, page: oldest };
  } else {
    let newest = messages.reduce((acc: number, x) => {
      let thisPage = timestampToPage(x.ts);

      // Return the largest number that is smaller than thisPage
      if (thisPage >= page) return acc;
      if (thisPage < page && acc === page) return thisPage;

      return acc < thisPage ? thisPage : acc;
    }, page);

    return { messages, page: newest };
  }
}

export function fetchMessagesPastPage(
    channel: string,
    page: number,
    directionIsForward: boolean,
    api: Api): Observable<{ messages: Message[], page: number}> {
  return Observable.defer(() => Observable.fromPromise(fetchMessagesPastPageAsync(channel, page, directionIsForward, api)));
}

export function fetchMessagesForPage(channel: string, page: number, api: Api): Observable<Message[]> {
  // NB: I'm not smart enough to write this as a Beautiful Functional Programming Tribute
  return Observable.defer(() => Observable.fromPromise(fetchMessagesForPageAsync(channel, page, api)));
}
