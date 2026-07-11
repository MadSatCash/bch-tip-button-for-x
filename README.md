# BCH Tip Button for X

A lightweight Chrome extension that adds a **Tip** button to posts on X and helps you send Bitcoin Cash tips through **@bchtip** without manually typing the command.

## What it does

- Adds a BCH tip button to posts on X.
- Detects the post author automatically.
- Lets you choose a preset BCH amount or enter a custom amount.
- Builds the correct `@bchtip` reply for you.
- Can post the reply automatically from the current tab.
- Supports English and Spanish.
- Stores only extension preferences locally in Chrome.

## Important: where the funds are managed

This extension does **not** hold, receive, send, or manage your Bitcoin Cash directly.

Your BCH TipBot balance, deposit address, withdrawals, fees, and account are managed through:

**https://tipbot.cash/**

The extension only helps create and publish the X reply used by **@bchtip** to process a tip.

## Requirements

- Google Chrome or another Chromium-based browser.
- An X account.
- A funded BCH TipBot account connected through `tipbot.cash`.

## Installation

The extension is not yet published in the Chrome Web Store, so it must be installed manually.

1. Download this repository as a ZIP:
   - Click **Code**.
   - Click **Download ZIP**.
2. Extract the ZIP file.
3. Open Chrome and go to:

   ```text
   chrome://extensions
   ```

4. Enable **Developer mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the extracted folder that contains `manifest.json`.
7. Open or reload X.

The **Tip** button should now appear in the action bar of posts.

## How to use it

1. Open X and find the post whose author you want to tip.
2. Click the **Tip** button added by the extension.
3. Select a preset BCH amount or enter a custom amount.
4. Review the generated reply.
5. Click **Send tip**.

The extension posts a reply in this format:

```text
@bchtip tip @username 0.0001 BCH
```

The tip is then handled by **@bchtip** and your TipBot account.

## Managing your TipBot account

Go to **https://tipbot.cash/** to:

- Check your BCH balance.
- Get your deposit address.
- Deposit BCH.
- Withdraw BCH.
- Review the current TipBot fee and account conditions.

At the time of writing, TipBot displays a 1% sender fee and returns unclaimed tips after 7 days. Always check `tipbot.cash` for the current terms.

## Privacy and security

- The extension does not request or store a seed phrase.
- It does not access private keys.
- It does not connect directly to a BCH wallet.
- It does not custody funds.
- It runs only on `x.com` and `twitter.com`.
- Preferences are stored locally through Chrome extension storage.

Because the extension interacts with the X interface, future changes to X may temporarily affect it.

## Permissions

The extension uses these Chrome permissions:

- `storage`: saves local preferences.
- `scripting`: supports interaction with the X page.

Host access is limited to:

- `https://x.com/*`
- `https://twitter.com/*`

## Updating the extension manually

1. Download the latest version of the repository.
2. Replace the old local files with the new ones.
3. Open `chrome://extensions`.
4. Find **BCH Tip Button for X**.
5. Click the reload icon.
6. Reload X.

## Development

This is a Chrome Manifest V3 extension built with plain HTML, CSS, and JavaScript.

Main files:

- `manifest.json` — extension configuration.
- `content.js` — injects and controls the tip button on X.
- `content.css` — styles the injected interface.
- `background.js` — background service worker logic.
- `popup.html`, `popup.js`, `popup.css` — extension popup and settings.
- `core.js` — shared tip-command logic.
- `tests/` — tests for core behavior.

## Disclaimer

This is an independent community project. It is not affiliated with, endorsed by, or officially maintained by X, Bitcoin Cash, TipBot, or the operator of `tipbot.cash`.

Always verify the recipient, amount, generated reply, TipBot balance, fees, and current service conditions before sending a tip.

## License

MIT
