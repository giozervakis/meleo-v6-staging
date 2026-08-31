# RC3-D8A — Professional Notifications i18n

Localized the professional notifications workspace while preserving
notification API and read-state behavior.

## Scope

- notification load/update errors
- notification type labels
- hero and unread counters
- filters
- notification search
- loading and empty states
- fallback notification title
- read / mark-as-read actions
- mark-all-read feedback
- locale-aware date formatting
- locale-aware search normalization

## Safety boundary

No changes were made to:

- notification API endpoints
- read-state detection
- unread counting
- notification ordering
- filtering rules
- individual mark-read mutation
- mark-all-read mutation
- notification payload structure

The RC3-D7A residue baseline remains immutable.
