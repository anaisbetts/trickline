# Trickline

Trickline is an experimental Slack client implementation, whose goals are mostly centered around building a data model for implementing Slack clients that is:

* Very fast
* Completely offline
* Uses memory proportional to the number of objects on-screen at a given time, and isn't proportional to the number of teams signed into, or to the size of those teams.
* Working even on mobile devices with very different performance characteristics
