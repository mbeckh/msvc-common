# msvc-common Changes

## v2.2.1 - 2020-10-24
-   \[Dependency\] Updated dependencies for build actions.

## v2.2.0 - 2020-07-09
-   \[Feature\] Allow extra arguments for compiler in build action.

## v2.1.1 - 2020-07-02
-   \[Fix\] clang-tidy now reports errors in headers.

## v2.1.0 - 2020-06-28
-   \{Feature\] Add actions for automating workflows on Github.

## v2.0.0 - 2020-06-08
-   \[Breaking\] Do not link library dependencies.
-   \[Breaking\] Increase warning level and treat warnings as errors in release builds.
-   \[Breaking\] Target Windows 8 or newer by default (`_WIN32_WINNT=0x0602`).
-   \[Breaking\] Updated options for Visual Studio 2019.
-   \[Feature\] Add properties file for adding Detours library.
-   \[Feature\] Set option to optimize global data (/Gw) and more aggressive inlining (/Ob3) for release builds.

## v1.0.0 - 2019-03-15
Initial Release.
