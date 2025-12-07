# Hack Club Search API

A Brave Search API proxy for Hack Club members. Get web, image, video, news search results, and query suggestions through a simple, authenticated API.

For more detailed docs, see the [Brave Search API docs](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started) - just replace the `https://api.search.brave.com` with `{{BASE_URL}}`.

## Quick Start

```bash
curl "{{BASE_URL}}/res/v1/web/search?q=hack+club" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Authentication

All API requests require a Bearer token. Get your API key from the [dashboard]({{BASE_URL}}/dashboard).

```
Authorization: Bearer sk-hc-v1-...
```

## Endpoints

### Web Search

Search the web for pages, news, videos, discussions, and more.

```
GET /res/v1/web/search
```

#### Parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `q` | Yes | string | - | Search query (max 400 chars, 50 words) |
| `country` | No | string | `US` | Country code for results |
| `search_lang` | No | string | `en` | Search language |
| `count` | No | int | `20` | Number of results (max 20) |
| `offset` | No | int | `0` | Pagination offset (max 9) |
| `safesearch` | No | string | `moderate` | `off`, `moderate`, or `strict` |
| `freshness` | No | string | - | `pd` (24h), `pw` (7d), `pm` (31d), `py` (365d) |
| `extra_snippets` | No | bool | `false` | Get up to 5 extra snippets per result |
| `result_filter` | No | string | - | Comma-delimited result types to include |

#### Example

```bash
curl "{{BASE_URL}}/res/v1/web/search?q=raspberry+pi+projects&count=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

### Image Search

Search for images across the web.

```
GET /res/v1/images/search
```

#### Parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `q` | Yes | string | - | Search query (max 400 chars, 50 words) |
| `country` | No | string | `US` | Country code for results |
| `search_lang` | No | string | `en` | Search language |
| `count` | No | int | `50` | Number of results (max 200) |
| `safesearch` | No | string | `strict` | `off` or `strict` |

#### Example

```bash
curl "{{BASE_URL}}/res/v1/images/search?q=circuit+board&count=20" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

### Video Search

Search for videos across the web.

```
GET /res/v1/videos/search
```

#### Parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `q` | Yes | string | - | Search query (max 400 chars, 50 words) |
| `country` | No | string | `US` | Country code for results |
| `search_lang` | No | string | `en` | Search language |
| `ui_lang` | No | string | `en-US` | UI language preference |
| `count` | No | int | `20` | Number of results (max 50) |
| `offset` | No | int | `0` | Pagination offset (max 9) |
| `safesearch` | No | string | `moderate` | `off`, `moderate`, or `strict` |
| `freshness` | No | string | - | `pd` (24h), `pw` (7d), `pm` (31d), `py` (365d) |

#### Example

```bash
curl "{{BASE_URL}}/res/v1/videos/search?q=javascript+tutorial&count=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Example Response

```json
{
  "type": "videos",
  "query": {
    "original": "javascript tutorial"
  },
  "results": [
    {
      "type": "video_result",
      "url": "https://youtube.com/watch?v=...",
      "title": "JavaScript Tutorial for Beginners",
      "description": "Learn JavaScript from scratch...",
      "age": "2 months ago",
      "thumbnail": {
        "src": "https://..."
      },
      "video": {
        "duration": "1:30:00",
        "views": 1500000,
        "creator": "Channel Name",
        "publisher": "YouTube"
      }
    }
  ]
}
```

---

### News Search

Search for news articles.

```
GET /res/v1/news/search
```

#### Parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `q` | Yes | string | - | Search query (max 400 chars, 50 words) |
| `country` | No | string | `US` | Country code for results |
| `search_lang` | No | string | `en` | Search language |
| `ui_lang` | No | string | `en-US` | UI language preference |
| `count` | No | int | `20` | Number of results (max 50) |
| `offset` | No | int | `0` | Pagination offset (max 9) |
| `safesearch` | No | string | `moderate` | `off`, `moderate`, or `strict` |
| `freshness` | No | string | - | `pd` (24h), `pw` (7d), `pm` (31d), `py` (365d) |
| `extra_snippets` | No | bool | `false` | Get up to 5 extra snippets per result |

#### Example

```bash
curl "{{BASE_URL}}/res/v1/news/search?q=technology&freshness=pd" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Example Response

```json
{
  "type": "news",
  "query": {
    "original": "technology"
  },
  "results": [
    {
      "type": "news_result",
      "url": "https://example.com/article",
      "title": "Breaking Tech News",
      "description": "The latest in technology...",
      "age": "2 hours ago",
      "breaking": true,
      "thumbnail": {
        "src": "https://..."
      },
      "meta_url": {
        "hostname": "example.com",
        "favicon": "https://..."
      }
    }
  ]
}
```

---

### Suggest (Autocomplete)

Get search query suggestions.

```
GET /res/v1/suggest/search
```

#### Parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `q` | Yes | string | - | Query to get suggestions for (max 400 chars) |
| `country` | No | string | `US` | Country code |
| `lang` | No | string | `en` | Language preference |
| `count` | No | int | `5` | Number of suggestions (1-20) |
| `rich` | No | bool | `false` | Enhance with rich results |

#### Example

```bash
curl "{{BASE_URL}}/res/v1/suggest/search?q=how+to&count=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Example Response

```json
{
  "type": "suggest",
  "query": {
    "original": "how to"
  },
  "results": [
    { "query": "how to code" },
    { "query": "how to learn python" },
    { "query": "how to build a website" }
  ]
}
```

---

### Usage Statistics

Get your API usage statistics.

```
GET /res/v1/stats
```

#### Example Response

```json
{
  "totalRequests": 1234
}
```

## Rate Limits

- 100 requests per 30 minutes per user
- Maximum query length: 400 characters

## Error Responses

```json
{
  "error": "Authentication required"
}
```

| Status | Description |
|--------|-------------|
| 400 | Bad request (missing or invalid query) |
| 401 | Authentication required or failed |
| 403 | Banned or identity verification required |
| 413 | Request too large |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Code Examples

### JavaScript

```javascript
const response = await fetch(
  'https://search.hackclub.com/res/v1/web/search?q=hack+club',
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  }
);
const data = await response.json();
console.log(data.web.results);
```

### Python

```python
import requests

response = requests.get(
    'https://search.hackclub.com/res/v1/web/search',
    params={'q': 'hack club'},
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)
data = response.json()
print(data['web']['results'])
```

## Support

Questions or issues? Reach out on the [Hack Club Slack](https://hackclub.com/slack) in #hackclub-search.
