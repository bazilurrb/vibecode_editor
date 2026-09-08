export interface User {
    id: string
    name: string
    email: string
    image: string
    role: string
    createdAt: Date
    updatedAt: Date
  }
  
  export interface Project {
    id: string
    title: string
    description: string
    template: string
    createdAt: Date
    updatedAt: Date
    userId: string
    user: User
    Starmark: { isMarked: boolean }[]
  }

  export interface GithubRepoItem {
    id: number
    name: string
    fullName: string
    description: string | null
    isPrivate: boolean
    htmlUrl: string
    defaultBranch: string
    language: string | null
    stargazersCount: number
    forksCount: number
    updatedAt: string
    owner: {
      login: string
      avatarUrl: string
    }
  }

  export interface GetUserReposResponse {
    hasGithubConnected: boolean
    repos: GithubRepoItem[]
    error?: string
  }

  export interface ImportGithubRepoParams {
    owner: string
    repo: string
    branch?: string
    customTitle?: string
  }

  export interface ImportGithubRepoResponse {
    success: boolean
    playgroundId?: string
    error?: string
  }
  