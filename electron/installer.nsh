; Kept in sync with electron/resources/installer.nsh (electron-builder include).
; Extra Start Menu entry for Cinem AI Assistant (same CINEM-Pro.exe).
; Default CINEM Pro shortcut is created by electron-builder.
;
; Branding: customHeader / customWelcomePage / optional AdvSplash. See
; docs/windows-installer-branding.md.

!macro customHeader
  !ifndef MUI_WELCOMEPAGE_TITLE
    !define MUI_WELCOMEPAGE_TITLE "CINEM Pro"
  !endif
  !ifndef MUI_WELCOMEPAGE_TITLE_3LINES
    !define MUI_WELCOMEPAGE_TITLE_3LINES
  !endif
  !ifndef MUI_WELCOMEPAGE_TEXT
    !define MUI_WELCOMEPAGE_TEXT "CINEM Pro (Desk + AI Assistant) on this PC.$\r$\n$\r$\nThis setup installs the cloud desk and the on-device assistant together. After setup, open Desk, AI Assistant, or both from the Start Menu.$\r$\n$\r$\nClick Next to continue."
  !endif
  !ifndef MUI_FINISHPAGE_TITLE
    !define MUI_FINISHPAGE_TITLE "CINEM Pro is ready"
  !endif
  !ifndef MUI_FINISHPAGE_TEXT
    !define MUI_FINISHPAGE_TEXT "CINEM Pro (Desk + AI Assistant) is installed. Use the desktop shortcut for Desk, or open Cinem AI Assistant from the Start Menu."
  !endif
  !ifndef MUI_FINISHPAGE_RUN_TEXT
    !define MUI_FINISHPAGE_RUN_TEXT "Launch CINEM Pro"
  !endif
  !ifndef MUI_BGCOLOR
    !define MUI_BGCOLOR 0C0C0D
  !endif
  !ifndef MUI_TEXTCOLOR
    !define MUI_TEXTCOLOR F4F3EF
  !endif
  !ifndef MUI_INSTFILESPAGE_COLORS
    !define MUI_INSTFILESPAGE_COLORS "F4F3EF 0C0C0D"
  !endif
!macroend

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define /redef MUI_WELCOMEPAGE_TITLE "Uninstall CINEM Pro"
  !define /redef MUI_WELCOMEPAGE_TEXT "This removes CINEM Pro (Desk + AI Assistant) from your computer."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

!macro customInit
  InitPluginsDir
  File "/oname=$PLUGINSDIR\cinem-splash.bmp" "${BUILD_RESOURCES_DIR}\installer\splash.bmp"
  !if /FileExists "${NSISDIR}\Plugins\x86-unicode\advsplash.dll"
    advsplash::show 1600 600 500 -1 "$PLUGINSDIR\cinem-splash"
    Pop $0
  !else
    !if /FileExists "${NSISDIR}\Plugins\unicode\advsplash.dll"
      advsplash::show 1600 600 500 -1 "$PLUGINSDIR\cinem-splash"
      Pop $0
    !else
      !if /FileExists "${NSISDIR}\Plugins\x86-unicode\splash.dll"
        splash::show 1600 "$PLUGINSDIR\cinem-splash"
        Pop $0
      !endif
    !endif
  !endif
!macroend

!macro customInstall
  CreateDirectory "$SMPROGRAMS\CINEM Pro"
  CreateShortCut "$SMPROGRAMS\CINEM Pro\Cinem AI Assistant.lnk" "$INSTDIR\CINEM-Pro.exe" "--mode=assistant"
!macroend
