/**
 * Presenters that shape raw Asana SDK objects into the trimmed views the CLI
 * prints. Shared by the resource commands (`task get`, `project get`,
 * `comment list`) and `asana fetch` so a URL fetch renders identically to the
 * direct command.
 */

export interface TaskView {
  gid: string
  name?: string
  completed?: boolean
  assignee?: string
  due_on?: string
  notes?: string
  permalink_url?: string
}

export function toTaskView(task: any): TaskView {
  if (!task) {
    throw new Error('Invalid task data provided to toTaskView')
  }
  return {
    gid: task.gid,
    name: task.name,
    completed: task.completed,
    assignee: task.assignee?.name,
    due_on: task.due_on,
    notes: task.notes,
    permalink_url: task.permalink_url,
  }
}

export interface ProjectView {
  gid: string
  name?: string
  archived?: boolean
  color?: string
  notes?: string
  public?: boolean
  permalink_url?: string
}

export function toProjectView(project: any): ProjectView {
  if (!project) {
    throw new Error('Invalid project data provided to toProjectView')
  }
  return {
    gid: project.gid,
    name: project.name,
    archived: project.archived,
    color: project.color,
    notes: project.notes,
    public: project.public,
    permalink_url: project.permalink_url,
  }
}

export interface CommentView {
  gid: string
  created_at?: string
  created_by?: string
  text?: string
}

// Stories include system events (assignments, status changes); request the
// subtype so we can keep only user comments.
export const COMMENT_FIELDS = {
  opt_fields: 'text,html_text,created_at,created_by.name,resource_subtype',
}

export const COMMENT_SUBTYPE = 'comment_added'

/**
 * Keep only user comments from a task's stories and shape them for output.
 */
export function toCommentViews(stories: any[]): CommentView[] {
  return (stories || [])
    .filter(story => story?.resource_subtype === COMMENT_SUBTYPE)
    .map(story => ({
      gid: story.gid,
      created_at: story.created_at,
      created_by: story.created_by?.name,
      text: story.text,
    }))
}
