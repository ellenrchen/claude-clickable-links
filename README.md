# Claude Clickable Links

A Claude Code mod that makes the file paths and URLs in Claude's replies clickable, including the ones Claude wraps in backticks.

[![License](https://img.shields.io/github/license/ellenrchen/claude-clickable-links)](LICENSE)

## Install

Inside Claude Code, run:

```
/plugin marketplace add ellenrchen/claude-clickable-links
/plugin install clickable-links
/reload-plugins
```

That's it. The next reply that mentions a file or a URL shows it as a link.

<details>
<summary><strong>Prefer the terminal?</strong></summary>

```bash
claude plugin marketplace add ellenrchen/claude-clickable-links
claude plugin install clickable-links@claude-clickable-links
```

Then run `/reload-plugins` inside a session, or start a new one.

</details>

## What You See

Claude often writes paths as inline code, which the terminal draws as plain text:

```
● The notes are at `/Users/you/project/notes.md`, and the handler is
  in `src/server/routes.ts:42`.
```

With the mod, both are links. In the fullscreen terminal, a plain click on a file opens it in its default app (not Finder); elsewhere, Cmd-click or Ctrl-click opens links as your terminal does:

- **Paths in backticks link and keep their code styling.**
- **Bare paths link too**: absolute paths and `~/` paths, without any trailing punctuation.
- **Relative paths link only when the file exists**, resolved against the session's working directory, so prose like `and/or` never turns into a link.
- **A `:line` suffix stays in the text.** The link opens the file itself; `file://` links can't carry a line number.
- **URLs link** whether bare or in backticks.
- **Code blocks and existing links stay as written.**

## How It Works

Claude Clickable Links is a [mod](https://code.claude.com/docs/en/plugins/mods/overview):

1. It hooks `ui.render` for `AssistantMessage`, the row that draws each text block of Claude's reply.
2. It rewrites the block's Markdown, turning each path or URL into a Markdown link (`file://` for paths).
3. In the terminal, it draws the block itself with Claude Code's `Markdown` element and answers clicks on file links by running `open` (macOS) or `xdg-open` (Linux), so the file opens in its default app. Elsewhere, or when a block has no file links, it hands the rewritten text to Claude Code's own renderer.
4. It only changes the drawing. The stored conversation, and what Claude reads, stay as they were.

Results are cached per block, so redraws stay cheap.

## Security

Claude Clickable Links is local-only. It makes no network requests and writes no files. It reads `HOME` and the session's working directory, and checks whether relative paths exist. It runs `uname` once, and runs `open` or `xdg-open` on a file only when you click its link.

Run `claude plugin validate` on the repo to see every event it hooks and every call it makes.

## Requirements

- Claude Code v2.1.287 or later (mods support)
- macOS or Linux
- A terminal that supports OSC 8 hyperlinks, such as Ghostty, iTerm2, kitty, WezTerm, or recent GNOME Terminal

## Limitations

- Paths containing spaces aren't linked.
- Only Claude's reply text is rewritten, not tool output or your own prompts.

## Development

```bash
git clone https://github.com/ellenrchen/claude-clickable-links
cd claude-clickable-links

# Load it for one session without installing
claude --plugin-dir .

# Check it and run the tests
claude plugin validate .
claude plugin test .
```

Claude Code writes the API types into `.claude-plugin/types/` the first time it loads the mod, and `tsc -p .` type-checks it from then on.

## License

MIT. See [LICENSE](LICENSE).
