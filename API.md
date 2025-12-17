# Pocket Genius API Documentation

Complete API reference for Pocket Genius MVP endpoints.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: Your deployed Vercel URL

## Authentication

Most endpoints use Clerk authentication. Include the authentication cookie or authorization header in requests:

- **Cookie-based**: Automatically handled by browser (recommended for web apps)
- **Header-based**: `Authorization: Bearer <token>` (for API clients)

**Note**: Some endpoints allow anonymous access (marked below). For authenticated endpoints, users must be signed in via Clerk.

---

## Endpoints

### Chat API

#### `POST /api/chat`

Send a chat message and receive a RAG-powered streaming response.

**Authentication**: Optional (anonymous users allowed)

**Request Body**:
```json
{
  "messages": [
    { "role": "user", "content": "What is the Art of War about?" }
  ],
  "conversationId": "optional-conversation-id",
  "chatbotId": "required-chatbot-id"
}
```

**Response**: Streaming text response (Server-Sent Events)

**Headers**:
- `Content-Type: text/event-stream`
- `X-RateLimit-Limit`: Rate limit (default: 10)
- `X-RateLimit-Remaining`: Remaining messages in current window
- `X-RateLimit-Reset`: Unix timestamp when rate limit resets
- `X-Conversation-Id`: Conversation ID (use for subsequent messages)

**Rate Limiting**:
- Authenticated users: 10 messages per minute
- Anonymous users: Not rate limited (MVP)

**Status Codes**:
- `200`: Success (streaming response)
- `400`: Invalid request (missing fields, invalid message format)
- `403`: Unauthorized access to conversation
- `404`: Chatbot or conversation not found
- `429`: Rate limit exceeded
- `500`: Server error
- `503`: Service unavailable (Pinecone, OpenAI, or database issues)
- `504`: Gateway timeout

**Example**:
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello!' }],
    chatbotId: 'chatbot-123'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  console.log(text); // Streamed response chunks
}
```

---

### File Upload API

#### `POST /api/files/upload`

Upload a plain text UTF-8 file for ingestion into the RAG system.

**Authentication**: Required

**Request**: `multipart/form-data`

**Form Fields**:
- `file`: File (plain text UTF-8, max 50MB)
- `sourceId`: Source ID (string)

**Response**:
```json
{
  "fileId": "file-123",
  "status": "PENDING",
  "message": "File uploaded successfully. Processing will begin shortly."
}
```

**Status Codes**:
- `200`: File uploaded successfully
- `400`: Invalid file (size, type, or missing sourceId)
- `401`: Unauthorized (must be signed in)
- `404`: Source not found
- `500`: Server error

**File Requirements**:
- **Type**: Plain text UTF-8 (`text/plain`)
- **Size**: Maximum 50MB
- **Processing**: File status updates automatically: `PENDING` → `PROCESSING` → `READY` (or `ERROR`)

**Example**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('sourceId', 'source-123');

const response = await fetch('/api/files/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(data.fileId); // Use this to check processing status
```

---

### Feedback API

#### `POST /api/feedback/message`

Submit feedback on an assistant message. Supports multiple feedback types: helpful/not_helpful, need_more, and copy feedback.

**Authentication**: Optional (anonymous users allowed)

**Request Body**:

**For helpful/not_helpful feedback:**
```json
{
  "messageId": "message-123",
  "feedbackType": "helpful" | "not_helpful"
}
```

**For "need more" feedback:**
```json
{
  "messageId": "message-123",
  "feedbackType": "need_more",
  "needsMore": ["scripts", "examples", "steps", "case_studies"],
  "specificSituation": "Optional context about user's situation"
}
```

**For copy feedback (initial copy event):**
```json
{
  "messageId": "message-123",
  "feedbackType": "copy"
}
```

**For copy feedback (with usage):**
```json
{
  "messageId": "message-123",
  "feedbackType": "copy",
  "copyUsage": "reference" | "use_now" | "share_team" | "adapt",
  "copyContext": "Required if copyUsage is 'adapt', optional otherwise"
}
```

**Response**:
```json
{
  "success": true
}
```

**Status Codes**:
- `200`: Feedback submitted successfully
- `400`: Invalid request (missing messageId, invalid feedbackType, invalid copyUsage, missing copyContext for 'adapt', or feedback on non-assistant message)
- `404`: Message not found
- `409`: Feedback already submitted (duplicate prevention - one record per message/user/type)
- `500`: Server error

**Behavior**:
- **Duplicate Prevention**: Only one feedback record per message/user/feedbackType combination. Subsequent submissions return success without creating duplicates.
- **Copy Feedback**: Initial copy creates record with `copyUsage=null`. Submitting usage updates the existing record.
- **Chunk Performance**: Updates `Chunk_Performance` counters:
  - `helpfulCount` / `notHelpfulCount` for helpful/not_helpful feedback
  - `needsScriptsCount`, `needsExamplesCount`, etc. for need_more feedback
  - `copyToUseNowCount` when `copyUsage === 'use_now'`
- Computes `satisfactionRate` automatically for helpful/not_helpful feedback
- Only assistant messages can receive feedback

**Example - Helpful Feedback:**
```javascript
const response = await fetch('/api/feedback/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messageId: 'message-123',
    feedbackType: 'helpful'
  })
});

const data = await response.json();
console.log(data.success); // true
```

**Example - Copy Feedback with Usage:**
```javascript
const response = await fetch('/api/feedback/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messageId: 'message-123',
    feedbackType: 'copy',
    copyUsage: 'use_now'
  })
});

const data = await response.json();
console.log(data.success); // true
```

---

### Dashboard API

#### `GET /api/dashboard/[chatbotId]/chunks`

Fetch chunk performance data for dashboard display.

**Authentication**: Required (creator must own chatbot)

**Query Parameters**:
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)
- `sortBy`: `'timesUsed'` | `'satisfactionRate'` (default: `'timesUsed'`)
- `order`: `'asc'` | `'desc'` (default: `'desc'`)
- `minTimesUsed`: Minimum times used filter (default: 5)
- `fetchText`: Whether to fetch missing chunk text from Pinecone (default: `false`)

**Response**:
```json
{
  "chunks": [
    {
      "id": "chunk-perf-123",
      "chunkId": "source-123-chunk-0",
      "sourceId": "source-123",
      "sourceTitle": "The Art of War",
      "timesUsed": 42,
      "helpfulCount": 10,
      "notHelpfulCount": 2,
      "satisfactionRate": 0.833,
      "chunkText": "Cached chunk text...",
      "chunkMetadata": {
        "page": 1,
        "section": "Chapter 1",
        "sourceTitle": "The Art of War"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid query parameters
- `401`: Unauthorized (not signed in)
- `403`: Unauthorized (doesn't own chatbot)
- `404`: Chatbot not found
- `500`: Server error

**Filtering Logic**:
- Shows chunks that have been used `>= minTimesUsed` times, OR
- Have feedback (helpfulCount > 0 OR notHelpfulCount > 0)
- This ensures chunks with feedback are always visible

**Chunk Text Caching**:
- Set `fetchText=true` to populate missing `chunkText` from Pinecone
- Cached text is stored in database for future requests
- Subsequent requests use cached text (faster)

**Example**:
```javascript
const chatbotId = 'chatbot-123';
const response = await fetch(
  `/api/dashboard/${chatbotId}/chunks?page=1&pageSize=20&sortBy=satisfactionRate&order=desc&fetchText=true`,
  {
    headers: {
      'Authorization': 'Bearer <token>' // If using header auth
    }
  }
);

const data = await response.json();
console.log(data.chunks); // Array of chunk performance records
console.log(data.pagination.totalPages); // Total pages
```

---

### Conversation API

#### `GET /api/conversations/[conversationId]/messages`

Fetch all messages for a conversation.

**Authentication**: Optional (anonymous users allowed, but must own conversation if authenticated)

**Response**:
```json
{
  "messages": [
    {
      "id": "message-123",
      "role": "user" | "assistant",
      "content": "Message content...",
      "createdAt": "2024-01-01T00:00:00Z",
      "feedbackType": "helpful" | "not_helpful" | null
    }
  ]
}
```

**Status Codes**:
- `200`: Success
- `400`: Missing conversationId
- `403`: Unauthorized access (authenticated user doesn't own conversation)
- `404`: Conversation not found
- `500`: Server error

**Behavior**:
- Messages ordered by `createdAt` (ascending)
- Includes most recent feedback per message (if any)
- Only authenticated users can access conversations they own
- Anonymous users can access conversations they created (via session)

**Example**:
```javascript
const conversationId = 'conv-123';
const response = await fetch(`/api/conversations/${conversationId}/messages`);

const data = await response.json();
console.log(data.messages); // Array of messages
```

---

### Ingestion API

#### `POST /api/ingestion/trigger`

Trigger file ingestion pipeline (text extraction, chunking, embeddings, Pinecone upsert).

**Authentication**: Required

**Request Body**:
```json
{
  "fileId": "file-123"
}
```

**Response**:
```json
{
  "success": true,
  "fileId": "file-123",
  "status": "READY",
  "textLength": 50000,
  "chunksCreated": 50,
  "vectorsUpserted": 50,
  "message": "File processed successfully. Content is now searchable."
}
```

**Status Codes**:
- `200`: Processing completed successfully
- `400`: Invalid request (missing fileId, or file already processing)
- `401`: Unauthorized (must be signed in)
- `404`: File, source, or chatbot not found
- `500`: Processing failed (file status set to ERROR)

**Processing Pipeline**:
1. Fetch file from Vercel Blob
2. Extract text (plain text UTF-8)
3. Chunk text (1000 character chunks, paragraph-aware)
4. Generate embeddings (OpenAI text-embedding-3-small, batched)
5. Upsert to Pinecone (with retry logic)
6. Update file status: `PROCESSING` → `READY` (or `ERROR`)

**File Status Flow**:
- `PENDING`: File uploaded, waiting for processing
- `PROCESSING`: Currently being processed
- `READY`: Successfully processed, content searchable
- `ERROR`: Processing failed

**Note**: This endpoint is typically called automatically after file upload, but can be called manually for re-processing.

**Example**:
```javascript
const response = await fetch('/api/ingestion/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fileId: 'file-123' })
});

const data = await response.json();
console.log(data.status); // 'READY' or 'ERROR'
console.log(data.chunksCreated); // Number of chunks created
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Human-readable error message",
  "details": "Additional details (development only)"
}
```

**Common Error Codes**:
- `400`: Bad Request (invalid input, missing required fields)
- `401`: Unauthorized (not signed in)
- `403`: Forbidden (doesn't have permission)
- `404`: Not Found (resource doesn't exist)
- `409`: Conflict (duplicate submission, concurrent processing)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error
- `503`: Service Unavailable (external service failure)
- `504`: Gateway Timeout (request timeout)

---

## Rate Limiting

**Chat API** (`POST /api/chat`):
- Authenticated users: 10 messages per minute
- Anonymous users: Not rate limited (MVP)

**Rate Limit Headers** (included in Chat API responses):
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

**Rate Limit Exceeded Response**:
```json
{
  "error": "Rate limit exceeded. Please wait a moment before sending another message."
}
```

---

## Best Practices

1. **Error Handling**: Always check response status codes and handle errors gracefully
2. **Streaming**: Use proper stream handling for Chat API responses
3. **Rate Limiting**: Respect rate limit headers and implement exponential backoff
4. **File Upload**: Check file status after upload before assuming content is searchable
5. **Authentication**: Include auth cookies/headers for protected endpoints
6. **Pagination**: Use pagination for dashboard endpoints to avoid large responses
7. **Retry Logic**: Implement retry logic for transient errors (503, 504)

---

## Testing

For testing endpoints locally:

1. **Start development server**: `npm run dev`
2. **Use API client**: Postman, Insomnia, or `curl`
3. **Check logs**: Monitor console for detailed error messages
4. **Test authentication**: Sign in via Clerk, then use browser cookies or extract token

**Example cURL**:
```bash
# Chat API (anonymous)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"chatbotId":"chatbot-123"}'

# File Upload (requires auth cookie)
curl -X POST http://localhost:3000/api/files/upload \
  -H "Cookie: __clerk_db_jwt=<token>" \
  -F "file=@/path/to/file.txt" \
  -F "sourceId=source-123"
```

---

## Support

For issues or questions:
- Check [README.md](./README.md) for setup instructions
- Review [MONITORING.md](./MONITORING.md) for production monitoring
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide
