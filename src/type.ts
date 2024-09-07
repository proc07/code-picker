interface BaseRepoInfo {
  encoding: 'base64'
  name: string
  path: string
  html_url: string //  "https://github.com/element-plus/element-plus/tree/dev/packages/components/alert",
  url: string // "https://api.github.com/repos/element-plus/element-plus/contents/packages/components/alert/index.ts?ref=dev",
  git_url: string // "https://api.github.com/repos/element-plus/element-plus/git/blobs/bfcd58ac678a7b6394ac25139c738b08ab7b809c",
}
export interface FileRepoData extends BaseRepoInfo {
  type: 'file'
  content: string // base64
  download_url: string // e.g. https://raw.githubusercontent.com/element-plus/element-plus/dev/index.ts
}
export interface DirRepoData extends BaseRepoInfo {
  type: 'dir'
}
export type RepoResult = FileRepoData | Array<DirRepoData | FileRepoData>
