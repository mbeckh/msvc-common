'use strict';
const core = require('@actions/core');
const exec = require('@actions/exec');
const cache = require('@actions/cache');
const github = require('@actions/github');
const glob = require('@actions/glob');
const io = require('@actions/io');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const env = process.env;
const tempPath = '.mbeckh';

const MSBUILD_PATH = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\MSBuild\\Current\\Bin\\MSBuild.exe';
const CL_PATH = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Tools\\MSVC\\*\\bin\\Hostx64\\x64\\cl.exe';
const CLANGTIDY_PATH = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Tools\\Llvm\\x64\\bin\\clang-tidy.exe';

// Normalize functions do not change separators, so add additional version
path.posix.forceNormalize = function(filePath) {
  return path.posix.normalize(filePath).replace(/\\/g, '/');
};
path.win32.forceNormalize = function(filePath) {
  return path.win32.normalize(filePath).replace(/\//g, '\\');
};
path.forceNormalize = path.sep === '/' ? path.posix.forceNormalize : path.win32.forceNormalize;

async function saveCache(paths, key) {
  try {
    return await cache.saveCache(paths.map((e) => path.posix.forceNormalize(e)), key);
  } catch (error) {
    // failures in caching should not abort the job
    core.warning(error.message);
  }
  return null;
}

async function restoreCache(paths, key, altKeys) {
  try {
    return await cache.restoreCache(paths.map((e) => path.posix.forceNormalize(e)), key, altKeys);
  } catch (error) {
    // failures in caching should not abort the job
    core.warning(error.message);
  }
  return null;
}

async function setupOpenCppCoverage() {
  const toolPath = path.join(tempPath, 'OpenCppCoverage');
  
  core.startGroup('Installing OpenCppCoverage');
  // Install "by hand" because running choco on github is incredibly slow
  core.info('Getting latest release for OpenCppCoverage');

  const githubToken = core.getInput('github-token', { 'required': true });
  core.setSecret(githubToken);

  const octokit = github.getOctokit(githubToken);
  const { data: release } = await octokit.repos.getLatestRelease({ 'owner':'OpenCppCoverage', 'repo': 'OpenCppCoverage' });
  const asset = release.assets.filter((e) => /-x64-.*\.exe$/.test(e.name))[0];
  const key = `opencppcoverage-${asset.id}`;

  if (await restoreCache([ toolPath ], key)) {
    core.info(`Found ${release.name} in ${toolPath}`);
  } else {
    {
      core.info('Getting latest release for innoextract');
      const { data: release } = await octokit.repos.getLatestRelease({ 'owner':'dscharrer', 'repo': 'innoextract' });
      const asset = release.assets.filter((e) => /-windows\.zip$/.test(e.name))[0];
      core.info(`Downloading ${release.name} from ${asset.browser_download_url}`);
      
      const downloadPath = path.join(tempPath, asset.name);
      await exec.exec('curl', [ '-s', '-S', '-L', `-o${downloadPath}`, '--create-dirs', asset.browser_download_url ]);
      core.info('Unpacking innoextract');
      await exec.exec('7z', [ 'x', '-aos', `-o${tempPath}`, downloadPath, 'innoextract.exe' ]);
    }

    core.info(`Downloading ${release.name} from ${asset.browser_download_url}`);

    const downloadPath = path.join(tempPath, asset.name);
    await exec.exec('curl', [ '-s', '-S', '-L', `-o${downloadPath}`, '--create-dirs', asset.browser_download_url ]);
    core.info('Unpacking OpenCppCoverage');
    await exec.exec(path.join(tempPath, 'innoextract'), [ '-e', '-m', '--output-dir', toolPath, downloadPath ]);

    await saveCache([ toolPath ], key);
    core.info(`Installed ${release.name} at ${toolPath}`);
  }
  core.endGroup();
  const binPath = path.resolve(toolPath, 'app');
  core.addPath(binPath);
  return path.join(binPath, 'OpenCppCoverage.exe');
}

async function setupCodacyClangTidy() {
  const toolPath = path.join(tempPath, 'codacy-clang-tidy');

  core.startGroup('Installing codacy-clang-tidy');
  core.info('Getting latest release for codacy-clang-tidy');

  const githubToken = core.getInput('github-token', { 'required': true });
  core.setSecret(githubToken);

  const octokit = github.getOctokit(githubToken);
  const { data: release } = await octokit.repos.getLatestRelease({ 'owner':'codacy', 'repo': 'codacy-clang-tidy' });
  const asset = release.assets.filter((e) => /\.jar$/.test(e.name))[0];
  const key = `codacy-clang-tidy-${asset.id}`;
  
  if (await restoreCache([ toolPath ], key)) {
    core.info(`Found codacy-clang-tidy ${release.tag_name} in cache at ${toolPath}`);
  } else {
    core.info(`Downloading codacy-clang-tidy ${release.tag_name} from ${asset.browser_download_url}`);

    await exec.exec('curl', [ '-s', '-S', '-L', `-o${path.join(toolPath, asset.name)}`, '--create-dirs', asset.browser_download_url ]);
    await saveCache([ toolPath ], key);
    core.info(`Downloaded codacy-clang-tidy ${release.tag_name} at ${toolPath}`);
  }
  core.endGroup();
  return path.join(toolPath, asset.name);
}

function getRepositoryName() {
  return env.GITHUB_REPOSITORY.substring(env.GITHUB_REPOSITORY.indexOf('/') + 1);
}

function getSolutionPath() {
  const solutionPath = path.posix.forceNormalize(core.getInput('solution-path')).replace(/\/+$/, ''); // remove trailing slashes
  return path.forceNormalize(solutionPath);
}

function getProjects() {
  return core.getInput('projects', { 'required': true }).split(/\s*[,;\n]\s*/).filter((e) => e !== '');
}

exports.build = async function() {
  try {
    const solutionPath = getSolutionPath();
    const solutionName = getRepositoryName();
    const projects = getProjects();
    const configuration = core.getInput('configuration', { 'required': true });
    const platform = core.getInput('platform');

    core.startGroup(`Building projects ${projects.join(', ')}`);
    await exec.exec(`"${MSBUILD_PATH}"`, [ `${solutionName}.sln`, '/m', `/t:${projects.join(';')}`, `/p:Configuration=${configuration}`, `/p:Platform=${platform}` ], { 'cwd': solutionPath });
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
};

exports.run = async function() {
  try {
    const solutionPath = getSolutionPath();
    const projects = getProjects();
    const configuration = core.getInput('configuration', { 'required': true });
    const suffix = configuration === 'Debug' ? 'd' : '';
    const platform = core.getInput('platform');

    for (const project of projects) {
      core.startGroup(`Running ${project}`);
      await exec.exec(path.join(env.GITHUB_WORKSPACE, solutionPath, 'bin', `${project}_${platform}${suffix}`), [ ], { 'cwd': path.join(solutionPath, 'bin') });
      core.endGroup();
    }
  } catch (error) {
    core.setFailed(error.message);
  }
};

exports.coverage = async function() {
  try {
    await setupOpenCppCoverage();

    const solutionPath = getSolutionPath();
    const projects = getProjects();
    const configuration = core.getInput('configuration', { 'required': true });
    const suffix = configuration === 'Debug' ? 'd' : '';
    const platform = core.getInput('platform');
    const codacyToken = core.getInput('codacy-token', { 'required': true });
    core.setSecret(codacyToken);

    core.startGroup('Loading codacy coverage reporter');
    const codacyScript = '.codacy-coverage.sh';
    await exec.exec('curl', ['-s', '-S', '-L', `-o${codacyScript}`, 'https://coverage.codacy.com/get.sh' ]);
    const file = fs.readFileSync(codacyScript);
    const hash = crypto.createHash('sha256');
    hash.update(file);
    const hex = hash.digest('hex');
          
    const codacyCacheKey = `codacy-coverage-${hex}`;
    const codacyCoverageCacheId = await restoreCache([ '.codacy-coverage' ], codacyCacheKey, [ 'codacy-coverage-' ]);
    if (codacyCoverageCacheId) {
      core.info('.codacy-coverage is found in cache');
    }
    core.endGroup();
      
    for (const project of projects) {
      core.startGroup('Getting code coverage');
      const rootPath = path.join(env.GITHUB_WORKSPACE, solutionPath, path.sep);
      await exec.exec('OpenCppCoverage',
                      [`--modules=${rootPath}`,
                       `--excluded_modules=${path.join(rootPath, 'lib', path.sep)}`,
                       `--sources=${rootPath}`,
                       `--excluded_sources=${path.join(rootPath, 'lib', path.sep)}`,
                       `--excluded_sources=${path.join(rootPath, 'test', path.sep)}`,
                       `--export_type=cobertura:${project}_coverage.xml`,
                       '--', `${project}_${platform}${suffix}` ], { 'cwd': path.join(solutionPath, 'bin') });
      core.endGroup();
    }

    core.startGroup('Sending coverage to codecov');
    await exec.exec('bash', [ '-c', `bash <(curl -sS https://codecov.io/bash) -Z -f '${path.posix.join(solutionPath, 'bin', '*_coverage.xml')}'` ]);
    core.endGroup();

    core.startGroup('Sending coverage to codacy');
    await exec.exec('bash', [ '-c', `./${codacyScript} report -r '${path.posix.join(path.posix.forceNormalize(solutionPath), 'bin', '*_coverage.xml')}' -t ${codacyToken} --commit-uuid ${env.GITHUB_SHA}` ]);

    if (!codacyCoverageCacheId) {
      await saveCache([ '.codacy-coverage' ], codacyCacheKey);
      core.info('Added .codacy-coverage to cache');
    }
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
};

function getExclusions() {
  let exclusions = [ `!${tempPath}`, '!lib', '!msvc-common' ];
  if (fs.accessSync('.codacy.yml', fs.constants.R_OK)) {
    const codacyFile = fs.readFileSync('.codacy.yml');
    const codacyData = yaml.safeLoad(codacyFile);
    if (codacyData.exclude_paths) {
      Array.prototype.push.apply(exclusions, codacyData.exclude_paths);
    }
    // be prepared for future enhancement...
    if (codacyData.engines && codacyData.engines['clang-tidy'] && codacyData.engines['clang-tidy'].exclude_paths) {
      Array.prototype.push.apply(exclusions, codacyData.engines['clang-tidy'].exclude_paths);
    }
    if (exclusions.length > 3) {
      core.info(`Using ${exclusions.length - 3} exclusions from .codacy.yml: ${exclusions.slice(3).join(` ${path.delimiter} `)}`);
    }
  }
  return exclusions;
}

exports.analyzeClangTidy = async function() {
  try {
    const id = core.getInput('id', { 'required': true });
    const clangArgs = core.getInput('clang-args');

    core.startGroup('Getting version of MSVC compiler');
    const clGlobber = await glob.create(CL_PATH);
    const cl = await clGlobber.glob();
    
    const logPath = path.join(tempPath, 'clang-tidy');
    fs.mkdirSync(logPath, { 'recursive': true });

    const versionFilePath = path.join(tempPath, 'msc-version.cpp');
    fs.writeFileSync(versionFilePath, '_MSC_VER');
    let version = '';
    await exec.exec(`"${cl[0]}"`, [ '/EP', versionFilePath ], { 'listeners': { 'stdout': (data) => version += data.toString() }});
    version = /([0-9]+)/.exec(version)[1];
    core.endGroup();
    
    const sourceGlobber = await glob.create([ '**/*.c', '**/*.cc', '**/*.cpp', '**/*.cxx' ].concat(getExclusions()).join('\n'));
    const workspace = env.GITHUB_WORKSPACE;

    const cpus = os.cpus().length;
    core.startGroup(`Running code analysis with ${cpus} threads`);
    const throat = require('throat')(cpus);
    let processes = [ ];
    let index = 0;
    for await (const file of sourceGlobber.globGenerator()) {
      const logFile = `${path.basename(file).replace('.', '_')}-${id}-${index++}.log`;
      const args = `--system-header-prefix=lib/ -Wall -Wmicrosoft -fmsc-version=${version} -fms-extensions -fms-compatibility -fdelayed-template-parsing -D_CRT_USE_BUILTIN_OFFSETOF ${clangArgs}`;
      const output = fs.openSync(path.join(logPath, logFile), 'ax'); 
      const promise = throat(
        () => exec.exec(`"${CLANGTIDY_PATH}" --header-filter="^(?!lib/.*$).*" ${path.relative(workspace, file)} -- ${args}`,
          [ ], { 'windowsVerbatimArguments': true, 'ignoreReturnCode': true, 'listeners': { 'stdout': (data) => fs.appendFileSync(output, data) }})
          .finally(() => fs.closeSync(output)));
      processes.push(promise);
    }
    await Promise.all(processes);
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
};

exports.analyzeReport = async function() {
  try {
    const toolPath = await setupCodacyClangTidy();

    const codacyToken = core.getInput('codacy-token', { 'required': true });
    core.setSecret(codacyToken);

    core.startGroup('Sending code analysis to codacy');
    const logFile = path.posix.join(tempPath, 'clang-tidy.json');
    await exec.exec('bash', [ '-c', `find ${path.posix.join(tempPath, 'clang-tidy', path.posix.sep)} -maxdepth 1 -name '*.log' -exec cat {} \\; | java -jar ${path.posix.forceNormalize(toolPath)} | sed -r -e "s#[\\\\]{2}#/#g" > ${logFile}` ]);
    await exec.exec('bash', [ '-c', `curl -s -S -XPOST -L -H "project-token: ${codacyToken}" -H "Content-type: application/json" -w "\\n" -d @${logFile} "https://api.codacy.com/2.0/commit/${env.GITHUB_SHA}/issuesRemoteResults"` ]);
    await exec.exec('bash', [ '-c', `curl -s -S -XPOST -L -H "project-token: ${codacyToken}" -H "Content-type: application/json" -w "\\n" "https://api.codacy.com/2.0/commit/${env.GITHUB_SHA}/resultsFinal"` ]);
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
};
