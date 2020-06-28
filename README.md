# Common C++ Project Framework for Microsoft Visual Studio
[![Release](https://img.shields.io/github/v/tag/mbeckh/msvc-common?label=Release&style=flat-square)](https://github.com/mbeckh/msvc-common/releases/)
[![Tests](https://img.shields.io/github/workflow/status/mbeckh/msvc-common/test/master?label=Tests&logo=GitHub&style=flat-square)](https://github.com/mbeckh/msvc-common/actions)
[![Codacy Grade](https://img.shields.io/codacy/grade/2958536c2ab542ceb181ff99d6011558?label=Code%20Quality&logo=codacy&style=flat-square)](https://www.codacy.com/manual/mbeckh/msvc-common?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=mbeckh/msvc-common&amp;utm_campaign=Badge_Grade)
[![License](https://img.shields.io/github/license/mbeckh/msvc-common?label=License&style=flat-square)](https://github.com/mbeckh/msvc-common/blob/master/LICENSE)

Common settings for C++ projects created in Microsoft Visual Studio. This documents the conventions as well as my
best-practices for projects in Visual Studio. It also helps to solve the problem that all parts of a binary must 
use the same settings for particular build settings such as exception handling, character set and runtime library mode.

The project also contains some [Github actions](actions) for automating the builds using workflows.

## Directory Layout
The common settings are based on the following directory layout.

-   [`<solution>/`](#root-folder)
    -   [`bin/`](#build-artifacts)
    -   [`doc/`](#documentation)
    -   [`include/`](#public-include-files)
    -   [`lib/`](#external-libraries)
    -   [`msvc/`](#msvc-project-files)
    -   [`msvc-common/`](#build-framework-this-project)
    -   [`obj/`](#intermediate-output-files)
    -   [`src/`](#source-files)
    -   [`test/`](#unit-tests)

### Root Folder
The root folder contains the main solution file `<solution>.sln`.

### Build Artifacts
All binaries are placed in the folder `bin/`.

The build settings append an underscore, either `x86` oder `x64` depending on the platform and a `d` for debug builds to
the file name. For example, a 32-bit debug build for the library project `foo` will be named `foo_x32d.lib` whereas the
64-bit release build of the same project would be named `foo_x64.lib`.

### Documentation
Documentation and all files required to build it SHOULD be put into the directory `doc/`.

### Public Include Files
All includes which should be externally visible, i.e. consumed by users of a shared library, SHOULD be placed into the
folder `include/`.

### External Libraries
The directory `lib/` contains all external libraries, mainly in the form of git submodules.

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

### MSVC Project Files
The folder `msvc/` contains all project files and settings for the project.

For libraries, you MAY place a file names `<name>`.props inside this directory to enable references by other projects.

For  each project inside the solution a separate folder inside `msvc/` is created. Projects for automated tests SHOULD
be named `<project>_Test`.

#### MSVC Project Folder
This folder `msvc/<project>/` contains all Visual Studio project files:
-   `<project>.vcxproj`
-   `<project>.vcxproj.filters`
-   `<project>.vcxproj.user` (SHOULD be excluded in `.gitignore`).

You MAY also place the files `stdadx.h` and `stdafx.cpp` inside this folder. The default configuration files pick-up
both automatically.

### Build Framework (This Project)
This folder `msvc-common/` contains common configuration files and readily available projects form common third party
libraries. In fact, it is this project mapped as a submodule.

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

#### Detours Helpers
The file `detours_gmock.h` in `msvc-common/Detours/`contains some useful macros for using Detours together with 
googletest and googlemock. The file is made available in the system class path.

### Intermediate Output Files
All intermediate build files are placed in the folder `obj/`.

### Source Files
This folder `src/` is home of all source files and internal includes.

### Unit Tests
This folder `test/` is home of all source files for automated tests. It is typically excluded for most code analysis.

## License
The code is released under the Apache License Version 2.0. Please see [LICENSE](LICENSE) for details and
[NOTICE](NOTICE) for the required information when using the project in your own work.
