import { existsSync, mkdir, writeFile } from 'node:fs'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import process from 'node:process'
import fetch from 'node-fetch'
import cac from 'cac'
import pc from 'picocolors'
import type { DirRepoData, FileRepoData, RepoResult } from './type'
import { VERSION, isDirectory, makeSureString } from './utils'

const __root = process.cwd()
interface CLIOptions {
  repo: string
  outDir: string // @default: './'
  token?: string
}
interface ResolvedRepo {
  author: string
  project: string
  branch: string
  type: string
  path: string
  dir: string
  fileName: string
  inputUrl: string
  rootUrl: string
}

const cliOptions: CLIOptions = {
  repo: '',
  outDir: './',
  token: '',
}
const repoResolvedWeakMap = new WeakMap<CLIOptions, ResolvedRepo>()

const cli = cac('cp') // cp => code-picker
const RepoExp = /^https:\/\/github.com\/([^/]+)\/([^/]+)(\/(tree|blob)\/([^/]+)(\/(.*))?)?/

function _resolveUrl(repoUrl: string): ResolvedRepo {
  const matches = repoUrl.match(RepoExp)
  if (matches && matches.length > 0) {
    const root = (matches[5])
      ? `https://github.com/${matches[1]}/${matches[2]}/tree/${matches[5]}`
      : repoUrl
    const path = _filterTailSlash(matches[7] || '')
    const isDir = isDirectory(repoUrl)
    const pathSplitArray = path.split('/')

    return {
      author: matches[1],
      project: matches[2],
      branch: matches[5] || 'main',
      type: matches[4] || '',
      path,
      dir: makeSureString(isDir ? pathSplitArray.slice(-1).pop() : pathSplitArray.slice(-2).shift()),
      fileName: makeSureString(isDir ? '' : pathSplitArray.pop()),
      inputUrl: repoUrl,
      rootUrl: root,
    }
  }
  else {
    throw new Error(`--repo ${repoUrl} is not a legitimate path.`)
  }
}

function _filterTailSlash(str: string) {
  if (str.length && str[str.length - 1] === '/')
    return str.substring(0, str.length - 1)
  return str
}

// import a from './form.vue'
// import a from './form'
//        => import a from './form.js|ts'
//        => import a from './form/index.js|ts'
// export * from './form.ts'
// import './form.ts'
const importUrlRegex = /\s+from\s+['"](.+?)['"]/g
const importWithoutConstRegex = /import\s+['"](.+?)['"]/g

function parseImports(code: string) {
  const results = []
  let match
  // eslint-disable-next-line no-cond-assign
  while ((match = importUrlRegex.exec(code)) !== null) {
    results.push(match[1])
  }
  // eslint-disable-next-line no-cond-assign
  while ((match = importWithoutConstRegex.exec(code)) !== null) {
    results.push(match[1])
  }
  return results
}

const writedFileMap = new Map()
async function _resolveRepos(repoData: FileRepoData | DirRepoData) {
  const resolvedRepo = repoResolvedWeakMap.get(cliOptions)
  if (!resolvedRepo)
    return

  const baseDirPath = resolvedRepo.path.replace(resolvedRepo.fileName, '')
  const restPath = repoData.path.replace(baseDirPath, '')
  const writeDirOrFilePath = path.join(__root, cliOptions.outDir, resolvedRepo.dir, restPath)

  if (repoData.type === 'file') {
    if (existsSync(writeDirOrFilePath)) {
      // todo: 检测文件是否存在，要不要覆盖处理? 还是对比代码?
      if (!writedFileMap.get(writeDirOrFilePath)) {
        console.warn(`${pc.yellow(`File already exists`)} -> ${pc.blue(writeDirOrFilePath)}`)
      }
      return
    }

    if (repoData.content) {
      const buffer = Buffer.from(repoData.content, repoData.encoding)
      const decodedFileCode = buffer.toString('utf8')

      // Check whether the code content has been imported into local files.
      // --repo https://github.com/element-plus/element-plus/tree/dev/packages/components/alert/index.ts
      if (resolvedRepo.fileName) {
        const imports = parseImports(decodedFileCode)
        const localImportFiles = imports.filter(url => url.startsWith('./') || url.startsWith('../'))

        localImportFiles.map((relativePath) => {
          const currentDir = path.dirname(repoData.url)
          const fullPath = path.join(currentDir, relativePath)
          return fullPath
        }).forEach((filePath) => {
          // check whether dir
          if (isDirectory(filePath)) {
            _detectFileInDir(filePath)
          }
          else {
            _fetchGithubRepo(filePath)
          }
        })
      }

      // maybe multi dir
      mkdir(path.dirname(writeDirOrFilePath), { recursive: true }, (err) => {
        if (err) {
          console.error('Create dir error:', err)
        }

        writeFile(writeDirOrFilePath, decodedFileCode, (err) => {
          if (err) {
            console.error(pc.red('Write file error: '), err)
            return
          }
          writedFileMap.set(writeDirOrFilePath, true)
          console.warn(`${pc.green('Create file')} -> ${pc.blue(writeDirOrFilePath)}`)
        })
      })
    }
    else {
      _fetchGithubRepo(repoData.git_url, {
        onProcessData(repoResult) {
          return {
            ...repoResult,
            path: repoData.path,
            type: 'file',
          }
        },
      })
    }
  }
  else if (repoData.type === 'dir') {
    if (!existsSync(writeDirOrFilePath)) {
      mkdir(writeDirOrFilePath, (error) => {
        if (error) {
          console.error(pc.red('Make directory error: '), error)
        }
      })
    }

    _fetchGithubRepo(repoData.url)
  }
}

async function _detectFileInDir(filePath: string) {
  return _fetchGithubRepo(path.dirname(filePath), {
    isScanDirectory: false,
  }).then((res) => {
    if (Array.isArray(res)) {
      const [filePathName] = filePath.split('/').slice(-1)
      const isFind = res.findIndex((item) => {
        const omitFileSuffix = ['.js', '.ts', '.jsx', '.tsx']

        const findSuffix = omitFileSuffix.find(suffix => item.name === `${filePathName}${suffix}`)

        if (findSuffix) {
          _fetchGithubRepo(`${filePath}${findSuffix}`)
          return true
        }
        return false
      })
      if (isFind === -1) {
        // import '/form/src/hooks' => import '/form/src/hooks/index.ts|js'
        _detectFileInDir(`${filePath}/index`)
      }
    }
  }).catch((error) => {
    console.error(pc.red(`No ${filePath} file found in the directory: `), error)
  })
}

function _scanDirectory(result: RepoResult) {
  if (Array.isArray(result)) {
    result.forEach((itemRes) => {
      _resolveRepos(itemRes)
    })
  }
  else {
    _resolveRepos(result as FileRepoData)
  }
}

async function _fetchGithubRepo(scanUrl: string, options: {
  isScanDirectory?: boolean
  onProcessData?: (data: RepoResult) => RepoResult
} = {
  isScanDirectory: true,
  onProcessData: undefined,
}) {
  const { isScanDirectory, onProcessData = undefined } = options

  return fetch(scanUrl, {
    method: 'get',
    headers: cliOptions.token
      ? {
          'X-GitHub-Api-Version': '2022-11-28',
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${cliOptions.token}`,
        }
      : {},
  })
    .then(response => response.json())
    .then((result: any) => {
      if (result?.message) {
        console.error(pc.red(`fetch github repo ${scanUrl} error:`), result)
      }
      else {
        const data: RepoResult = onProcessData ? onProcessData(result) : result
        if (isScanDirectory) {
          _scanDirectory(data)
        }
        return data
      }
    })
    .catch(err => console.error(pc.red(`fetch github repo: ${scanUrl} error:`), err))
}

cli
  .command('[root]', 'pull the github repository code') // default command
  .option('--repo <repository>', `[string] the name of the remote repository (example: 'https://github.com/element-plus/element-plus/tree/dev/packages/components/alert')`)
  .option('--out, --outDir <dir>', `[string] output directory (default: './')`)
  .option('--token <token>', '[string] github access tokens')
  .action(async (root: string, options: CLIOptions) => {
    Object.assign(cliOptions, options)
    // console.log(root, cliOptions)

    if (!options.token) {
      console.warn(`${pc.yellow('We recommend adding your --token ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')}\nThe primary rate limit for unauthenticated requests is 60 requests per hour.\nDetails see: ${pc.blue('https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens')}`)
    }

    // todo: need for support can be multiple repo links.
    const resolvedRepo = _resolveUrl(cliOptions.repo)

    repoResolvedWeakMap.set(cliOptions, resolvedRepo)

    const scanUrl = `https://api.github.com/repos/${resolvedRepo.author}/${resolvedRepo.project}/contents/${resolvedRepo.path}`
    const outputDir = path.resolve(cliOptions.outDir, `${resolvedRepo.dir}`)

    if (!existsSync(outputDir)) {
      mkdir(outputDir, (error) => {
        if (error) {
          console.error(error)
        }
      })
    }

    _fetchGithubRepo(scanUrl)
  })

cli.help()
cli.version(VERSION)

cli.parse()
