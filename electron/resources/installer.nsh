; Extra Start Menu entry for Cinem AI Assistant (same CINEM-Pro.exe).
; Default CINEM Pro shortcut is created by electron-builder.
; Path: electron/resources (electron-builder buildResources).
!macro customInstall
  CreateDirectory "$SMPROGRAMS\CINEM Pro"
  CreateShortCut "$SMPROGRAMS\CINEM Pro\Cinem AI Assistant.lnk" "$INSTDIR\CINEM-Pro.exe" "--mode=assistant"
!macroend
