# bitcoin-fee-estimator
Implementation of fee estimation algorithm of bitcoin-core > 0.15.x in javascript

## Motivation
bitcoin-core 0.15.x fee estimation algorithm is a big improvement over older versions.
It can estimate fee up to 1000 blocks instead of only 25 blocks
on pre 0.15.x versions. But there are many bitcoin forks that still using older code.
With this library, it is now possible to estimate fees in a new way for every pre-0.15.x fork.
