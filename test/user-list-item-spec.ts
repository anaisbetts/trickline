import { expect } from './support';
import { MockStore } from './lib/mock-store';
import { Store } from '../src/lib/store';
import { User, Profile } from '../src/lib/models/api-shapes';
import { UserViewModel } from '../src/user-list-item';

const users: { [key: string]: User } = {
  jamesFranco: {
    id: 'jamesFranco',
    name: 'franco',
    real_name: 'James Franco',
    profile: {
      image_72: 'http://screencomment.com/site/wp-content/uploads/2010/05/james_franco.jpg'
    } as Profile
  } as User
};

describe('the UserViewModel', () => {
  let store: Store, fixture: UserViewModel;

  beforeEach(() => {
    const userKey = Object.keys(users)[0];
    store = new MockStore({ users });
    fixture = new UserViewModel(store, userKey, null);
  });

  it('should use a default profile image until it retrieves the user', async () => {
    expect(fixture.profileImage.match(/default-avatar/)).to.be.ok;
    await fixture.changed.take(1).toPromise();
    expect(fixture.profileImage.match(/james_franco/)).to.be.ok;
  });
});