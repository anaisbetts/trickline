import { ChannelBase } from './lib/models/api-shapes';

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