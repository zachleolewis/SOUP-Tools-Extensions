# 17. Responsibility

## What SOUP does and does not do

SOUP's extensions follow the same model as Obsidian's community plugins:

- **No review.** Nobody checks an extension before it is published or installed. There is no directory, no verified badge and no remote blocklist.
- **No sandbox and no permissions.** An enabled extension runs in SOUP's window with the same access as SOUP: every SOUP API, the whole file system, any website, any program, and the Riot account through the Riot Client (its tokens, the local API, the remote services).
- **Restricted mode is on by default.** Until the person turns it off, no extension code runs. Turning it off shows a warning every time.
- **Warnings.** Every install and update shows who made the extension, where it came from and what it says it uses, with the warning. An extension that says it uses `riot` gets an extra line in a warning colour.
- **Logging, not blocking.** SOUP writes one log line for everything an extension does *through SOUP's API* (`[ext-<id>]`): files it changes outside its own folders, programs it starts, requests (host and path), windows, the clipboard, every Riot call. Nothing is refused. SOUP cannot see what an extension does on its own, for example inside a helper program it starts.
- **A way out.** Hold Shift while SOUP starts and nothing loads that session. Restricted mode turns everything off at once.

SOUP's own code keeps strict limits about the game (it reads, it does not automate VALORANT or show hidden information). Those limits **do not bind extensions**. That is the trade: extensions can do much more, and the responsibility moves to the person who writes the extension and the person who installs it.

## For authors: being a good citizen

You are asking people to run your code with their account and their files. Behave accordingly.

- **Be honest in the manifest and the README.** List what you use in `uses` (`riot`, `network`, `filesystem`, `processes`, `windows`, `clipboard`) and say what for and which servers you contact. Do not say less than you do.
- **Never send tokens, PUUIDs or personal data anywhere without telling the person first and letting them choose.** A Riot token lets the holder act as the account.
- **Read before you automate.** Riot's rules, not SOUP's, decide what is allowed with an account. Things that have got accounts banned include automating the client or the game, showing information the game hides, and abusing Riot's services. If you are not sure, do not do it, or make it opt-in with a clear explanation.
- **Do not be a load on Riot.** Ask for what you need, no more often than you need, and prefer events to polling. All extensions share one limiter, but a loop that asks every second is still rude.
- **Clean up.** Everything you start must stop with the extension (`register*`; programs are stopped for you).
- **Do not hide things.** No obfuscated code, no extra downloads that change what the extension does after install, no collecting data.
- **Do not break SOUP.** Do not write into SOUP's own files or folders; do not call APIs in ways that confuse the person (changing their lobby, their region or their Library without being asked).
- **Update responsibly.** A new version that asks for more than the old one (a new server, a new use of the Riot account) deserves a major version and a loud note in the release.
- **Fix security problems quickly.** If your extension has a bug that exposes tokens or files, release a fix and say so.

## For people who install extensions

- Install only from authors you trust, from a link you got from them.
- Read the install dialog: the author, the source, what it says it uses.
- Be extra careful with extensions that say `riot`, `processes` or `filesystem`.
- Keep Restricted mode on when you are not using extensions.
- If something odd happens: Shift at launch, then remove the extension.
- What an extension does with your Riot account is on you and the author, not SOUP. Riot may ban accounts for what an extension does.

## Reporting

Report a harmful extension to the person hosting it (GitHub's abuse form for a repository). Tell the SOUP maintainers in an issue of this repository so the documentation can warn; SOUP does not remove extensions from anyone's PC.
