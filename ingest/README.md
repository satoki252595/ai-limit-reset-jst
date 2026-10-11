# Auto-ingest routine (hourly at :37)

1. Search X newest-first since `state.json.newest_seen_id` for posts from accounts in `allowlist.json` (add `-from:grok -is:retweet`). Also read self-replies and quote posts by allowlisted accounts.
2. Open the full text (note_tweet). Publish only clear usage-limit resets by allowlisted authors.
3. Record the stated time verbatim in `source_time_text`; if a time is stated, set `source_tz` (IANA, e.g. `America/Los_Angeles`; "PST" written during US daylight time = PDT) and `source_local_datetime`, and derive `effective_jst_iso`.
4. Each new entry MUST include:
   - `summary` (Japanese, source of truth, short — never the full post text, no images)
   - `summary_i18n.en` (required) and other locales where reasonable (`zh-Hans`, `zh-Hant`, `ko`, `es`, `fr`, `de`, `pt-BR`, `hi`, `id`) — translations of the Japanese summary only, no new facts
   - `effective` (ja) and `effective_i18n.en`; `scope` / `scope_i18n.en`; if `note` is set, `note_i18n.en`
   - For `type: "scheduled"`: `time_precision` (required) — `exact` (a specific clock time, e.g. "10am PST"; needs `source_local_datetime`), `deadline` (an upper bound such as "by EOD", "by midnight"; the reset may come earlier, and `source_time_text` must keep the original wording), or `approximate` (no time / vague timing). Leave `time_precision: null` for `immediate` / `banked`.
   - `source_tz_assumed` (boolean, required whenever `source_tz` is set): `true` if the post does not state the zone and it was inferred (e.g. "by EOD" read as Pacific), `false` if the post states it.
4b. Confirmation: on every run, also look for completion posts (e.g. "reset done / propagated / landed") by allowlisted authors for entries still `status: "scheduled"`. When one exists, set `status: "done"`, `confirmed_url` (the post URL) and `confirmed_utc` (its timestamp, `YYYY-MM-DDTHH:MM:SSZ`, must match the post ID's snowflake time), and update `effective` / `effective_i18n.en`. This applies even before the scheduled/deadline time; the page then shows "Reset done at HH:MM" and stops the countdown.
5. Anything borderline (time zone missing, unclear scope, unverified author) goes to `pending.json` with a `reason` and is never published.
6. Keep the 30-day pruning, run `node tests/validate.mjs`, and push only if it passes. Update `state.json`.
