import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AppContainer } from 'react-hot-loader';

const injectTapEventPlugin = require('react-tap-event-plugin');

injectTapEventPlugin();

if (window.location.href.match(/^http/i) && !module.hot) {
  navigator.serviceWorker.register('./sw.js')
    .catch((e) => console.error(`Failed to register service worker`, e));
}

let render = () => {
  const SlackApp = require('./slack-app').SlackApp;
  ReactDOM.render(<AppContainer><SlackApp /></AppContainer>, document.getElementById('app'));
}

render();
if (module.hot) {
  module.hot.accept(render);
}
