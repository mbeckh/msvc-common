# msvc-common
[![Release](https://img.shields.io/github/v/tag/mbeckh/msvc-common?label=Release&style=flat-square)](https://github.com/mbeckh/msvc-common/releases/)
[![Tests](https://img.shields.io/github/workflow/status/mbeckh/msvc-common/test/master?label=Tests&logo=GitHub&style=flat-square)](https://github.com/mbeckh/msvc-common/actions)
[![License](https://img.shields.io/github/license/mbeckh/msvc-common?label=License&style=flat-square)](https://github.com/mbeckh/msvc-common/blob/master/LICENSE)

Common settings for C++ projects created in Microsoft Visual Studio. This documents the conventions as well as my
best-practices for projects in Visual Studio. It also helps to solve the problem that all parts of a binary must 
use the same settings for particular build settings such as exception handling, character set and runtime library mode.

The project also contains some actions for automating the builds on Github.

## Directory Layout
The common settings are based on the following directory layout.

-   `<solution>/`
    -   `bin/`
    -   `doc/`
    -   `include/`
    -   `lib/`
    -   `msvc/`
    -   `msvc-common/`
    -   `obj/`
    -   `src/` 

### Root Folder
The root folder contains the main solution file `<solution>.sln`.

### `bin/`
All binaries are placed in the folder `bin/`.

The build settings append an underscore, either `x86` oder `x64` depending on the platform and a `d` for debug builds to
the file name. For example, a 32-bit debug build for the library project `foo` will be named `foo_x32d.lib` whereas the
64-bit release build of the same project would be named `foo_x64.lib`.

### `doc/`
Documentation and all files required to build it SHOULD be put into this directory.

### `include/`
All includes which should be externally visible, i.e. consumed by users of a shared library, SHOULD be placed into this
folder.

### `lib/`
This directory contains any external libs, mainly in the form of git submodules.

To ensure that all libraries which are part of a solution use the same build settings, all dependencies of all sub
modules using this project scheme MUST also be placed into the root `lib/` folder.

For the submodules which are available by referencing property sheets in `msvc-common/` the following command is
RECOMMENDED to add it in git:
~~~shell
git add submodule --depth 1 --name <name> <repository> lib/<name>
~~~

`.gitmodules` SHOULD contain the following lines:
~~~text
[submodule "<name>"]   
  path = lib/<name>
  url = <repository>
  update = merge
  branch = <branch>|.
  shallow = true
~~~

If the submodule contains submodules referenced by the pattern described in this file, you SHOULD also add
`fetchRecurseSubmodules = false`. You MAY also consider setting `update = rebase` and `branch = .`

### `msvc/`
This folder contains all project files and settings for the project.

For libraries, you MAY place a file names `<name>`.props inside this directory to enable references by other projects.

For  each project inside the solution a separate folder inside `msvc/` is created. Projects for automated tests SHOULD
be named `<project>_Test`.

#### `msvc/<project>/`
This folder contains all Visual Studio project files:
-   `<project>.vcxproj`
-   `<project>.vcxproj.filters`
-   `<project>.vcxproj.user` (SHOULD be excluded in `.gitignore`).

You MAY also place the files `stdadx.h` and `stdafx.cpp` inside this folder. Both are automatically picked-up by the
default configuration files.

### `msvc-common/`
This folder contains common configuration files and readily available projects form common third party libraries. In
fact, it is this project mapped as a submodule.

-   `BuildConfiguration.props`: Included in the project file a a property sheet. A file with the same name in
    `<root>/msvc/` is detected automatically and MAY be used to override or add settings specific to a solution.

-   `ProjectConfiguration.props`: Include the file after `Microsoft.Cpp.Default.props` in the project file. A file with
     the same name in `<root>/msvc/` is detected automatically and MAY be used to override or add settings specific to a
     solution.

-   `args.props`: A property sheet which will add a dependency to args command line parser
    (<https://github.com/Taywee/args>) to a project.

-   `Detours.props`: A property sheet which will add a dependency with include and library paths for Microsoft Detours
    (<https://github.com/Microsoft/Detours>) to a project.

-   `fmt.props`: A property sheet which will add a dependency with include and library paths for {fmt}
    (<https://github.com/fmtlib/fmt>) to a project.

-   `googletest.props`: A property sheet which will add a dependency with include and library paths for googletest
    (<https://github.com/google/googletest>) to a project.

#### `msvc-common/Detours`
The file `detours_gmock.h` contains some useful macros for using Detours together with googletest and googlemock. The
file is made available in the system class path.

### `obj/`
All intermediate build files are placed in this folder.

### `src/`
This folder is home of all source files and internal includes.

### `test/`
This folder is home of all source files for automated tests.

## Actions
The actions allow running a full CI pipeline with build, test and code metrics for Visual Studio/MSBuild on Github.

### Pre-requisites
The actions run on Windows builds only.

### `build`
Run a build using MSBuild on one or multiple projects.

Example:
~~~yml
    - name: Build
      uses: mbeckh/msvc-common/actions/build@v2
      with:
        projects: myproject, myproject_Test
        configuration: Debug
~~~

#### Inputs
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).

-   `projects` - The comma-, semicolon- or newline-separated list of projects to build (required).

-   `configuration` - The name of the configuration to build (required).

-   `platform` - The name of the platform for which to build (optional, defaults to `x64`).

### `run`
Run a binary produced by a previous [build](#build). A copy of the data printed to `stdout` and `stderr` is saved in the
files `.mbeckh/output/<project>_<platform><debug-suffix>.out` and `.mbeckh/output/<project>_<platform><debug-suffix>.out`
respectively. `debug-suffix` is `d` for the configuration `Debug`, else empty.

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

#### Inputs
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).

-   `projects` - The comma-, semicolon- or newline-separated list of projects to run (required).

-   `configuration` - The name of the configuration to run (required).

-   `platform` - The name of the platform (optional, defaults to `x64`).

### `coverage`
Run a coverage analysis on a binary produced by a previous [build](#build). A copy of the data printed to `stdout` and
`stderr` is saved in the files `.mbeckh/output/<project>_<platform><debug-suffix>.coverage.out` and
`.mbeckh/output/<project>_<platform><debug-suffix>.coverage.out` respectively. `debug-suffix` is `d` for the 
configuration `Debug`, else empty. The coverage report is saved in `.mbeckh/coverage`.

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

#### Inputs
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).

-   `projects` - The comma-, semicolon- or newline-separated list of projects to run (required).
    Please provide the name of the test binary, not the name of the project containing the code to test.

-   `configuration` - The name of the configuration to build (required).

-   `platform` - The name of the platform for which to build (optional, defaults to `x64`).

-   `github-token` - The value of the Github API token (required).

-   `codacy-token` - The value of the Codacy.com project API token (required).

### `analyze-clang-tidy`
Run a clang-tidy analysis on the sources of one or multiple projects. The analysis can run in paralel for
multiple configurations or platforms. Results are stored in the file `.mbeckh/clang-tidy-<id>.log`.
To send the aggregated results to Codacy, please use the action [`analyze-report`](#analyze-report).

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

#### Inputs
-   `id` - A unique id to keep the results of several runs separated (required).

-   `clang-args` - Additional arguments to pass to the clang compiler, e.g. additional include paths
    (optional, default is `-xc++ -std=c++20`).

### `analyze-report`
Sends one or multiple results from the action [`analyze-clang-tidy`](#analyze-clang-tidy) to Codacy. The latest 
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

#### Inputs
-   `github-token` - The value of the Github API token (required).
-   `codacy-token` - The value of the Codacy.com project API token (required).
