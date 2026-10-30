# Reviewing and changing the pages

How to look at the pages of the Guest flow and change them, on your own machine.

## The loop

1. On a new branch off `main`, run:

   ```sh
   npm run pages
   ```

   This starts the local server and opens the page review in your browser, at http://localhost:5173/pages, or on the next free port if another project has that one. Leave it running.

2. Pick a page on the left, and a size and theme at the top. The top left names the file to edit.
3. Edit that file and save. The page reloads by itself and stays where you were.
4. Check it at both sizes and in both themes.
5. When it looks right, run the tests. They check some of the pages' exact wording, so a change of wording needs the matching test changed too.

   ```sh
   npm run test:run
   ```

6. Commit, and try it on real devices if the change calls for it (see below).

## What to edit

| Page                | Who sees it, and when                                | File                                         | Tests                     |
| ------------------- | ---------------------------------------------------- | -------------------------------------------- | ------------------------- |
| Card                | The Driver, in the conversation, on opening geenee   | `src/card.ts`                                | `test/openGeenee.test.ts` |
| Hand-off            | A Guest who opens a Room link on a phone             | `src/handOff.ts`, which also holds the email | `test/handOff.test.ts`    |
| Workspace           | Anyone who opens a Room link on a computer           | `index.html`, `src/workspace/`               | `test/roomLink.test.ts`   |
| Get geenee          | Anyone following a Get geenee link                   | `src/getGeenee.ts`                           | `test/getGeenee.test.ts`  |
| Get geenee from a Hand-off | A Guest following the Hand-off's link: Get geenee, with the way back to their Room | `src/getGeenee.ts`    | `test/getGeenee.test.ts`  |
| Expired Room        | Anyone who opens the link of an expired Room         | `src/expiredRoom.ts`                         | `test/expiry.test.ts`     |
| Malformed Room link | Anyone who opens a Room link with a broken Room id   | `src/malformedRoomLink.ts`                   | `test/roomLink.test.ts`   |

Colours, fonts, buttons and headings are shared. They live in `src/page.ts`, where a change reaches every page. The Card uses the same colours and fonts, and has the rest of its style in `src/card.ts`.

Follow the design rule of [#21](https://github.com/aidenlab/geenee/issues/21): Dieter Rams first, Edward Tufte second. Clean, minimal and inviting, with one obvious primary action, in the visual language of `how-geenee-works.html`.

## The controls

- **Size**: Computer fills the window, or for the Card takes about the width of a conversation. Phone is 390 by 844. Phone size changes the width only: a Room link opened in the review still shows the Workspace, because going on to the Hand-off also depends on a touch screen.
- **Theme**: light or dark.
- **Host** (Card only): what the Card says on Claude desktop and on other Hosts. "Refuses to open links" shows its message for that case once you press Open geenee.
- **Show large** (on the Card itself): fills the window, as a Host's full screen would. Show small comes back.
- **Open alone**: the page in its own tab, without the review around it.

## What the review cannot show

The review runs on your computer, with a stand-in for the Host. These need the real thing:

| To check                                     | Do this                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| A Room link going on to the Hand-off         | Open it with a phone chosen in your browser's device toolbar, then reload   |
| The QR code scanning, Email, Share and Copy on a phone | Deploy to dev and use a real phone; the local QR code says `localhost`, which a phone cannot reach |
| The Card and Show large in Claude            | Deploy to dev and add `https://geenee-dev.3dg.io/mcp` as a Connector        |

To deploy a committed branch to dev:

```sh
scripts/deploy-dev.sh my-branch
```

Dev is one slot, shared by whoever is trying something: this replaces what is on it. Production is untouched.
