export function isObject(o: any): boolean {
  return o === Object(o);
}

export function isFunction(o: any): boolean {
  return !!(o && o.constructor && o.call && o.apply);
};