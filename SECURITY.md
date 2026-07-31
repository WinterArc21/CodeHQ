# Security Policy

## What this project does with your code

Code Observatory is **local-first**. The CLI and web UI run on your machine, read
`.observatory/` (and referenced paths inside your repository for source checks), and
serve the canvas from `localhost`. **It does not upload your source code to a remote
service**, and it does not call an LLM of its own.

## Reporting a vulnerability

If you find a security issue (for example path traversal, unexpected network
exfiltration, or a way to break the local-only guarantee), please **do not open a
public GitHub issue**.

Email the maintainer at the address listed on the
[npm package](https://www.npmjs.com/package/code-observatory) maintainers field, or
open a private security advisory on the GitHub repository if that feature is enabled.

Please include:

- A clear description of the issue
- Steps to reproduce
- Impact (what an attacker could do)

We will acknowledge reports as soon as we can and work on a fix before any public
disclosure.
