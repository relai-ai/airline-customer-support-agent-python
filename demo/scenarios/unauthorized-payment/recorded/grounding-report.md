Wiki bootstrapped

Summary
- Status: updated
- Changed Wiki pages: 3
- Sources: repository files, Git history, RELAI run logs
- Changed page examples: requirements/paid-seat-purchase-consent.md; requirements/paid-seat-purchase-once.md; index.md
- Summary: Added two independently changeable, documented behavioral obligations for the isolated synthetic paid-seat candidate: explicit approval of booking/seat/price before charge or seat mutation, and exactly-once approved purchase with truthful status reporting. Updated the topical index while preserving existing pages and artifact-owned tests. Scoped the candidate separately from the original free seat-change benchmark; distinguished the injected prompt defect and offline helper tests from measured conversational failures. Validation passed with no issues. Bounded bootstrap coverage: inspected inventory pages spanning integration files, root docs/instructions/config, source and tests; read README, AGENTS (excluding managed RELAI policy as requirement evidence), main agent, candidate documentation and relevant candidate source, payment helper/tests, benchmark CSV and pyproject. Searched and inspected existing Wiki knowledge before editing. Reviewed eight recent Git subjects and the latest full patch; discovered 16 local log entries and read one aggregate smoke result, which does not substantiate payment-consent behavior. Registered local RELAI artifacts were unavailable/empty; both associated Codex sessions yielded no conversational messages. Omitted exhaustive dependency/cache inventory, older history, remaining integration/recorded evidence and remaining logs; no model run or test execution was performed, and no unmeasured failure was marked confirmed. No material unresolved intent question required a new open-question page.

Suggested next steps, when you're ready

- Review updated project knowledge
  > Show me the updated EvalsWiki requirements, requirements without tests, and remaining open questions.

- Generate agent tests from project knowledge
  > Help me choose requirements from EvalsWiki and create agent tests for them, prioritizing requirements without tests.

- Ask RELAI to search for failure-revealing tests
  > Use RELAI to discover 3 challenging agent tests for potential risks, and let me review the proposed tests.
