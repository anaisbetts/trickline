import {Disposable, Observable, Subject} from 'rxjs/Rx';

export function when(key, node=null) {
  node = node || this;
  let dashCaseKey = Polymer.CaseMap.camelToDashCase(key);
  
  return Observable.fromEvent(node, `${dashCaseKey}-changed`)
    .startWith(null)
    .map(() => node[key]);
}
  
export function on(key, node=null) {
  node = node || this;
  return Observable.fromEvent(node, key);
}

export function bind(disposable) {
  this.__toDispose = this.__toDispose || new Disposable();
  this.__toDispose.add(disposable);
}

export function asyncButton(node, isEnabled, factory, eventName=null) {
  let inflight = new Subject();
  
  return Observable.create((subj) => {
    let ret = this.on(eventName || 'click', node)
      .map(() => {
        inflight.next(true);
        
        let op = factory();
        if ('then' in op) { op = Observable.fromPromise(op); }
        
        return op.do(() => inflight.next(false));
      })
      .switch();
      
    let disp = new Disposable(ret.subscribe(subj));
    
    disp.add(
      Observable.combineLatest(inflight.startWith(false), isEnabled, (i,e) => !i && e)
        .subscribe((x) => node.disabled = !x));
        
    return disp;
  });
}

export function detached() {
  for (let d of this.__toDispose) { d.dispose(); }
}
