// GitHub Git Data API client. Reads live repo content so the admin never shows
// stale dropdowns, and writes content as a single atomic commit to main.
const API = 'https://api.github.com'

const env = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const repo = (): { owner: string; name: string } => {
  const [owner, name] = env('GITHUB_REPO').split('/')
  if (!owner || !name) throw new Error('GITHUB_REPO must be "owner/name"')
  return { owner, name }
}

const BRANCH = process.env.GITHUB_BRANCH ?? 'main'

const gh = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'bluespider-admin',
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new GitHubError(res.status, `${init.method ?? 'GET'} ${path} -> ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export type TreeEntry = { path: string; type: 'blob' | 'tree'; sha: string }

const headSha = async (): Promise<string> => {
  const { owner, name } = repo()
  const ref = await gh<{ object: { sha: string } }>(
    `/repos/${owner}/${name}/git/ref/heads/${BRANCH}`,
  )
  return ref.object.sha
}

const commitTree = async (commitSha: string): Promise<string> => {
  const { owner, name } = repo()
  const commit = await gh<{ tree: { sha: string } }>(
    `/repos/${owner}/${name}/git/commits/${commitSha}`,
  )
  return commit.tree.sha
}

// Full recursive listing of the content tree, used to fill dropdowns and to
// expand a cascade delete into individual blob paths.
export const listTree = async (): Promise<TreeEntry[]> => {
  const { owner, name } = repo()
  const tree = await gh<{ tree: TreeEntry[] }>(
    `/repos/${owner}/${name}/git/trees/${BRANCH}?recursive=1`,
  )
  return tree.tree
}

export const readTextFile = async (path: string): Promise<string | null> => {
  const { owner, name } = repo()
  try {
    const file = await gh<{ content: string; encoding: string }>(
      `/repos/${owner}/${name}/contents/${encodeURI(path)}?ref=${BRANCH}`,
    )
    return Buffer.from(file.content, file.encoding as BufferEncoding).toString('utf-8')
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) return null
    throw err
  }
}

export type FileWrite = { path: string; text?: string; base64?: string }
export type Changeset = { message: string; writes?: FileWrite[]; deletes?: string[] }

// A create-tree entry: inline `content` for new text, a blob `sha` for binary,
// `sha: null` to delete the path against the base tree.
type TreeNode = {
  path: string
  mode: '100644'
  type: 'blob'
} & ({ content: string } | { sha: string } | { sha: null })

const buildTreeNodes = async (changeset: Changeset): Promise<TreeNode[]> => {
  const { owner, name } = repo()
  const nodes: TreeNode[] = []
  for (const write of changeset.writes ?? []) {
    const base = { path: write.path, mode: '100644', type: 'blob' } as const
    if (write.base64 !== undefined) {
      const blob = await gh<{ sha: string }>(`/repos/${owner}/${name}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: write.base64, encoding: 'base64' }),
      })
      nodes.push({ ...base, sha: blob.sha })
    } else {
      nodes.push({ ...base, content: write.text ?? '' })
    }
  }
  for (const path of changeset.deletes ?? []) {
    nodes.push({ path, mode: '100644', type: 'blob', sha: null })
  }
  return nodes
}

const attempt = async (changeset: Changeset, nodes: TreeNode[]): Promise<string> => {
  const { owner, name } = repo()
  const base = await headSha()
  const baseTree = await commitTree(base)
  const tree = await gh<{ sha: string }>(`/repos/${owner}/${name}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree: nodes }),
  })
  const commit = await gh<{ sha: string }>(`/repos/${owner}/${name}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: changeset.message, tree: tree.sha, parents: [base] }),
  })
  await gh(`/repos/${owner}/${name}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  })
  return commit.sha
}

// Commit all changes atomically. A node carrying `content` is a fresh blob the
// tree call inlines; binary writes are uploaded as blobs first; deletes set the
// path's sha to null against the base tree. On a ref-update race, refetch head
// and retry once.
export const commitChangeset = async (changeset: Changeset): Promise<string> => {
  const nodes = await buildTreeNodes(changeset)
  try {
    return await attempt(changeset, nodes)
  } catch (err) {
    if (err instanceof GitHubError && (err.status === 409 || err.status === 422)) {
      return attempt(changeset, nodes)
    }
    throw err
  }
}
