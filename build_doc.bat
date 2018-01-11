
SETLOCAL

::Config
    set BUILD_DIR=.\build\dist\doc
    set SRC_DIR=%TEMP%\tcmenu-doc

::Build Documentation
    echo "Build Documentation"
    ::call gem update asciidoctor asciidoctor-pdf
    call asciidoctor-pdf %SRC_DIR%\tcmenu.adoc
    if not exist %BUILD_DIR% mkdir %BUILD_DIR%
    move %SRC_DIR%\tcmenu.pdf %BUILD_DIR%\tcmenu.pdf

::Finished
    echo "Finished"