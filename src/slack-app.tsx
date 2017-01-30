import * as React from 'react';
import { default as AppBar } from 'material-ui/AppBar';
import { default as MuiThemeProvider } from 'material-ui/styles/MuiThemeProvider';

export default class SlackApp extends React.Component<null, null> {
  render() {
    return <MuiThemeProvider>
      <AppBar title='Trickline' />
    </MuiThemeProvider>;
  }
}