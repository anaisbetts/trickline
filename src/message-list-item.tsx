// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import * as moment from 'moment';
import Avatar from 'material-ui/Avatar';
import Chip from 'material-ui/Chip';
import Paper from 'material-ui/Paper';
import { Observable } from 'rxjs/Observable';

import { Api, timestampToDate } from './lib/models/slack-api';
import { Message } from './lib/models/api-shapes';
import { Model, fromObservable } from './lib/model';
import { SimpleView } from './lib/view';
import { Store } from './lib/store';
import { UserViewModel } from './user-list-item';
import { when } from './lib/when';
import { Updatable } from './lib/updatable';

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

  @fromObservable profileImage: string;
  @fromObservable displayName: string;

  constructor(public readonly store: Store, public readonly api: Api, message: Updatable<Message>) {
    super();

    Observable.of(message).toProperty(this, 'model');

    when(this, x => x.model)
      .filter(x => !!x)
      .map(model => new UserViewModel(this.store, model.user as string, api))
      .toProperty(this, 'user');

    when(this, x => x.model)
      .filter(x => !!x)
      .map(model => model.text)
      .toProperty(this, 'text');

    when(this, x => x.model)
      .filter(x => !!x)
      .map(model => moment(timestampToDate(model.ts)).calendar())
      .toProperty(this, 'formattedTime');

    when(this, x => x.user.profileImage)
      .startWith('')
      .toProperty(this, 'profileImage');

    when(this, x => x.user.displayName)
      .startWith('')
      .toProperty(this, 'displayName');
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
            {viewModel.displayName}
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
