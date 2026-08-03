# Frontend Data Model: Platform Overview and Cross-Platform Customer Analytics

**Phase / Spec**: Phase 1 / Spec 002  
**Boundary**: Frontend contracts and sanitized fictional mock data only

## Shared Contract Rules

- Zod validates every query and response before application use.
- Application types are inferred from schemas where practical and contain no
  `any`.
- Counts are non-negative integers; monetary amounts are finite non-negative
  numbers with an explicit currency.
- Rates use numeric values from 0 through 1; formatting as percentages occurs
  only for presentation.
- Timestamps use ISO 8601 with an offset.
- All labels and summaries are bounded plain text; raw HTML is prohibited.
- Identifiers are opaque fictional strings and never contain customer, payment,
  device, provider, or imported-message data.
- Combined customer and financial values are authoritative response fields.
  The browser checks invariants but does not calculate production truth.
- No model contains secrets, credentials, tokens, raw provider payloads,
  customer-level finance, full contact details, device identifiers, IP
  addresses, imported messages, or AI conversation content.

## Shared Enumerations

### PlatformFilter

```text
all | ios | android
```

`all` is the default. `all` means authoritative combined scope, not the
unconditional sum of iOS and Android values.

### ReportingPeriod

```text
7d | 30d | 90d
```

`30d` is the default. Every compared series uses the same period.

### PlatformScope

```text
all | ios | android | global | unknown
```

`global` is used for infrastructure measures without mobile attribution.
`unknown` is a visible data-quality category and is never silently reassigned.

### MetricKind

```text
unique-customers | devices | events | imports | requests |
payments | tickets | currency
```

The kind determines additivity and display semantics.

### FreshnessState

```text
fresh | stale | partial | unavailable
```

### RegionAvailability

```text
available | empty | stale | partial | unavailable | forbidden
```

### Severity

```text
info | low | medium | high | critical
```

Sort priority is the reverse order shown above: critical first.

## OverviewQuery

| Field | Type | Rules |
|---|---|---|
| `platform` | `PlatformFilter` | Defaults to `all` |
| `period` | `ReportingPeriod` | Defaults to `30d` |
| `locale` | `ar \| en` | Defaults to `ar` |
| `scenario` | string or absent | Development/test only; bounded and validated |

The query is the shared input for Overview summary and platform analytics.
Query keys include every field that changes returned data.

## OverviewMetric

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable metric identifier |
| `label` | string | Localized bounded plain text |
| `numericValue` | number | Finite, non-negative |
| `formattedValue` | string | Localized display only |
| `kind` | `MetricKind` | Required |
| `platformScope` | `PlatformScope` | Required |
| `period` | `ReportingPeriod` | Required |
| `freshness` | `DataFreshness` | Required |
| `change` | number or absent | Finite signed comparison value |
| `tone` | `neutral \| positive \| negative \| warning \| premium` | Semantic token only |
| `note` | string or absent | Sanitized and bounded |

`formattedValue` never becomes a source for arithmetic.

## DataFreshness

| Field | Type | Rules |
|---|---|---|
| `state` | `FreshnessState` | Required |
| `asOf` | ISO date-time | Required unless unavailable |
| `warning` | string or absent | Safe localized explanation |

## CustomerPlatformBreakdown

| Field | Type | Rules |
|---|---|---|
| `uniqueCustomersTotal` | integer | Authoritative deduplicated combined total |
| `iosCustomers` | integer | Customers with relevant iOS presence |
| `androidCustomers` | integer | Customers with relevant Android presence |
| `iosOnlyCustomers` | integer | Mutually exclusive segment |
| `androidOnlyCustomers` | integer | Mutually exclusive segment |
| `multiPlatformCustomers` | integer | Overlap segment |
| `activeCustomersTotal` | integer | Authoritative deduplicated active total |
| `activeIosCustomers` | integer | Qualifying activity originating on iOS |
| `activeAndroidCustomers` | integer | Qualifying activity originating on Android |
| `newCustomersTotal` | integer | Registration completed in period, counted once |
| `newIosCustomers` | integer | Registration completed on iOS |
| `newAndroidCustomers` | integer | Registration completed on Android |
| `period` | `ReportingPeriod` | Same for every field |
| `freshness` | `DataFreshness` | Required |

**Validation invariants**:

```text
iosOnlyCustomers + androidOnlyCustomers + multiPlatformCustomers
  = uniqueCustomersTotal

iosCustomers
  = iosOnlyCustomers + multiPlatformCustomers

androidCustomers
  = androidOnlyCustomers + multiPlatformCustomers

activeCustomersTotal
  ≤ activeIosCustomers + activeAndroidCustomers

newCustomersTotal
  = newIosCustomers + newAndroidCustomers
```

Active audiences may overlap. New-customer platform counts cannot overlap.
Background jobs, push delivery, provider callbacks, and Admin actions never
qualify as active-customer activity.

## SubscriptionRevenueSummary

| Field | Type | Rules |
|---|---|---|
| `paidCustomers` | integer | Authoritative aggregated count |
| `freeCustomers` | integer | Authoritative aggregated count |
| `distribution` | `SubscriptionDistributionItem[]` | Bounded plan categories |
| `recurringRevenue` | `MoneyMetric` | Authoritative normalized aggregate |
| `revenueTrend` | `TrendSeries` | Same currency and period throughout |
| `freshness` | `DataFreshness` | Required |

### MoneyMetric

| Field | Type | Rules |
|---|---|---|
| `amount` | number | Finite, non-negative |
| `currency` | `SAR \| AED` | One declared normalized currency |
| `formattedValue` | string | Localized display only |
| `period` | `ReportingPeriod` | Required |
| `platformScope` | `all \| ios \| android` | Attribution context; not additive by default |

## TrendSeries

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable series key |
| `label` | string | Localized bounded text |
| `kind` | `MetricKind` | Same for all points |
| `unit` | string | Same for all points |
| `period` | `ReportingPeriod` | Same comparison window |
| `platformScope` | `PlatformScope` | Required |
| `points` | `TrendPoint[]` | Chronological, bounded, no duplicate timestamp |
| `summary` | string | Required accessible textual summary |

### TrendPoint

| Field | Type | Rules |
|---|---|---|
| `timestamp` | ISO date-time | Chronological |
| `value` | number | Finite |
| `comparisonValue` | number or absent | Same unit and aggregation semantics |

## AppVersionDistributionItem

| Field | Type | Rules |
|---|---|---|
| `platform` | `ios \| android \| unknown` | Required |
| `version` | string | Bounded plain text |
| `supportState` | `current \| supported-older \| unsupported \| unknown` | Required |
| `customerCount` | integer or absent | Aggregated |
| `deviceCount` | integer | Aggregated |
| `share` | number | 0 through 1 |
| `unattributed` | boolean | True for unknown data |

Shares within a complete distribution total 1 within an allowed rounding
tolerance. Unknown values remain separate.

## CapabilityAdoptionMetric

| Field | Type | Rules |
|---|---|---|
| `platform` | `ios \| android` | Required |
| `capability` | capability union | Must belong to platform |
| `eligiblePopulation` | integer | Non-negative |
| `enabledPopulation` | integer | Between 0 and eligible population |
| `rate` | number | Equals enabled/eligible when eligible > 0 |
| `period` | `ReportingPeriod` | Required |
| `caveat` | string | Sanitized, platform-accurate explanation |

Capabilities:

```text
iOS: shortcut | share-extension
Android: sms-tracking | notification-listener
```

No iOS value may imply unrestricted SMS or notification access.

## DeviceDistributionItem

| Field | Type | Rules |
|---|---|---|
| `platform` | `ios \| android \| unknown` | Each known device has one platform |
| `category` | string | Aggregated device category |
| `deviceCount` | integer | Non-negative |
| `share` | number | 0 through 1 |

No device identifier is present.

## PlatformOperationalMetric

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable metric key |
| `kind` | `imports \| events \| requests \| tickets` | Required |
| `platformScope` | `PlatformScope` | Required |
| `total` | integer | Non-negative |
| `successful` | integer or absent | Cannot exceed total |
| `failed` | integer or absent | Cannot exceed total |
| `rate` | number or absent | 0 through 1 |
| `period` | `ReportingPeriod` | Required |
| `freshness` | `DataFreshness` | Required |

Additivity is allowed only when the contract declares exclusive origin and
deduplication has already occurred.

## ServiceHealthSummary

| Field | Type | Rules |
|---|---|---|
| `service` | service union | API, database, cache, worker, storage, payment webhook, AI provider, or push |
| `status` | `operational \| degraded \| partial-outage \| major-outage \| maintenance` | Text and icon accompany color |
| `platformScope` | literal `global` | Spec 002 services are global |
| `uptime` | number | 0 through 1 |
| `latencyMs` | number | Non-negative |
| `errorRate` | number | 0 through 1 |
| `lastCheckedAt` | ISO date-time | Required |
| `freshness` | `DataFreshness` | Required |

Platform filtering never mutates these values.

## OverviewSummaryResponse

| Field | Type | Rules |
|---|---|---|
| `query` | normalized `OverviewQuery` | Echoes effective scope safely |
| `metrics` | `OverviewMetric[]` | Required combined and selected-scope KPIs |
| `subscriptionRevenue` | `SubscriptionRevenueSummary` | Aggregated only |
| `operationalMetrics` | `PlatformOperationalMetric[]` | Bounded |
| `serviceHealth` | `ServiceHealthSummary[]` | Global |
| `regions` | `OverviewRegionState[]` | One state per returned region |
| `freshness` | `DataFreshness` | Response-level |

## PlatformAnalyticsResponse

| Field | Type | Rules |
|---|---|---|
| `query` | normalized `OverviewQuery` | Required |
| `customers` | `CustomerPlatformBreakdown` | Required |
| `userGrowth` | `TrendSeries` | Required |
| `dailyActiveUsers` | `TrendSeries` | Required |
| `monthlyActiveUsers` | `TrendSeries` | Required |
| `versions` | `AppVersionDistributionItem[]` | Bounded |
| `capabilities` | `CapabilityAdoptionMetric[]` | Platform-valid only |
| `devices` | `DeviceDistributionItem[]` | Aggregated |
| `imports` | `PlatformOperationalMetric[]` | Required |
| `support` | `PlatformOperationalMetric[]` | Required |
| `comparisonTrends` | `TrendSeries[]` | Same period and semantics |
| `errorRateTrend` | `TrendSeries` | Required |
| `regions` | `OverviewRegionState[]` | Independent state metadata |

## OverviewRegionState

| Field | Type | Rules |
|---|---|---|
| `region` | stable region union | Required |
| `availability` | `RegionAvailability` | Required |
| `message` | string or absent | Safe, localized, bounded |
| `lastSuccessfulAt` | ISO date-time or absent | Required for stale state |
| `retryable` | boolean | True only when local retry is safe |

**State transitions**:

```text
loading → available
loading → empty
loading → partial
loading → stale
loading → unavailable
loading → forbidden
unavailable → loading → available
stale → loading → available
```

One region transition never clears successful sibling regions.

## OverviewActivityQuery

Extends `OverviewQuery` with:

| Field | Type | Rules |
|---|---|---|
| `page` | integer | At least 1 |
| `pageSize` | integer | 1 through 25; default 10 |

## OverviewActivityItem

| Field | Type | Rules |
|---|---|---|
| `id` | string | Fictional opaque identifier |
| `eventType` | approved event union | Registration, subscription upgrade, webhook failure, parser update, role change, support access, or deletion completion |
| `summary` | string | Sanitized bounded plain text |
| `occurredAt` | ISO date-time | Required |
| `platformScope` | `PlatformScope` | Required |
| `permission` | `PermissionKey` | Presentation filter only |
| `destination` | approved route or absent | Permission-filtered |

Activity is operational context, not immutable audit history.

## AttentionQuery

Extends platform, period, and pagination with the simulated Admin role. The
future backend derives the role from authenticated authorization context rather
than accepting it as authority from the browser.

## AttentionItem

| Field | Type | Rules |
|---|---|---|
| `id` | string | Fictional opaque identifier |
| `type` | approved attention type | Incident, payment, import, AI, queue, security, deletion, or support |
| `severity` | `Severity` | Required |
| `summary` | string | Sanitized bounded text |
| `occurredAt` | ISO date-time | Required |
| `platformScope` | `PlatformScope` | Required |
| `permission` | `PermissionKey` | Required |
| `destination` | approved route or absent | Omitted if inactive or unauthorized |

**Ordering**:

```text
severity descending → occurredAt descending → id ascending
```

## PaginatedResponse<T>

| Field | Type | Rules |
|---|---|---|
| `items` | `T[]` | At most `pageSize` |
| `page` | integer | At least 1 |
| `pageSize` | integer | Contract-bounded |
| `totalItems` | integer | Non-negative |
| `totalPages` | integer | Consistent with total and page size |
| `region` | `OverviewRegionState` | Required |

## Relationships

```text
OverviewQuery
├── OverviewSummaryResponse
│   ├── OverviewMetric
│   ├── SubscriptionRevenueSummary
│   ├── PlatformOperationalMetric
│   └── ServiceHealthSummary
└── PlatformAnalyticsResponse
    ├── CustomerPlatformBreakdown
    ├── TrendSeries
    ├── AppVersionDistributionItem
    ├── CapabilityAdoptionMetric
    ├── DeviceDistributionItem
    └── PlatformOperationalMetric

OverviewActivityQuery → PaginatedResponse<OverviewActivityItem>
AttentionQuery        → PaginatedResponse<AttentionItem>
```

All relationships are response composition only. They do not define database
tables, persistence, or backend entity ownership.
