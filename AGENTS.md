<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Case data and optional AI results are persisted by the existing case store in localStorage; documents and extracted text remain transient so no account or cloud storage is needed.
- AI inference uses the Gateway SDK inside a TanStack server function, with browser extraction and a maintained source allowlist; this keeps credentials server-side and citations constrained.
- Abort pending analysis when its page unmounts and ignore late results; this prevents an abandoned request from saving into a different case.
- Procedural explanations are substituted from dated maintained sources on the server, in saved-result displays and exports; model-written text and unreviewed sources must never inherit a publisher's authority.
- The opening chat uses AI Elements and a streaming server function, with one browser-saved UIMessage conversation; complete history is sent on each request and maintained legal guidance stays separate from model replies.
