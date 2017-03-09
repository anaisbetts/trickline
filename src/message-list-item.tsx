// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import * as moment from 'moment';
import Avatar from 'material-ui/Avatar';
import Chip from 'material-ui/Chip';
import Paper from 'material-ui/Paper';
import { Observable } from 'rxjs/Observable';

import { Api } from './lib/models/slack-api';
import { Message } from './lib/models/api-shapes';
import { Model, fromObservable } from './lib/model';
import { SimpleView } from './lib/view';
import { Store } from './lib/store';
import { UserViewModel } from './user-list-item';
import { when } from './lib/when';

const styles: { [key: string]: React.CSSProperties } = {
  message: {
    display: 'flex',
    flexDirection: 'row',
    width: '98%',
    margin: '4px 8px',
    padding: '0.5rem',
    paddingRight: '20px'
  },
  profileImage: {
    width: '40px'
  },
  topContainer: {
    marginLeft: '0.6rem'
  },
  displayName: {
    fontWeight: 'bold'
  },
  timestamp: {
    fontWeight: 'lighter',
    fontSize: '0.8rem',
    marginLeft: '0.6rem'
  },
  messageText: {
  }
};

export class MessageViewModel extends Model {
  @fromObservable model: Message;
  @fromObservable user: UserViewModel;
  @fromObservable text: string;
  @fromObservable formattedTime: string;

  constructor(public readonly store: Store, public readonly api: Api, message: Message) {
    super();

    Observable.of(message).toProperty(this, 'model');

    when(this, x => x.model)
      .map(model => new UserViewModel(this.store, model.user as string, api))
      .toProperty(this, 'user');

    when(this, x => x.model)
      .map(model => model.text)
      .toProperty(this, 'text');

    when(this, x => x.model)
      .map(model => moment(parseFloat(model.ts) * 1000).calendar())
      .toProperty(this, 'formattedTime');
  }
}

export class MessageListItem extends SimpleView<MessageViewModel> {
  render() {
    const viewModel = this.props.viewModel;
    const userProfile = viewModel.user && viewModel.user.profileImage ? (
      <Avatar src={viewModel.user.profileImage} />
    ) : null;

    return (
      <Paper style={styles.message}>
        <div style={styles.profileImage}>{userProfile}</div>
        <div style={styles.topContainer}>
          <span style={styles.displayName}>
            {viewModel.user.displayName}
          </span>
          <span style={styles.timestamp}>
            {viewModel.formattedTime}
          </span>
          <div style={styles.messageText}>
            {viewModel.text}
          </div>
        </div>
      </Paper>
    );
  }
}
