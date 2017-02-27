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

export function isDM(channel: ChannelBase) {
  return channel.id[0] === 'D';
}