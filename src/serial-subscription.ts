import {ISubscription, Subscription} from 'rxjs/Subscription';

/**
 * @export
 * @class SerialSubscription
 * Mimics behavior of SerialDisposable in RxJS v4,
 * allows to add only single subscription. If new subscription's added,
 * existing subscription will be unsubscribed.
 *
 * @extends {Subscription}
 */
export class SerialSubscription implements ISubscription {
  private _currentSubscription: ISubscription|null;

  constructor() {
    this._currentSubscription = Subscription.EMPTY;
  }

  /**
   * Adds a tear down to be called during the unsubscribe() of this
   * Subscription.
   *
   * If there's existing subscription, it'll be unsubscribed and
   * removed.
   *
   * @param {TeardownLogic} teardown The additional logic to execute on
   * teardown.
   * @return {Subscription} Returns the Subscription used or created to be
   * added to the inner subscriptions list. This Subscription can be used with
   * `remove()` to remove the passed teardown logic from the inner subscriptions
   * list.
   */
  set(teardown: ISubscription|(() => void)) {
    let newObj: ISubscription;

    if (!this._currentSubscription) return;

    if (typeof(teardown) === 'function') {
      newObj = new Subscription(teardown);
    } else {
      newObj = teardown;
    }

    this._currentSubscription.unsubscribe();
    this._currentSubscription = newObj;
  }

  get closed(): boolean {
    return (this._currentSubscription !== null);
  }

  unsubscribe() {
    if (!this._currentSubscription) return;

    this._currentSubscription.unsubscribe();
    this._currentSubscription = null;
  }
}
