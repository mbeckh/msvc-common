const core = require('@actions/core');
const exec = require('@actions/exec');
const cache = require('@actions/cache');
const fs = require('fs');
const crypto = require('crypto');

const env = process.env;

const MSBUILD_PATH = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\MSBuild\\Current\\Bin\\MSBuild.exe';
const OPENCPPCOVERAGE_VERSION = '0.9.9.0';
const OPENCPPCOVERAGE_URL = `https://github.com/OpenCppCoverage/OpenCppCoverage/releases/download/release-${OPENCPPCOVERAGE_VERSION}/OpenCppCoverageSetup-x64-${OPENCPPCOVERAGE_VERSION}.exe`;
const INNOEXTRACT_URL = 'https://github.com/dscharrer/innoextract/releases/download/1.8/innoextract-1.8-windows.zip';
const CODACYCLANGTIDY_VERSION = '0.4.0';
const CODACYCLANGTIDY_URL = `https://github.com/codacy/codacy-clang-tidy/releases/download/${CODACYCLANGTIDY_VERSION}/codacy-clang-tidy-${CODACYCLANGTIDY_VERSION}.jar`;

async function saveCache(paths, key) {
  try {
    return await cache.saveCache(paths.map((e) => e.replace('\\', '/')), key);
  } catch (error) {
    // failures in caching should not abort the job
    core.warning(error.message);
  }
  return null;
}

async function restoreCache(paths, key, altKeys) {
  try {
    return await cache.restoreCache(paths.map((e) => e.replace('\\', '/')), key, altKeys);
  } catch (error) {
    // failures in caching should not abort the job
    core.warning(error.message);
  }
  return null;
}

async function setupOpenCppCoverage() {
  const path = '.mbeckh\\OpenCppCoverage';
  const key = `opencppcoverage-${OPENCPPCOVERAGE_VERSION}`;
  
  core.startGroup('Installing OpenCppCoverage');
  if (await restoreCache([ path ], key)) {
    core.info(`Found OpenCppCoverage in ${path}`);
  } else {
    // Install "by hand" because running choco on github is incredibly slow
    core.info(`Downloading innoextract from ${INNOEXTRACT_URL}`);
    await exec.exec('curl', [ '-s', '-S', '-L', '-o.mbeckh\\innoextract.zip', '--create-dirs', INNOEXTRACT_URL ]);
    core.info('Unpacking innoextract');
    await exec.exec('7z', [ 'x', '-aos', '-o.mbeckh', '.mbeckh\\innoextract.zip', 'innoextract.exe' ]);
    core.info(`Downloading OpenCppCoverage from ${OPENCPPCOVERAGE_URL}`);
    await exec.exec('curl', [ '-s', '-S', '-L', '-o.mbeckh\\OpenCppCoverageSetup.exe', '--create-dirs', OPENCPPCOVERAGE_URL ]);
    core.info('Unpacking OpenCppCoverage');
    await exec.exec('.mbeckh/innoextract.exe', [ '-e', '-m', '--output-dir', path, '.mbeckh\\OpenCppCoverageSetup.exe', ]);

    await saveCache([ path ], key);
    core.info(`Installed OpenCppCoverage at ${path}`);
  }
  const appPath = `${path}\\app`;
  core.addPath(`${env.GITHUB_WORKSPACE}\\${appPath}`);
  core.endGroup();
  return appPath;
}

async function setupCodacyClangTidy() {
  const path = '.mbeckh\\codacy-clang-tidy';
  const key = `codacy-clang-tidy-${CODACYCLANGTIDY_VERSION}`;

  core.startGroup('Installing codacy-clang-tidy');
  if (await restoreCache([ path ], key)) {
    core.info(`Found codacy-clang-tidy in cache at ${path}`);
  } else {
    core.info(`Downloading codacy-clang-tidy from ${CODACYCLANGTIDY_URL}`);
    await exec.exec('curl', [ '-s', '-S', '-L', `-o${path}\\codacy-clang-tidy.jar`, '--create-dirs', CODACYCLANGTIDY_URL ]);
    await saveCache([ path ], key);
    core.info(`Downloaded codacy-clang-tidy at ${path}`);
  }
  core.endGroup();
  return path;
}

function getRepositoryName() {
  return env.GITHUB_REPOSITORY.substring(env.GITHUB_REPOSITORY.indexOf('/') + 1);
}

function getProjects() {
  return core.getInput('projects', { 'required': true }).split(/\s*[,;\n]\s*/).filter((e) => e !== '');
}

exports.build = async function() {
  try {
    const solutionPath = core.getInput('solution-path');
    const solutionName = getRepositoryName();
    const projects = getProjects();
    const configuration = core.getInput('configuration', { 'required': true });
    const platform = core.getInput('platform') || 'x64';

    core.startGroup(`Building projects ${projects}`);
    await exec.exec(`"${MSBUILD_PATH}"`, [ `${solutionName}.sln`, `/t:${projects.join(';')}`, `/p:Configuration=${configuration}`, `/p:Platform=${platform}` ], { 'cwd': solutionPath });
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
}

exports.run = async function() {
  try {
    const solutionPath = core.getInput('solution-path');
    const projects = getProjects();
    const configuration = core.getInput('configuration', { 'required': true });
    const suffix = configuration === 'Debug' ? 'd' : '';
    const platform = core.getInput('platform') || 'x64';

    for (project of projects) {
      core.startGroup(`Running ${project}`);
      await exec.exec(`${solutionPath}\\bin\\${project}_${platform}${suffix}.exe`, [ ], { 'cwd': solutionPath + '\\bin' });
      core.endGroup();
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

exports.coverage = async function() {
  try {
    setupOpenCppCoverage();

    const solutionPath = core.getInput('solution-path');
    const bashSolutionPath = solutionPath.replace('\\', '/');
    const projects = getProjects();
    const configuration = core.getInput('configuration', { 'required': true });
    const suffix = configuration === 'Debug' ? 'd' : '';
    const platform = core.getInput('platform') || 'x64';
    const codacyToken = core.getInput('codacy-token', { 'required': true });
    core.setSecret(codacyToken);

    core.startGroup('Loading codacy coverage reporter');
    await exec.exec('curl -LsS https://coverage.codacy.com/get.sh -o .codacy-coverage.sh');
    const file = fs.readFileSync('.codacy-coverage.sh');
    const hash = crypto.createHash('sha256');
    hash.update(file);
    const hex = hash.digest('hex');
          
    const codacyCacheKey = `codacy-coverage-${hex}`;
    const codacyCoverageCacheId = await restoreCache([ '.codacy-coverage' ], codacyCacheKey, [ 'codacy-coverage-' ]);
    if (codacyCoverageCacheId) {
      core.info(`.codacy-coverage is found in cache`);
    }
    core.endGroup();
      
    for (project of projects) {
      core.startGroup('Getting code coverage');
      await exec.exec('OpenCppCoverage.exe',
                      [`--modules=${solutionPath}\\`,
                       `--excluded_modules=${solutionPath}\\lib\\`,
                       `--sources=${solutionPath}\\`,
                       `--excluded_sources=${solutionPath}\\lib\\`,
                       `--excluded_sources=${solutionPath}\\test\\`,
                       `--export_type=cobertura:${project}_coverage.xml`,
                       '--', `${project}_${platform}${suffix}.exe` ], { 'cwd': solutionPath + '\\bin' });
      core.endGroup();
    }

    core.startGroup('Sending coverage to codecov');
    await exec.exec('bash', [ '-c', `bash <(curl -sS https://codecov.io/bash) -Z -f '${bashSolutionPath}/bin/*_coverage.xml'` ]);
    core.endGroup();

    core.startGroup('Sending coverage to codacy');
    await exec.exec('bash', [ '-c', `./.codacy-coverage.sh report -r '${bashSolutionPath}/bin/*_coverage.xml' -t ${codacyToken} --commit-uuid ${env.GITHUB_SHA}` ]);

    if (!codacyCoverageCacheId) {
      codacyCoverageCacheId = await saveCache([ '.codacy-coverage' ], codacyCacheKey);
      core.info(`Added .codacy-coverage to cache`);
    }
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
}

exports.analyze = async function() {
  try {
    const bashToolPath = setupCodacyClangTidy().replace('\\', '/');

    const solutionName = getRepositoryName();
    const solutionPath = core.getInput('solution-path') || '.';
    const bashSolutionPath = solutionPath.replace('\\', '/');
    const projects = getProjects();
    const configuration = core.getInput('configuration', { 'required': true });
    const platform = core.getInput('platform') || 'x64';
    const codacyToken = core.getInput('codacy-token', { 'required': true });
    core.setSecret(codacyToken);

    core.startGroup(`Running code analysis on ${projects.join(', ')}`);
    const projectsArg = projects.join(';');
    await exec.exec(`"${MSBUILD_PATH}"`, [ `${solutionName}.sln`, `/t:${projectsArg}`, `/p:Configuration=${configuration}`, `/p:Platform=${platform}`, `/p:AnalyzeProjects="${projectsArg}"`, '/p:EnableMicrosoftCodeAnalysis=false', '/p:EnableClangTidyCodeAnalysis=true'], { 'cwd': solutionPath, 'ignoreReturnCode': true, 'windowsVerbatimArguments': true });
    core.endGroup();

    core.startGroup('Sending code analysis to codacy');
    await exec.exec('bash', [ '-c', `find ${bashSolutionPath}/obj/ -name '*.ClangTidy.log' -exec cat {} \\; | java -jar ${bashToolPath}/codacy-clang-tidy.jar | sed -r -e "s#[\\\\]{2}#/#g; s#ClangTidy_clang-#clang-#g" > ${bashSolutionPath}/bin/clang-tidy.json` ]);
    await exec.exec('bash', [ '-c', `curl -s -S -XPOST -L -H "project-token: ${codacyToken}" -H "Content-type: application/json" -w "\\n" -d @${bashSolutionPath}/bin/clang-tidy.json "https://api.codacy.com/2.0/commit/${env.GITHUB_SHA}/issuesRemoteResults"` ]);
    await exec.exec('bash', [ '-c', `curl -s -S -XPOST -L -H "project-token: ${codacyToken}" -H "Content-type: application/json" -w "\\n" "https://api.codacy.com/2.0/commit/${env.GITHUB_SHA}/resultsFinal"` ]);
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
}
