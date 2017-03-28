# Trickline

Trickline is an experimental Slack client implementation, whose goals are mostly centered around building a data model for implementing Slack clients that is:

* Very fast
* Completely offline
* Uses memory proportional to the number of objects on-screen at a given time, and isn't proportional to the number of teams signed into, or to the size of those teams.
* Working even on mobile devices with very different performance characteristics

# Material Design tho?

The UI for this application is 100% throwaway, Material-UI was used solely so that we didn't have to waste time implementing UI primitives
