import {Observable} from 'rxjs/Rx';

Observable.prototype.createCollection = function() {
  let ret = [];
  this.subscribe((x) => ret.push(x));

  return ret;
};
