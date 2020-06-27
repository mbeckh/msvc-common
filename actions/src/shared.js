'use strict';
const core = require('@actions/core');
const exec = require('@actions/exec');
const cache = require('@actions/cache');
const github = require('@actions/github');
const glob = require('@actions/glob');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const yaml = require('js-yaml');

const env = process.env;
const TEMP_PATH = '.mbeckh';
const OUTPUT_PATH = 'output';
const COVERAGE_PATH = 'coverage';

const MSBUILD_PATH = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\MSBuild\\Current\\Bin\\MSBuild.exe';
const CL_PATH = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Tools\\MSVC\\*\\bin\\Hostx64\\x64\\cl.exe';
const CLANGTIDY_PATH = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Tools\\Llvm\\x64\\bin\\clang-tidy.exe';

// Normalize functions do not change separators, so add additional version
function forcePosix(filePath) {
  return path.posix.normalize(filePath).replace(/\\/g, '/');
}
function forceWin32(filePath) {
  return path.win32.normalize(filePath).replace(/\//, '\\');
}
const forceNative = path.sep === '/' ? forcePosix : forceWin32;

async function saveCache(paths, key) {
  try {
    return await cache.saveCache(paths.map((e) => forcePosix(e)), key);
  } catch (error) {
    // failures in caching should not abort the job
    core.warning(error.message);
  }
  return null;
}

async function restoreCache(paths, key, altKeys) {
  try {
    return await cache.restoreCache(paths.map((e) => forcePosix(e)), key, altKeys);
  } catch (error) {
    // failures in caching should not abort the job
    core.warning(error.message);
  }
  return null;
}

async function setupOpenCppCoverage() {
  const toolPath = path.join(TEMP_PATH, 'OpenCppCoverage');
  
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
      
      const downloadPath = path.join(TEMP_PATH, asset.name);
      await exec.exec('curl', [ '-s', '-S', '-L', `-o${downloadPath}`, '--create-dirs', asset.browser_download_url ]);
      core.info('Unpacking innoextract');
      await exec.exec('7z', [ 'x', '-aos', `-o${TEMP_PATH}`, downloadPath, 'innoextract.exe' ]);
    }

    core.info(`Downloading ${release.name} from ${asset.browser_download_url}`);

    const downloadPath = path.join(TEMP_PATH, asset.name);
    await exec.exec('curl', [ '-s', '-S', '-L', `-o${downloadPath}`, '--create-dirs', asset.browser_download_url ]);
    core.info('Unpacking OpenCppCoverage');
    await exec.exec(path.join(TEMP_PATH, 'innoextract'), [ '-e', '-m', '--output-dir', toolPath, downloadPath ]);

    await saveCache([ toolPath ], key);
    core.info(`Installed ${release.name} at ${toolPath}`);
  }
  core.endGroup();
  const binPath = path.resolve(toolPath, 'app');
  core.addPath(binPath);
  return path.join(binPath, 'OpenCppCoverage.exe');
}

async function setupCodacyClangTidy() {
  const toolPath = path.join(TEMP_PATH, 'codacy-clang-tidy');

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
  const solutionPath = forcePosix(core.getInput('solution-path')).replace(/\/+$/, ''); // remove trailing slashes
  return forceNative(solutionPath);
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

    const outputPath = path.join(TEMP_PATH, OUTPUT_PATH);
    fs.mkdirSync(outputPath, { 'recursive': true });
    
    for (const project of projects) {
      core.startGroup(`Running ${project}`);
      core.info('open stdout');
      const output = fs.openSync(path.join(outputPath, `${project}_${platform}${suffix}.out`), 'ax');
      try {
        const error = fs.openSync(path.join(outputPath, `${project}_${platform}${suffix}.err`), 'ax');
        try {
          await exec.exec(path.join(env.GITHUB_WORKSPACE, solutionPath, 'bin', `${project}_${platform}${suffix}`), [ ], {
            'cwd': path.join(solutionPath, 'bin'),
            'listeners': {
              'stdout': (data) => fs.appendFileSync(output, data),
              'stderr': (data) => fs.appendFileSync(error, data) }});
        } finally {
          fs.closeSync(error);
        }
      } finally {
        fs.closeSync(output);
      }
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
    const CODACY_SCRIPT = '.codacy-coverage.sh';
    await exec.exec('curl', ['-s', '-S', '-L', `-o${CODACY_SCRIPT}`, 'https://coverage.codacy.com/get.sh' ]);
    const file = fs.readFileSync(CODACY_SCRIPT);
    const hash = crypto.createHash('sha256');
    hash.update(file);
    const hex = hash.digest('hex');
          
    const codacyCacheKey = `codacy-coverage-${hex}`;
    const codacyCoverageCacheId = await restoreCache([ '.codacy-coverage' ], codacyCacheKey, [ 'codacy-coverage-' ]);
    if (codacyCoverageCacheId) {
      core.info('.codacy-coverage is found in cache');
    }
    core.endGroup();
      
    const rootPath = path.join(env.GITHUB_WORKSPACE, solutionPath, path.sep);
    const outputPath = path.join(TEMP_PATH, OUTPUT_PATH);
    const coveragePath = path.join(TEMP_PATH, COVERAGE_PATH);
    fs.mkdirSync(outputPath, { 'recursive': true });
    fs.mkdirSync(coveragePath, { 'recursive': true });

    const repositoryName = getRepositoryName();
    for (const project of projects) {
      core.startGroup(`Getting code coverage for ${project}`);
      
      const output = fs.openSync(path.join(outputPath, `${project}_${platform}${suffix}.coverage.out`), 'ax');
      const coverageFile = path.join(coveragePath, `${project}_${platform}${suffix}.xml`);
      try {
        const error = fs.openSync(path.join(outputPath, `${project}_${platform}${suffix}.coverage.err`), 'ax');
        try {
          const workPath = path.join(solutionPath, 'bin');
          await exec.exec('OpenCppCoverage',
                          [`--modules=${rootPath}`,
                           `--excluded_modules=${path.join(rootPath, 'lib', path.sep)}`,
                           `--sources=${rootPath}`,
                           `--excluded_sources=${path.join(rootPath, 'lib', path.sep)}`,
                           `--excluded_sources=${path.join(rootPath, 'msvc-common', path.sep)}`,
                           `--excluded_sources=${path.join(rootPath, 'test', path.sep)}`,
                           `--export_type=cobertura:${path.relative(workPath, coverageFile)}`,
                           '--', `${project}_${platform}${suffix}` ], {
                             'cwd': workPath,
                             'listeners': {
                               'stdout': (data) => fs.appendFileSync(output, data),
                               'stderr': (data) => fs.appendFileSync(error, data) }});
        } finally {
          fs.closeSync(error);
        }
      } finally {
        fs.closeSync(output);
      }
      
      // beautify file
      let data = fs.readFileSync(coverageFile);
      const root = /(?<=<source>).+?(?=<\/source>)/.exec(data)[0];
      data = data.replace(/(?<=<source>).+?(?=<\/source>)/, repositoryName);
      data = data.replace(new RegExp(`${env.GITHUB_WORKSPACE}${path.sep}`), repositoryName);  // only one occurrence
      data = data.replace(new RegExp(`${env.GITHUB_WORKSPACE.substring(root.length)}${path.sep}`, 'g'), repositoryName);
      data = data.replace(/\\/g, '/');
      fs.writeFileSync(coverageFile, data);

      core.endGroup();
    }

    core.startGroup('Sending coverage to codecov');
    await exec.exec('bash', [ '-c', `bash <(curl -sS https://codecov.io/bash) -Z -f '${path.posix.join(forcePosix(coveragePath), '*.xml')}'` ]);
    core.endGroup();

    core.startGroup('Sending coverage to codacy');
    //await exec.exec('bash', [ '-c', `cat ${path.posix.join(forcePosix(solutionPath), 'bin', '*_coverage.xml')} | sed -r -e "s#>D:<#>llamalog<#g" -e "s#D:[\\\\]a[\\\\]llamalog[\\\\]##g" -e "s#a[\\\\]llamalog[\\\\]##g" -e "s#[\\\\]#/#g" > bin/cov.xml` ]);
    // Codacy requires language argument, else coverage is not detected
    await exec.exec('bash', [ '-c', `./${CODACY_SCRIPT} report -r '${path.posix.join(forcePosix(coveragePath), '*.xml')}' -l CPP -t ${codacyToken} --commit-uuid ${env.GITHUB_SHA}` ]);

    if (!codacyCoverageCacheId) {
      await saveCache([ '.codacy-coverage' ], codacyCacheKey);
      core.info('Added .codacy-coverage to cache');
    }
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
};

async function getMsvcVersion() {
  const globber = await glob.create(CL_PATH);
  const cl = await globber.glob();

  const filePath = path.join(TEMP_PATH, 'msc-version.cpp');
  fs.writeFileSync(filePath, '_MSC_VER');
  let version = '';
  await exec.exec(`"${cl[0]}"`, [ '/EP', filePath ], { 'listeners': { 'stdout': (data) => version += data.toString() }});
  return /([0-9]+)/.exec(version)[1];
}

function getExclusions() {
  let exclusions = [ `${TEMP_PATH}`, 'lib', 'msvc-common' ];
  if (fs.existsSync('.codacy.yml')) {
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
      core.info(`Using ${exclusions.length - 3} exclusion${exclusions.length > 1 ? 's' : ''} from .codacy.yml: ${exclusions.slice(3).join(', ')}`);
    }
  }
  return exclusions.map((e) => `!${e}`);
}

exports.analyzeClangTidy = async function() {
  try {
    const id = core.getInput('id', { 'required': true });
    const clangArgs = core.getInput('clang-args');

    // make temp path for getMsvcVersion and clang-tidy logs
    fs.mkdirSync(TEMP_PATH);

    core.startGroup('Getting version of MSVC compiler');
    const version = await getMsvcVersion();
    core.endGroup();
    
    core.startGroup('Running code analysis');
    const globber = await glob.create([ '**/*.c', '**/*.cc', '**/*.cpp', '**/*.cxx' ].concat(getExclusions()).join('\n'));
    const workspace = env.GITHUB_WORKSPACE;
    const files = (await globber.glob()).map((e) => path.relative(workspace, e));

    const args = `--system-header-prefix=lib/ -Wall -Wmicrosoft -fmsc-version=${version} -fms-extensions -fms-compatibility -fdelayed-template-parsing -D_CRT_USE_BUILTIN_OFFSETOF ${clangArgs}`;
    const output = fs.openSync(path.join(TEMP_PATH, `clang-tidy-${id}.log`), 'ax');
    try {
      await exec.exec(`"${CLANGTIDY_PATH}" --header-filter="^(?!lib[/\\].*$).*" ${files.join(' ')} -- ${args}`,
        [ ], { 'windowsVerbatimArguments': true, 'ignoreReturnCode': true, 'listeners': { 'stdout': (data) => fs.appendFileSync(output, data) }});
    } finally {
      fs.closeSync(output);
    }
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
    const logFile = path.posix.join(TEMP_PATH, 'clang-tidy.json');
    await exec.exec('bash', [ '-c', `find ${TEMP_PATH} -maxdepth 1 -name 'clang-tidy-*.log' -exec cat {} \\; | java -jar ${forcePosix(toolPath)} | sed -r -e "s#[\\\\]{2}#/#g" > ${logFile}` ]);
    await exec.exec('bash', [ '-c', `curl -s -S -XPOST -L -H "project-token: ${codacyToken}" -H "Content-type: application/json" -w "\\n" -d @${logFile} "https://api.codacy.com/2.0/commit/${env.GITHUB_SHA}/issuesRemoteResults"` ]);
    await exec.exec('bash', [ '-c', `curl -s -S -XPOST -L -H "project-token: ${codacyToken}" -H "Content-type: application/json" -w "\\n" "https://api.codacy.com/2.0/commit/${env.GITHUB_SHA}/resultsFinal"` ]);
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
};
