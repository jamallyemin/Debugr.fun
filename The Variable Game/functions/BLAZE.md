# server mode (blaze) setup

server mode makes cloud functions the only thing that can write ratings, so nobody can fake them from the browser console. it also turns on **quick match** and the **race** tab. it is optional: the game works without it.

> heads up: this was written against the code, not tested on a real firebase project. do step 7 on a quiet moment and keep the old rules handy.

## 1. upgrade to blaze
firebase console > your project > bottom left **Upgrade** (or Usage and billing) > choose **Blaze (pay as you go)** and add a card. a small game stays inside the free quota, usually $0.

## 2. set a budget alert (do this)
console > Usage and billing > Details & settings > **Budgets & alerts** > make a budget like $5, alert at 50% and 100%. it only emails you, it doesn't stop anything.

## 3. install the tools
```
npm i -g firebase-tools
firebase login
firebase use --add        # pick your project
```

## 4. install and prepare
from the project root:
```
cd functions && npm install && cd ..
node functions/sync-shared.js     # copies the shared game code into functions/shared
node functions/make-rules.js      # writes functions/firestore.rules.server
```

## 5. deploy the functions
```
firebase deploy --only functions
```
(`firebase.json` already runs the sync step before deploying)

## 6. publish the server rules
console > Firestore > Rules > paste the whole content of **functions/firestore.rules.server** > Publish. this blocks browsers from writing ratings.

## 7. TTL policies
console > Firestore > TTL: add policies on `queue.expireAt` and `pairs.expireAt` (plus `rooms.expireAt` if you didn't already).

## 8. flip the switch
in `config.js` set `USE_CLOUD_FUNCTIONS = true`, push to main.

## going back
set the flag to `false`, push, and publish the normal `firestore.rules` again. you can leave the functions deployed or delete them in the console.

## good to know
- time and bites are still reported by the browser, so a scripted solver could still farm easy rating. the server checks the code, the seed, the step caps and the cooldowns.
- whenever `firestore.rules` changes, run `node functions/make-rules.js` again and publish the new `.server` file.
