export interface SortedArrayOpts {
  filter?: Function;
  compare?: Function | string;
  unique?: boolean;
  resume?: boolean;
}

/* This code is based on https://github.com/shinout/SortedList, licenced under the MIT license */

export class SortedArray<T> extends Array<T> {
  private readonly _filter: Function;
  private readonly _compare: Function;
  private readonly _unique: boolean;

  constructor(_optionsOrArray?: SortedArrayOpts | T[], _arrayIfWeGaveOptions?: T[]) {
    super();

    // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-doesnt-extending-built-ins-like-error-array-and-map-work
    Object.setPrototypeOf(this, SortedArray.prototype);

    let arr: T[] | null = null;
    let options: SortedArrayOpts = {};
    let args = arguments;

    this._filter = () => true;
    this._compare = SortedArray.compares['string'];

    ['0', '1'].forEach(function(n) {
      let val = args[n];

      if (Array.isArray(val)) {
        arr = val;
      } else if (val && typeof val == 'object') {
        options = val;
      }
    });

    if (typeof (options.filter) == 'function') {
      this._filter = options.filter;
    }

    if (typeof options.compare == 'function') {
      this._compare = options.compare;
    } else if (typeof options.compare == 'string' && SortedArray.compares[options.compare]) {
      this._compare = SortedArray.compares[options.compare];
    }

    this._unique = !!options.unique;

    if (options.resume && arr) {
      arr!.forEach(function(this: SortedArray<T>, v) { this.push(v); }, this);
    } else if (arr) {
      this.insert.apply(this, arr);
    }
  }

  insertOne(val: T) {
    let pos = this.bsearch(val);

    if (this._unique && this.key(val, pos) != null) return false;
    if (!this._filter(val, pos)) return false;

    this.splice(pos + 1, 0, val);
    return pos + 1;
  }

  insert(..._vals: T[]) {
    return Array.prototype.map.call(arguments, function(this: SortedArray<T>, val: any) {
      return this.insertOne(val);
    }, this);
  }

  remove(pos: number) {
    this.splice(pos, 1);
    return this;
  }

  bsearch(val: T) {
    if (!this.length) return -1;

    let mpos,
        mval,
        spos = 0,
        epos = this.length;
    while (epos - spos > 1) {
      mpos = Math.floor((spos + epos) / 2);
      mval = this[mpos];
      let comp = this._compare(val, mval);
      if (comp == 0) return mpos;
      if (comp > 0)  spos = mpos;
      else           epos = mpos;
    }

    return (spos == 0 && this._compare(this[0], val) > 0) ? -1 : spos;
  }

  key(val: T, bsResult: number | null = null) {
    if (bsResult == null) bsResult = this.bsearch(val);

    let pos = bsResult;
    if (pos == -1 || this._compare(this[pos], val) < 0)
      return (pos + 1 < this.length && this._compare(this[pos + 1], val) == 0) ? pos + 1 : null;
    while (pos >= 1 && this._compare(this[pos - 1], val) == 0) pos--;
    return pos;
  }

  getall(val: T, bsResult: number | null = null) {
    let ret = [];
    if (bsResult == null) bsResult = this.bsearch(val);
    let pos = bsResult;
    while (pos >= 0 && this._compare(this[pos], val) == 0) {
      ret.push(pos);
      pos--;
    }

    let len = this.length;
    pos = bsResult + 1;
    while (pos < len && this._compare(this[pos], val) == 0) {
      ret.push(pos);
      pos++;
    }
    return ret.length ? ret : null;
  }

  unique(createNew: boolean) {
    if (createNew) return this.filter(function(this: SortedArray<T>, v, k) {
      return k == 0 || this._compare(this[k - 1], v) != 0;
    }, this);

    let total = 0;
    this.map(function(this: SortedArray<T>, v, k) {
      if (k == 0 || this._compare(this[k - 1], v) != 0) return null;
      return k - (total++);
    }, this)
    .forEach(function(this: SortedArray<T>, k) {
      if (k != null) this.remove(k);
    }, this);

    return this;
  }

  toArray() {
    return this.slice();
  }

  static compares = {
    'number': function(a: number, b: number) {
      let c = a - b;
      return (c > 0) ? 1 : (c == 0)  ? 0 : -1;
    },

    'string': function(a: string, b: string) {
      return (a > b) ? 1 : (a == b)  ? 0 : -1;
    }
  };
}