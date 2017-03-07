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
