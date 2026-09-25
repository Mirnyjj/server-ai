ТЗ: Autonomous AI Instagram Profile + Telegram Control Bot

1. Цель проекта
   Разработать автономную систему управления Instagram-профилем виртуального AI-персонажа через официальный Meta Graph API.
   Система должна:
   самостоятельно создавать контент-план;
   генерировать изображения и видео/Reels;
   генерировать captions;
   публиковать контент;
   получать комментарии;
   отвечать на комментарии;
   получать Direct Messages;
   отвечать на DM в рамках разрешённых Meta messaging policies;
   получать Instagram Insights;
   анализировать эффективность контента;
   хранить долгосрочную память AI-персонажа;
   адаптировать content strategy;
   работать 24/7;
   управляться через Telegram Bot;
   не зависеть от Telegram для выполнения autonomous jobs.
   Instagram integration должна использовать официальный Meta Graph API.
   instagrapi не используется.
   Instagram username/password не хранятся и не передаются системе.

2. Основное архитектурное изменение
   Старая архитектура:
   Node.js
   ↓
   Python FastAPI
   ↓
   instagrapi
   ↓
   Instagram

Новая архитектура:
Meta Graph API
↑
│ HTTPS
│
┌────────────────────────┴────────────────────────┐
│ Node.js API │
│ │
│ OAuth │ Graph API Client │ Webhooks │ Agent │
└───────────────┬─────────────────┬───────────────┘
│ │
↓ ↓
PostgreSQL Redis
Prisma BullMQ
│ │
└────────┬────────┘
↓
Claude API
│
↓
Media Generators
│
↓
Object Storage

Telegram
↓
Control Plane
↓
Node.js API

Telegram voice/audio processing:
Telegram voice/audio
↓
Telegram Bot API file download
↓
local Whisper service (faster-whisper, CPU)
↓
transcript
↓
Telegram AI Agent

Whisper service:
whisper/
├── Dockerfile
├── requirements.txt
└── main.py

The Whisper service runs only inside the Docker network at http://whisper:8001.
The production server uses the base model with int8 CPU quantization and one CPU thread to fit the 1 vCPU / 2 GB RAM host.
No external Speech-to-Text API key is required.

Python Instagram Worker полностью удаляется.

3. Meta integration
   Instagram automation реализуется через официальный Meta Graph API.
   Используемые возможности должны покрывать:
   Instagram account connection
   Instagram profile information
   Content publishing
   Reels publishing
   Comments
   Direct Messages
   Insights
   Instagram public content where permitted
   Business assets
   Catalogs
   Branded content
   Webhooks

Основной принцип:
OAuth
↓
Meta access token
↓
Graph API
↓
Instagram Business / Creator account

Никаких:
Instagram password
Instagram private API
instagrapi
session files
device fingerprints
Instagram proxies
private mobile API

4. Meta permissions / capabilities
   В Meta App необходимо предусмотреть необходимые permissions/access levels из следующего набора:
   Business Asset User Profile Access
   Human Agent
   Instagram Public Content Access

ads_management
ads_read
business_management
catalog_management

email

instagram_basic
instagram_branded_content_ads_brand
instagram_branded_content_brand
instagram_branded_content_creator

instagram_business_basic
instagram_business_content_publish
instagram_business_manage_comments
instagram_business_manage_insights
instagram_business_manage_messages

instagram_content_publish
instagram_creator_marketplace_discovery

instagram_manage_comments
instagram_manage_contents
instagram_manage_engagement
instagram_manage_insights
instagram_manage_messages
instagram_manage_upcoming_events
instagram_shopping_tag_products

pages_read_engagement
pages_show_list

public_profile

Важно:
не все permissions должны использоваться MVP.
Permissions делятся на:
CORE
OPTIONAL
FUTURE

CORE MVP
instagram_business_basic
instagram_business_content_publish
instagram_business_manage_comments
instagram_business_manage_insights
instagram_business_manage_messages

instagram_basic
instagram_content_publish

pages_show_list
pages_read_engagement

public_profile

Конкретный набор зависит от выбранного Meta authentication flow.
FUTURE
ads_management
ads_read

business_management
catalog_management

instagram_branded_content_ads_brand
instagram_branded_content_brand
instagram_branded_content_creator

instagram_creator_marketplace_discovery

instagram_shopping_tag_products

instagram_manage_upcoming_events

Instagram Public Content Access

Human Agent
Использовать для сценариев, где требуется human intervention в Instagram messaging workflows и необходимо соблюдать соответствующие Meta messaging windows/policies.
Human Agent не означает возможность обходить messaging restrictions.

5. Authentication architecture
   Использовать OAuth Meta.
   Flow:
   Telegram / Admin
   ↓
   Connect Instagram
   ↓
   Meta OAuth
   ↓
   User grants permissions
   ↓
   Meta callback
   ↓
   Exchange authorization code
   ↓
   Access token
   ↓
   Discover business assets
   ↓
   Discover Instagram account
   ↓
   Save account

Credentials Meta не должны попадать в Telegram messages.

6. Token management
   Access tokens хранить encrypted at rest.
   model MetaConnection {
   id String @id @default(cuid())

profileId String

metaUserId String?
instagramUserId String?
facebookPageId String?

accessToken String
tokenType String?
expiresAt DateTime?

scopes Json?

status MetaConnectionStatus @default(ACTIVE)

lastValidatedAt DateTime?
lastErrorAt DateTime?
lastError String?

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
}

Statuses:
ACTIVE
EXPIRED
REVOKED
INVALID
REAUTH_REQUIRED
ERROR
DISABLED

Система должна периодически проверять валидность токена.
При invalid/revoked token:
connection → REAUTH_REQUIRED
↓
Telegram alert
↓
autonomous publishing disabled

7. Instagram Account
   model InstagramAccount {
   id String @id @default(cuid())

instagramUserId String @unique
username String?

accountType InstagramAccountType?

profileId String
connectionId String

status InstagramAccountStatus @default(ACTIVE)

metadata Json?

lastSyncAt DateTime?
lastErrorAt DateTime?
lastError String?

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
}

Account types:
BUSINESS
CREATOR

MVP должен быть ориентирован на Instagram professional account.

8. Удалённый Instagram Worker
   Python service:
   apps/instagram-worker

удаляется.
Вместо него:
packages/meta-client

или:
apps/api/src/integrations/meta

Пример:
apps/api/
src/
integrations/
meta/
meta.client.ts
meta.oauth.ts
meta.webhooks.ts
meta.instagram.ts
meta.insights.ts
meta.messaging.ts
meta.content.ts

Все Graph API операции должны быть изолированы от Agent business logic.
Agent не должен знать детали Graph API.

9. Meta API Client
   Ввести abstraction layer:
   interface InstagramProvider {
   getProfile(): Promise<InstagramProfile>;

createMediaContainer(input: CreateMediaInput): Promise<MediaContainer>;

publishMedia(containerId: string): Promise<PublishedMedia>;

getComments(mediaId: string): Promise<Comment[]>;

replyToComment(
commentId: string,
text: string,
): Promise<CommentReply>;

getConversations(): Promise<Conversation[]>;

getMessages(conversationId: string): Promise<Message[]>;

sendMessage(
recipientId: string,
text: string,
): Promise<Message>;

getInsights(input: InsightsInput): Promise<Insights>;

getMedia(): Promise<InstagramMedia[]>;
}

Agent работает только с этим interface.
Это позволяет в будущем заменить Meta implementation без изменения Agent layer.

10. Graph API versioning
    Graph API version указывать явно.
    META_GRAPH_API_VERSION=vXX.X

Не использовать hardcoded URLs по всему проекту.
Все Graph API requests должны проходить через:
MetaClient

Graph API version обновляется централизованно.
Перед обновлением версии необходимо запускать integration tests.

11. Webhooks
    В отличие от instagrapi, события не должны постоянно polling-иться, если соответствующий webhook доступен.
    Использовать Meta Webhooks для:
    comments
    messages
    mentions
    messaging events
    account events

Архитектура:
Instagram
↓
Meta Webhook
↓
POST /webhooks/meta
↓
verify signature
↓
parse event
↓
idempotency check
↓
Redis/BullMQ
↓
Agent

Webhook endpoint:
GET /webhooks/meta
POST /webhooks/meta

GET используется для verification handshake.
POST используется для events.

12. Webhook security
    Каждый webhook должен:
    проверять Meta signature;
    валидировать payload;
    проверять event source;
    проверять idempotency;
    сохранять raw event;
    передавать event в queue.
    model WebhookEvent {
    id String @id @default(cuid())

provider String
externalId String?

eventType String

payload Json

processed Boolean @default(false)
processedAt DateTime?

createdAt DateTime @default(now())

@@index([provider, externalId])
}

Один webhook event не должен обрабатываться дважды.

13. Content publishing
    Publishing pipeline:
    Content Plan
    ↓
    Claude
    ↓
    Visual Brief
    ↓
    Image/Video Generator
    ↓
    Object Storage
    ↓
    Meta Media Container
    ↓
    Media Processing
    ↓
    Publish
    ↓
    Instagram

Для media publishing не передавать binary file напрямую в Graph API, если конкретный endpoint требует публично доступный media URL.
Object Storage должен предоставлять временный/publicly accessible URL в соответствии с требованиями Meta.

14. Photo publishing
    Flow:
    generated image
    ↓
    S3/R2
    ↓
    temporary media URL
    ↓
    Meta media container
    ↓
    container processing
    ↓
    publish

После успешной публикации:
Post.status = PUBLISHED
Post.instagramId = returnedMediaId

15. Reels
    Flow:
    video generator
    ↓
    Object Storage
    ↓
    video URL
    ↓
    Meta Reel container
    ↓
    poll processing status
    ↓
    publish

Нельзя считать Reel опубликованным сразу после создания container.
Нужно учитывать asynchronous processing:
CREATED
PROCESSING
READY
PUBLISHING
PUBLISHED
FAILED

16. Media processing state
    model MediaPublishJob {
    id String @id @default(cuid())

postId String

containerId String?
instagramMediaId String?

status MediaPublishStatus

errorCode String?
errorMessage String?

attempts Int @default(0)

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
}

17. Stories
    Stories не должны автоматически считаться поддержанными только потому, что аккаунт подключён.
    Перед реализацией Stories необходимо проверить текущую доступность соответствующего Graph API endpoint и permission для выбранного account type.
    Если endpoint доступен:
    Phase 2

Если нет:
deferred

18. Comments
    Комментарии получать двумя способами:
    Webhook

- periodic reconciliation

Webhook обеспечивает near-real-time processing.
Periodic sync нужен как recovery mechanism.
Webhook
↓
Comment event
↓
Queue
↓
Claude
↓
Policy
↓
Reply

19. Comment schema
    model Comment {
    id String @id @default(cuid())

instagramId String @unique

username String?
userId String?

text String

sentiment String?
category String?
aiConfidence Float?

action CommentAction?
replyText String?

replied Boolean @default(false)

requiresHuman Boolean @default(false)

postId String
post Post @relation(fields: [postId], references: [id])

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
}

20. Comment Agent
    Claude получает:
    persona
    comment
    post context
    conversation context
    policy
    recent interaction history

Claude возвращает строго structured JSON:
{
"action": "reply",
"category": "positive",
"confidence": 0.96,
"reply": "Haha, exactly.",
"requiresHuman": false
}

Actions:
reply
ignore
escalate

21. Policy Engine
    Claude никогда напрямую не выполняет Meta API calls.
    Claude
    ↓
    Tool call
    ↓
    Policy Engine
    ↓
    Meta Provider

Например:
const policy = {
publishContent: true,

replyToComments: true,
replyToMessages: true,

deleteContent: false,
followUsers: false,
unfollowUsers: false,
likeContent: false,

sendOutboundColdMessages: false,
};

Policy хранится на backend.
Claude не может изменить policy через prompt.

22. Direct Messages
    DM architecture:
    Instagram
    ↓
    Meta Webhook
    ↓
    POST /webhooks/meta
    ↓
    WebhookEvent
    ↓
    BullMQ
    ↓
    DM Agent
    ↓
    Claude
    ↓
    Policy Engine
    ↓
    Meta Messaging API

Periodic reconciliation используется как fallback там, где это необходимо.

23. DM schema
    model Conversation {
    id String @id @default(cuid())

instagramId String @unique

participantId String?
username String?

category String?
status ConversationStatus @default(ACTIVE)

requiresHuman Boolean @default(false)

lastMessageAt DateTime?

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

messages Message[]
}

model Message {
id String @id @default(cuid())

instagramId String @unique

conversationId String

direction MessageDirection

text String?

aiCategory String?
aiConfidence Float?

requiresHuman Boolean @default(false)

createdAt DateTime @default(now())
}

24. Messaging policies
    Система должна учитывать Meta messaging restrictions.
    Нельзя строить архитектуру вокруг предположения:
    "если у нас есть instagram_business_manage_messages,
    то можно писать любому пользователю в любое время."

Это неверно как архитектурный принцип.
Каждое сообщение должно проходить:
recipient eligibility

- conversation context
- messaging window
- Meta policy
- internal policy

Human Agent используется только в допустимых Meta сценариях.

25. Sensitive messages
    Автоматический ответ запрещается для:
    politics
    medical
    legal
    financial
    threat
    harassment
    personal_data
    sexual_safety
    high_risk

Result:
requiresHuman = true

Telegram:
NEW SENSITIVE DM

@username

Message:
"..."

Category:
LEGAL

Suggested response:
"..."

[Send]
[Edit]
[Ignore]

26. Instagram Insights
    Insights получать через официальный Graph API.
    Сохранять:
    reach
    impressions
    likes
    comments
    shares
    saves
    views
    engagement

Точный набор metrics зависит от типа Instagram media, account type и доступных Meta Insights endpoints.
Нельзя предполагать, что каждая metric доступна для каждого media type.

27. Insights schema
    model PostMetric {
    id String @id @default(cuid())

postId String

metric String
value Float

periodStart DateTime?
periodEnd DateTime?

recordedAt DateTime @default(now())

@@index([postId, metric, recordedAt])
}

Это лучше исходной модели с фиксированными колонками, потому что Meta может добавлять/ограничивать metrics.

28. Account Insights
    Добавить:
    model AccountMetric {
    id String @id @default(cuid())

profileId String

metric String
value Float

periodStart DateTime?
periodEnd DateTime?

recordedAt DateTime @default(now())

@@index([profileId, metric, recordedAt])
}

29. Content strategy
    Strategy Agent анализирует:
    posts
    captions
    comments
    DM
    post metrics
    account metrics
    content types
    topics
    hooks
    publication times

Пример результата:
{
"insights": [
{
"topic": "short captions",
"metric": "engagement",
"change": 0.18
}
],
"recommendations": [
{
"type": "content_format",
"value": "short_caption"
}
]
}

Важно:
Strategy Agent не может напрямую менять системные policies.
Он может менять только:
contentStrategy

30. AI Profile
    model AiProfile {
    id String @id @default(cuid())

name String
username String

persona Json
visualIdentity Json
writingStyle Json
contentStrategy Json

autonomousMode Boolean @default(true)

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
}

31. Character consistency
    Хранить reference assets:
    model MediaReference {
    id String @id @default(cuid())

profileId String

type String
url String
metadata Json?

createdAt DateTime @default(now())
}

Types:
FACE
FULL_BODY
STYLE
OUTFIT
LOCATION
LIGHTING
REFERENCE

Каждая генерация получает:
persona

- visual identity
- reference assets
- current content brief

32. Posts
    model Post {
    id String @id @default(cuid())

instagramId String?

type PostType
status PostStatus

caption String?
mediaUrl String?

scheduledAt DateTime?
publishedAt DateTime?

generation Json?
performance Json?

profileId String
accountId String

comments Comment[]

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@index([profileId, status])
@@index([scheduledAt])
}

33. Publishing state machine
    DRAFT

НЕдоделки
auth — подключение аккаунта
OAuth authorize
callback
обмен code → short-lived token → long-lived token
refresh token
сохранение InstagramAccount + InstagramConnection в PostgreSQL
шифрование access token
проверка/хранение state
profile — почти готов
getProfile()
route → service → client
позже убрать INSTAGRAM_MARKER и брать токен из БД
media — почти готов
список media
pagination через after
получение конкретного media, если понадобится агенту
content — основной блок публикации
image
video
reel
story
carousel
проверка статуса container
publish
обработка ERROR / EXPIRED / IN_PROGRESS / FINISHED / PUBLISHED
затем сохранение Post, MediaAsset, InstagramMediaContainer в БД
comments
У нас уже есть:
list comments
list replies
reply
delete
Осталось:
pagination
нормальные DTO/types
сохранение комментариев в PostgreSQL
webhook для новых комментариев
messages
Нужно закончить:
webhook входящих сообщений
получение sender.id
сохранение DirectThread / DirectMessage
sendMessage()
pagination истории, если используем endpoint истории
обработка 24h messaging window
webhooks
Сейчас это самое непосредственное незавершённое место.
