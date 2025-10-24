# Asana Node.js Client Documentation

This document provides a comprehensive reference for the Asana Node.js client library used in this project.

## Official Documentation

- **Repository**: [Asana/node-asana](https://github.com/Asana/node-asana)
- **Documentation**: [GitHub Docs](https://github.com/Asana/node-asana/tree/master/docs)
- **npm Package**: [@asana/asana](https://www.npmjs.com/package/asana)

## Installation

```bash
bun add asana
```

## Authentication

The Asana Node.js client supports two authentication methods:

### 1. Personal Access Token (PAT)

```typescript
import asana from 'asana'

const client = asana.Client.create({
  defaultHeaders: { 'asana-enable': 'new_user_task_lists' }
}).useAccessToken('YOUR_PERSONAL_ACCESS_TOKEN')
```

### 2. OAuth 2.0

```typescript
import asana from 'asana'

const client = asana.Client.create({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'http://localhost:8080/callback'
})

// Get authorization URL
const authUrl = client.app.asanaAuthorizeUrl()

// Exchange code for token
const credentials = await client.app.accessTokenFromCode('AUTH_CODE')
client.useOauth({ credentials })
```

## Core Resource APIs

### Tasks API

Manage tasks with full CRUD operations.

```typescript
// Create a task
const task = await client.tasks.createTask({
  workspace: 'workspace_gid',
  name: 'New Task',
  notes: 'Task description',
  assignee: 'user_gid',
  due_on: '2025-12-31'
})

// Get task
const taskDetails = await client.tasks.getTask('task_gid')

// Update task
await client.tasks.updateTask('task_gid', {
  completed: true
})

// Delete task
await client.tasks.deleteTask('task_gid')

// List tasks
const tasks = await client.tasks.getTasks({
  assignee: 'me',
  workspace: 'workspace_gid',
  completed_since: 'now'
})
```

**Reference**: [TasksApi.md](https://github.com/Asana/node-asana/blob/master/docs/TasksApi.md)

### Projects API

Manage projects and project memberships.

```typescript
// Create project
const project = await client.projects.createProject({
  workspace: 'workspace_gid',
  name: 'New Project',
  notes: 'Project description',
  color: 'light-green'
})

// Get project
const projectDetails = await client.projects.getProject('project_gid')

// List project tasks
const projectTasks = await client.tasks.getTasksForProject('project_gid')

// Add task to project
await client.tasks.addProjectForTask('task_gid', {
  project: 'project_gid'
})
```

**Reference**: [ProjectsApi.md](https://github.com/Asana/node-asana/blob/master/docs/ProjectsApi.md)

### Workspaces API

Manage workspaces and workspace settings.

```typescript
// List workspaces
const workspaces = await client.workspaces.getWorkspaces()

// Get workspace
const workspace = await client.workspaces.getWorkspace('workspace_gid')

// List workspace users
const users = await client.users.getUsersForWorkspace('workspace_gid')
```

**Reference**: [WorkspacesApi.md](https://github.com/Asana/node-asana/blob/master/docs/WorkspacesApi.md)

### Users API

Access user information and task lists.

```typescript
// Get current user
const me = await client.users.getUser('me')

// Get specific user
const user = await client.users.getUser('user_gid')

// List users in workspace
const workspaceUsers = await client.users.getUsersForWorkspace('workspace_gid')

// Get user's task list
const userTaskList = await client.userTaskLists.getUserTaskListForUser('user_gid', {
  workspace: 'workspace_gid'
})
```

**Reference**: [UsersApi.md](https://github.com/Asana/node-asana/blob/master/docs/UsersApi.md)

## Advanced Features

### Custom Fields

Add and manage custom fields on tasks.

```typescript
// List custom fields for workspace
const customFields = await client.customFields.getCustomFieldsForWorkspace('workspace_gid')

// Create custom field
const customField = await client.customFields.createCustomField({
  workspace: 'workspace_gid',
  resource_type: 'custom_field',
  name: 'Priority',
  type: 'enum',
  enum_options: [
    { name: 'High', color: 'red' },
    { name: 'Medium', color: 'yellow' },
    { name: 'Low', color: 'green' }
  ]
})

// Set custom field value on task
await client.tasks.updateTask('task_gid', {
  custom_fields: {
    [customField.gid]: 'enum_option_gid'
  }
})
```

**Reference**: [CustomFieldsApi.md](https://github.com/Asana/node-asana/blob/master/docs/CustomFieldsApi.md)

### Tags

Organize tasks with tags.

```typescript
// Create tag
const tag = await client.tags.createTag({
  workspace: 'workspace_gid',
  name: 'urgent'
})

// Add tag to task
await client.tasks.addTagForTask('task_gid', {
  tag: 'tag_gid'
})

// Remove tag from task
await client.tasks.removeTagForTask('task_gid', {
  tag: 'tag_gid'
})

// List tasks with tag
const taggedTasks = await client.tasks.getTasksForTag('tag_gid')
```

**Reference**: [TagsApi.md](https://github.com/Asana/node-asana/blob/master/docs/TagsApi.md)

### Attachments

Upload and manage file attachments.

```typescript
// Upload attachment
const attachment = await client.attachments.createAttachmentForObject({
  resource: 'task_gid',
  file: fileStream,
  name: 'document.pdf'
})

// Get attachment
const attachmentDetails = await client.attachments.getAttachment('attachment_gid')

// List attachments for task
const attachments = await client.attachments.getAttachmentsForObject('task_gid')

// Delete attachment
await client.attachments.deleteAttachment('attachment_gid')
```

**Reference**: [AttachmentsApi.md](https://github.com/Asana/node-asana/blob/master/docs/AttachmentsApi.md)

### Stories (Comments)

Add comments and activity to tasks.

```typescript
// Create story (comment)
const story = await client.stories.createStoryForTask('task_gid', {
  text: 'This is a comment'
})

// List stories for task
const stories = await client.stories.getStoriesForTask('task_gid')

// Get story
const storyDetails = await client.stories.getStory('story_gid')

// Delete story
await client.stories.deleteStory('story_gid')
```

**Reference**: [StoriesApi.md](https://github.com/Asana/node-asana/blob/master/docs/StoriesApi.md)

### Webhooks

Subscribe to real-time events.

```typescript
// Create webhook
const webhook = await client.webhooks.createWebhook({
  resource: 'project_gid',
  target: 'https://example.com/webhook'
})

// Get webhook
const webhookDetails = await client.webhooks.getWebhook('webhook_gid')

// List webhooks
const webhooks = await client.webhooks.getWebhooks({
  workspace: 'workspace_gid'
})

// Delete webhook
await client.webhooks.deleteWebhook('webhook_gid')
```

**Reference**: [WebhooksApi.md](https://github.com/Asana/node-asana/blob/master/docs/WebhooksApi.md)

### Events API

Poll for changes to resources.

```typescript
// Get events for resource
const events = await client.events.getEvents({
  resource: 'project_gid',
  sync: 'sync_token'
})

// Process events
events.data.forEach((event) => {
  console.log(`Event: ${event.action} on ${event.resource.resource_type}`)
})

// Use new sync token for next poll
const nextSync = events.sync
```

**Reference**: [EventsApi.md](https://github.com/Asana/node-asana/blob/master/docs/EventsApi.md)

### Batch API

Execute multiple API operations in a single request.

```typescript
// Batch request
const batchResponse = await client.batch.createBatchRequest({
  data: {
    operations: [
      {
        method: 'GET',
        relative_path: '/users/me'
      },
      {
        method: 'POST',
        relative_path: '/tasks',
        data: {
          workspace: 'workspace_gid',
          name: 'New Task'
        }
      }
    ]
  }
})

// Process responses
batchResponse.data.forEach((response, index) => {
  if (response.status_code === 200 || response.status_code === 201) {
    console.log(`Operation ${index} succeeded:`, response.body)
  }
  else {
    console.error(`Operation ${index} failed:`, response.body)
  }
})
```

**Reference**: [BatchAPIApi.md](https://github.com/Asana/node-asana/blob/master/docs/BatchAPIApi.md)

## Pagination

Handle paginated responses for large result sets.

```typescript
// Manual pagination
let offset
let allTasks = []

do {
  const response = await client.tasks.getTasks({
    assignee: 'me',
    workspace: 'workspace_gid',
    limit: 100,
    offset
  })

  allTasks = allTasks.concat(response.data)
  offset = response.next_page?.offset
} while (offset)

// Using collection iterator
const tasks = await client.tasks.getTasks({
  assignee: 'me',
  workspace: 'workspace_gid'
})

for await (const task of tasks) {
  console.log(task.name)
}
```

## Error Handling

Handle API errors gracefully.

```typescript
try {
  const task = await client.tasks.getTask('invalid_gid')
}
catch (error) {
  if (error.status === 404) {
    console.error('Task not found')
  }
  else if (error.status === 401) {
    console.error('Authentication failed')
  }
  else if (error.status === 429) {
    console.error('Rate limit exceeded')
    // Implement retry with exponential backoff
  }
  else {
    console.error('API error:', error.message)
  }
}
```

## Rate Limiting

Asana API has rate limits to ensure service stability:

- **Standard**: 1,500 requests per minute
- **Premium**: 150,000 requests per hour

Best practices:

- Implement exponential backoff for 429 errors
- Use batch API for multiple operations
- Cache frequently accessed data
- Monitor `X-RateLimit-*` headers in responses

## Best Practices

### 1. Use TypeScript Types

```typescript
import type { TasksApiGetTaskRequest } from 'asana'

const params: TasksApiGetTaskRequest = {
  task_gid: 'task_gid',
  opt_fields: ['name', 'completed', 'assignee', 'due_on']
}

const task = await client.tasks.getTask(params)
```

### 2. Optimize API Calls with opt_fields

Request only the fields you need to reduce payload size:

```typescript
// ❌ Don't fetch all fields
const task = await client.tasks.getTask('task_gid')

// ✅ Request specific fields
const task = await client.tasks.getTask('task_gid', {
  opt_fields: ['name', 'completed', 'assignee.name', 'due_on']
})
```

### 3. Handle Pagination Efficiently

```typescript
// For large datasets, use streaming
const tasks = await client.tasks.getTasks({
  project: 'project_gid',
  limit: 100
})

for await (const task of tasks) {
  // Process task incrementally
  await processTask(task)
}
```

### 4. Implement Retry Logic

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    }
    catch (error: any) {
      lastError = error

      if (error.status === 429) {
        const delay = 2 ** i * 1000 // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      throw error
    }
  }

  throw lastError!
}

// Usage
const task = await retryWithBackoff(() =>
  client.tasks.getTask('task_gid')
)
```

### 5. Use Environment-Specific Configuration

```typescript
const client = asana.Client.create({
  defaultHeaders: {
    'asana-enable': 'new_user_task_lists',
    'asana-disable': 'string_ids'
  },
  logAsanaChangeWarnings: process.env.NODE_ENV === 'development'
}).useAccessToken(process.env.ASANA_ACCESS_TOKEN!)
```

## Complete API Reference

### Resource APIs

- [TasksApi](https://github.com/Asana/node-asana/blob/master/docs/TasksApi.md) - Task management
- [ProjectsApi](https://github.com/Asana/node-asana/blob/master/docs/ProjectsApi.md) - Project management
- [WorkspacesApi](https://github.com/Asana/node-asana/blob/master/docs/WorkspacesApi.md) - Workspace management
- [UsersApi](https://github.com/Asana/node-asana/blob/master/docs/UsersApi.md) - User information
- [TeamsApi](https://github.com/Asana/node-asana/blob/master/docs/TeamsApi.md) - Team management
- [PortfoliosApi](https://github.com/Asana/node-asana/blob/master/docs/PortfoliosApi.md) - Portfolio management

### Feature APIs

- [CustomFieldsApi](https://github.com/Asana/node-asana/blob/master/docs/CustomFieldsApi.md) - Custom field management
- [TagsApi](https://github.com/Asana/node-asana/blob/master/docs/TagsApi.md) - Tag management
- [AttachmentsApi](https://github.com/Asana/node-asana/blob/master/docs/AttachmentsApi.md) - File attachments
- [StoriesApi](https://github.com/Asana/node-asana/blob/master/docs/StoriesApi.md) - Comments and activity
- [SectionsApi](https://github.com/Asana/node-asana/blob/master/docs/SectionsApi.md) - Project sections
- [StatusUpdatesApi](https://github.com/Asana/node-asana/blob/master/docs/StatusUpdatesApi.md) - Status updates

### Advanced APIs

- [WebhooksApi](https://github.com/Asana/node-asana/blob/master/docs/WebhooksApi.md) - Real-time events
- [EventsApi](https://github.com/Asana/node-asana/blob/master/docs/EventsApi.md) - Event polling
- [BatchAPIApi](https://github.com/Asana/node-asana/blob/master/docs/BatchAPIApi.md) - Batch operations
- [GoalsApi](https://github.com/Asana/node-asana/blob/master/docs/GoalsApi.md) - Goal management
- [RulesApi](https://github.com/Asana/node-asana/blob/master/docs/RulesApi.md) - Automation rules
- [TimeTrackingEntriesApi](https://github.com/Asana/node-asana/blob/master/docs/TimeTrackingEntriesApi.md) - Time tracking

## Project-Specific Usage

This project implements an Asana CLI using the Node.js client. See:

- [AsanaClient implementation](../src/lib/asana-client.ts) - Client wrapper with error handling
- [Environment Setup](./ENVIRONMENT_SETUP.md) - Configuration guide
- [E2E Tests](../tests/e2e/README.md) - Usage examples

## Additional Resources

- [Asana API Documentation](https://developers.asana.com/docs)
- [OAuth 2.0 Guide](https://developers.asana.com/docs/getting-started-with-asana-oauth)
- [Personal Access Token Guide](https://developers.asana.com/docs/personal-access-token)
- [API Rate Limits](https://developers.asana.com/docs/rate-limits)
- [Webhook Guide](https://developers.asana.com/docs/webhooks-guide)
