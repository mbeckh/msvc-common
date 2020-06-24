# msvc-common
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

### msvc-common/actions/build
The action runs a build using MSBuild on one or multiple projects.

#### Inputs
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).
-   `projects` - The comma-, semicolon- or newline-separated list of projects to build (required).
-   `configuration` - The name of the configuration to build (required).
-   `platform` - The name of the platform for which to build (optional, defaults to `x64`).

### msvc-common/actions/run
The action runs a binary produced by a previous build.

#### Inputs
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).
-   `projects` - The comma-, semicolon- or newline-separated list of projects to run (required).
-   `configuration` - The name of the configuration to run (required).
-   `platform` - The name of the platform (optional, defaults to `x64`).

### msvc-common/actions/coverage
The action runs a coverage analysis on a binary produced by a previous build.

#### Inputs
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).
-   `projects` - The comma-, semicolon- or newline-separated list of projects to run (required). Please provide the name
     of the test binary, not the name of the project containing the code to test.
-   `configuration` - The name of the configuration to build (required).
-   `platform` - The name of the platform for which to build (optional, defaults to `x64`).
-   `codacy-token` - The value of the Codacy.com project API token (required).

### msvc-common/actions/analyze
The action runs a clang-tidy analysis on the sources of one or multiple projects. The action runs the analyses for
multiple configurations or platforms and then sends the aggregated results to Codacy in a single batch.

#### Inputs
-   `solution-path` - If the solution file is not in the project root, provide the relative folder path
    (optional, defaults to project root folder).
-   `projects` - The comma-, semicolon- or newline-separated list of projects to build (required).
-   `configurations` - A comma- or semicolon-separated list of all configurations to build (required).
-   `platforms` - A comma- or semicolon-separated list of all platforms for which to build
    (optional, defaults to `x64`).
-   `codacy-token` - The value of the Codacy.com project API token (required).
