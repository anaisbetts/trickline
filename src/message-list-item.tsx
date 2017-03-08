// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import Avatar from 'material-ui/Avatar';
import Chip from 'material-ui/Chip';
import Paper from 'material-ui/Paper';
import { Observable } from 'rxjs/Observable';

import { Message } from './lib/models/api-shapes';
import { Model, fromObservable } from './lib/model';
import { SimpleView } from './lib/view';
import { Store } from './store';
import { UserViewModel } from './user-list-item';
import { when } from './lib/when';

export class MessageViewModel extends Model {
  @fromObservable model: Message;
  @fromObservable user: UserViewModel;
  @fromObservable text: string;

  constructor(public readonly store: Store, public readonly api: Api, message: Message) {
    super();

    Observable.of(message).toProperty(this, 'model');

    when(this, x => x.model)
      .map(model => new UserViewModel(this.store, model.user as string, api))
      .toProperty(this, 'user');

    when(this, x => x.model)
      .map(model => model.text)
      .toProperty(this, 'text');
  }
}

export class MessageListItem extends SimpleView<MessageViewModel> {
  render() {
    const viewModel = this.props.viewModel;

    let userProfile = null;
    if (viewModel.user && viewModel.user.profileImage) {
      userProfile = (
        <Chip>
          <Avatar src={viewModel.user.profileImage} />
          {viewModel.user.displayName}
        </Chip>
      );
    }

    return (
      <Paper style={{ width: '100%', padding: '8px' }}>
        {userProfile}
        {viewModel.text}
      </Paper>
    );
  }
}
