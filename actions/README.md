# Github Actions for Continuous Integration
[![Release](https://img.shields.io/github/v/tag/mbeckh/msvc-common?label=Release&style=flat-square)](https://github.com/mbeckh/msvc-common/releases/)
[![Tests](https://img.shields.io/github/workflow/status/mbeckh/msvc-common/test/master?label=Tests&logo=GitHub&style=flat-square)](https://github.com/mbeckh/msvc-common/actions)
[![Codacy Grade](https://img.shields.io/codacy/grade/2958536c2ab542ceb181ff99d6011558?label=Code%20Quality&logo=codacy&style=flat-square)](https://www.codacy.com/manual/mbeckh/msvc-common?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=mbeckh/msvc-common&amp;utm_campaign=Badge_Grade)
[![License](https://img.shields.io/github/license/mbeckh/msvc-common?label=License&style=flat-square)](https://github.com/mbeckh/msvc-common/blob/master/LICENSE)

The actions allow running a full CI pipeline with build, test and code metrics for Visual Studio/MSBuild on Github.
They depend on the framework set by the [msvc-common configuration](https://github.com/mbeckh/msvc-common).
The [build workflow](https://github.com/mbeckh/llamalog/actions?query=workflow%3Abuild) of the
[llamalog project](https://github.com/mbeckh/llamalog) is an example of all actions working together.

The actions provide workflow steps for:
-   [Building software](#build-software)
-   [Run build artifacts](#run-a-build-artifact)
-   [Getting code coverage](#get-code-coverage)
-   [Analyze code quality](#analyze-code-quality)
-   [Report code quality](#report-code-quality)

## Pre-requisites
The actions run on Windows builds only.

## Build software
Run a build using MSBuild on one or multiple projects.

Example:
~~~yml
    - name: Build
      uses: mbeckh/msvc-common/actions/build@v2
      with:
        projects: myproject, myproject_Test
        configuration: Debug
~~~

### Inputs for `build`
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).

-   `projects` - The comma-, semicolon- or newline-separated list of projects to build (required).

-   `configuration` - The name of the configuration to build (required).

-   `platform` - The name of the platform for which to build (optional, defaults to `x64`).

-   `extra-compiler-args` - Supply additional arguments to the compiler (optional).

## Run a build artifact
Run a binary produced by a previous [build](#build). A copy of the data printed to `stdout` and `stderr` is saved to
files `<project>_<platform><debug-suffix>.out` and `<project>_<platform><debug-suffix>.out` respectively.
`<debug-suffix>` is `d` for configuration `Debug`, else empty. Both files are stored in the folder `.mbeckh/output/`.

Example:
~~~yml
    - name: Run tests
      uses: mbeckh/msvc-common/actions/run@v2
      with:
        projects: myproject_Test
        configuration: Debug

    - name: Save output
      uses: actions/upload-artifact@v2
      with:
        name: output
        path: .mbeckh/output
~~~

### Inputs for `run`
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).

-   `projects` - The comma-, semicolon- or newline-separated list of projects to run (required).

-   `configuration` - The name of the configuration to run (required).

-   `platform` - The name of the platform (optional, defaults to `x64`).

## Get code coverage
Run a coverage analysis on a binary produced by a previous [build](#build-software). A copy of the data printed to
`stdout` and `stderr` is saved to files `<project>_<platform><debug-suffix>.out` and
`<project>_<platform><debug-suffix>.out` respectively. `<debug-suffix>` is `d` for configuration `Debug`, else empty.
Both files are stored in the folder `.mbeckh/output/`.The coverage report is saved in `.mbeckh/coverage`.

For the time being, all coverage reports are sent for the language `CPP` because else Codacy either ignores headers or
source files. If required, an enhancement can be made to allow configuration for language argument.

The latest version of [OpenCppCoverage](https://github.com/OpenCppCoverage/OpenCppCoverage) is automatically downloaded
from Github. For unpacking the installer, the action uses the latest version of
[innoextract](https://github.com/dscharrer/innoextract).

Example:
~~~yml
    - name: Run tests and get coverage
      uses: mbeckh/msvc-common/actions/coverage@v2
      with:
        projects: myproject_Test
        configuration: Debug
        github-token: ${{ secrets.GITHUB_TOKEN }}
        codacy-token: ${{ secrets.CODACY_PROJECT_API_TOKEN }}

    - name: Save output
      uses: actions/upload-artifact@v2
      with:
        name: output
        path: .mbeckh/output

    - name: Save coverage reports
      uses: actions/upload-artifact@v2
      with:
        name: coverage
        path: .mbeckh/coverage
~~~

### Inputs for `coverage`
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).

-   `projects` - The comma-, semicolon- or newline-separated list of projects to run (required).
    Please provide the name of the test binary, not the name of the project containing the code to test.

-   `configuration` - The name of the configuration to build (required).

-   `platform` - The name of the platform for which to build (optional, defaults to `x64`).

-   `github-token` - The value of the Github API token (required).

-   `codacy-token` - The value of the Codacy.com project API token (required).

## Analyze code quality
Run a clang-tidy analysis on the sources of one or multiple projects. The analysis can run in parallel for
multiple configurations or platforms. Results are stored in the file `.mbeckh/clang-tidy-<id>.log`.
To send the aggregated results to Codacy, please use the action [`analyze-report`](#report-code-quality).

Analysis is performed for files with the extensions `.c`, `.cc`, `.cpp` and `.cxx`. Code in the folders `lib/`,
`msvc-common` and `test/` is excluded from analysis by default. The action also evaluates any global excludes from the
file [`.codacy.yml`](https://support.codacy.com/hc/en-us/articles/115002130625-Codacy-Configuration-File) in the project
root folder. You MAY specify additional excludes for the engine `clang-tidy` which are also taken into account.

Example:
~~~yml
    - name: Analyze code
      uses: mbeckh/msvc-common/actions/analyze-clang-tidy@v2
      with:
        id: default
        clang-args: -xc++ -std=c++20 -Iinclude -DUNICODE -DNOMINMAX -DWIN32_LEAN_AND_MEAN

    - name: Save logs
      uses: actions/upload-artifact@v2
      with:
        name: clang-tidy
        path: .mbeckh/clang-tidy-*.log
~~~

### Inputs for `analyze-clang-tidy`
-   `id` - A unique id to keep the results of several runs separated (required).

-   `clang-args` - Additional arguments to pass to the clang compiler, e.g. additional include paths
    (optional, default is `-xc++ -std=c++20`).

## Report code quality
Sends one or multiple results from the action [`analyze-clang-tidy`](#analyze-code-quality) to Codacy. The latest 
version of [codacy-clang-tidy](https://github.com/codacy/codacy-clang-tidy) is automatically downloaded from Github.

Example:
~~~yml
    - name: Get logs
      uses: actions/download-artifact@v2
      with:
        name: clang-tidy
        path: .mbeckh

    - name: Report to Codacy
      uses: mbeckh/msvc-common/actions/analyze-report@v2
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        codacy-token: ${{ secrets.CODACY_PROJECT_API_TOKEN }}
~~~

### Inputs for `analyze-report`
-   `github-token` - The value of the Github API token (required).
-   `codacy-token` - The value of the Codacy.com project API token (required).

## License
The code is released under the Apache License Version 2.0. Please see [LICENSE](../LICENSE) for details and
[NOTICE](../NOTICE) for the required information when using the project in your own work.
