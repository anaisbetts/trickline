import '../src/babel-maybefill';

let chai = require("chai");
let chaiAsPromised = require("chai-as-promised");

chai.should();
chai.use(chaiAsPromised);

export const {expect, assert} = chai;
