import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AppContainer } from 'react-hot-loader';

const injectTapEventPlugin = require('react-tap-event-plugin');

injectTapEventPlugin();

let render = () => {
  const SlackApp = require('./slack-app').SlackApp;
  ReactDOM.render(<AppContainer><SlackApp /></AppContainer>, document.getElementById('app'));
}

render();
if (module.hot) {
  module.hot.accept(render);
}