const emptyFn = function() {};

/**
 * RecursiveProxyHandler is a ES6 Proxy Handler object that intercepts method
 * invocations and returns the full object that was invoked. So this means, if you
 * get a proxy, then execute `foo.bar.bamf(5)`, you'll recieve a callback with
 * the parameters "foo.bar.bamf" as a string, and [5].
 */
export class RecursiveProxyHandler {
  /**
   * Creates a new RecursiveProxyHandler. Don't use this, use `create`
   *
   * @private
   */
  constructor(name, methodHandler, parent=null, overrides=null) {
    this.name = name;
    this.proxies = {};
    this.methodHandler = methodHandler;
    this.parent = parent;
    this.overrides = overrides;
  }

  /**
   * Creates an ES6 Proxy which is handled by RecursiveProxyHandler.
   *
   * @param  {string} name             The root object name
   * @param  {Function} methodHandler  The Function to handle method invocations -
   *                                   this method will receive an Array<String> of
   *                                   object names which will point to the Function
   *                                   on the Proxy being invoked.
   *
   * @param  {Object} overrides        An optional object that lets you directly
   *                                   include functions on the top-level object, its
   *                                   keys are key names for the property, and
   *                                   the values are what the key on the property
   *                                   should return.
   *
   * @return {Proxy}                   An ES6 Proxy object that uses
   *                                   RecursiveProxyHandler.
   */
  static create(name, methodHandler, overrides=null) {
    return new Proxy(emptyFn, new RecursiveProxyHandler(name, methodHandler, null, overrides));
  }

  /**
   * The {get} ES6 Proxy handler.
   *
   * @private
   */
  get(target, prop) {
    if (this.overrides && prop in this.overrides) {
      return this.overrides[prop];
    }

    return new Proxy(emptyFn, this.getOrCreateProxyHandler(prop));
  }

  /**
   * The {apply} ES6 Proxy handler.
   *
   * @private
   */
  apply(target, thisArg, argList) {
    let methodChain = [this.replaceGetterWithName(this.name)];
    let iter = this.parent;

    while (iter) {
      methodChain.unshift(iter.name);
      iter = iter.parent;
    }

    return this.methodHandler(methodChain, argList);
  }

  /**
   * Creates a proxy for a returned `get` call.
   *
   * @param  {string} name  The property name
   * @return {RecursiveProxyHandler}
   *
   * @private
   */
  getOrCreateProxyHandler(name) {
    let ret = this.proxies[name];
    if (ret) return ret;

    ret = new RecursiveProxyHandler(name, this.methodHandler, this);
    this.proxies[name] = ret;
    return ret;
  }

  /**
   * Because we don't support directly getting values by-name, we convert any
   * call of the form "getXyz" into a call for the value 'xyz'
   *
   * @return {string} The name of the actual method or property to evaluate.
   * @private
   */
  replaceGetterWithName(name) {
    return name.replace(/_get$/, '');
  }
}