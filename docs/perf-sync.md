# THE OUTLINE

#### Why even?

- We can't have everything in memory any more. Full stop.
- The average developer shouldn't have to think about RTM.start vs users.counts to build features
  - When views all know about fetching data, it makes changing the data sources Difficult
- How would we design the Slack data model in 2017, given that Teams aren't going to mean anything, and shared / enterprise identities are The Default?
- How hard does Offline From Day One make things?

#### Red Threads

- The amount of memory we use is proportional to the number of things on screen
- Writing views should be super easy, and reading the implementation of views should be a joy
- The way that data gets _into_ Slack should be completely unrelated to the way that devs access data
- Electron apps don't have to use 2GB of memory. Prove it.

#### Demo Ideas

- Boot the app, show memory usage
- Prove we're connected to ws
- Show scrolling speed (open FPS counter)

#### Concepts to Introduce (in order, i.e. drop stuff from the end)

- "Model" aka ViewModels
  - Easy to test! Just create them
  - Properties that tell us when they change

- Updatable
  - "A Lazy Promise"
  - Knows what it is Right Now, and how to get the Latest Version
  - Future: Being able to get staleness, request missing fields (users.counts vs user.info)

- SparseMap
  - Knows how to create Updatables for a certain "class" of thing (users, channels)
  - Conceptually like a Dictionary - you'll always get A Thing, but what you get might be either stale, or pending

- Models and Updatables 2Gether In Love
  - Mention `when` and `toProperty`
  - UserViewModel a good demo class

- React Integration
  - Views know about their containing ViewModels (no props, no state)
  - If a ViewModel updates, the View renders Automagically
  - Views destroy their ViewModels on componentDidUnmount, and ViewModels destroy their connection to the Updatable

---

### BEGIN SLIDES

---

# OK So, React?

We've decided our glorious future will be React-based 🎉

## Sooo, time to…

---

# Componentize Everything!

Converting jQuery + Handlebars views to React will be a challenge

But it might not even be the Hard Part™

---

# Wait, What?

The hard part is converting components from a data model that assumes we have everything

(`TS.the.whole.world`)

To one that is populated on-demand

---

# How 'bout that Redux lyfe?

Redux is great – we've used it in the Desktop app and it provides some 🆒 benefits:

* Your whole app state in one tree: *Introspectible!*
* Actions for everything: *Debuggable!*
* Reducers for everything: *Functionally elegant!*

---

# But it is not without drawbacks... 😔

* Your whole app state in one tree: *Partial models, doe?*
* Actions for everything: *So much Boilerplate*
* Reducers for everything: *What even is a reducer and why am I writing one to toggle a boolean*

---

### We should consider alternatives before diving in

---

# How about a model layer that:

* Supports partial models out-of-the-box
* Appends onto those models as data is received
* _Almost_ as easy to work with as plain ol' objects
