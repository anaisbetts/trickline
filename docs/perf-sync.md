# THE OUTLINE

#### Why even?

- We can't have everything in memory any more. Full stop.
- The average developer shouldn't have to think about RTM.start vs users.counts to build features
  - When views all know about fetching data, it makes changing the data sources Difficult
- How would we design the Slack data model in 2017, given that Teams aren't going to mean anything, and shared / enterprise identities are The Default?

#### Red Threads

- The amount of memory we use is proportional to the number of things on screen
- Writing views should be super easy, and reading the implementation of views should be a joy
- The way that data gets _into_ Slack should be completely unrelated to the way that devs access data
- Electron apps don't have to use 2GB of memory. Prove it.

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
