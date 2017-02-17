### The Slack Data Model

Top Level:
  - SparseMap<User[]>
  - SparseMap<Group[]>
  - SparseMap<Channel[]>

- User
  - Team IDs[]
  - Lookup<Profile>

- Channels
  - IApiRoute            <--- Do ApiRoutes have Actions?
  - SparseMap<Message>   <--- Indexed by Time chunk? Or count chunk? Chunks can still be incomplete
  - Joined channels vs just knowing _about_ a channel

- Message
  - Attachments[]
  - Updatable<Text>     <--- Always in use, maybe also lazy?
  - Lookup<User>       <--- Same
  - Lookup<Subteam>    <--- not necessarily needed to even look up

* Events can:
  - Mutate sparse models
  - Add / remove items to maps
  - Mutate properties of sparse models we may or may not have

## Other Stuff

* IApiRoute can encapsulate IM vs Channel vs Group *and* Team vs Org. Maybe?

* Only bother to update something *actually on screen*
  - Model classes are _live_ (i.e. are subscribing to RTM changes)
    - This means, Views drive everything (Views => ViewModels => Models => Data Streams)

* ^^^^ THIS THIS THIS THIS THIS

* The list of Joined Channels is itself a Syncable Thing, separate from Channels

* What we really want to do is WhenAny through a SparseMap and get updates to that object
  - So what we really need, is a ReactiveList which, without an Initial Value, will fetch