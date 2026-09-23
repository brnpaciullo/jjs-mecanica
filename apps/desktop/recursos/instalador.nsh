; Ganchos do instalador NSIS.
;
; A regra de firewall para a porta 4570 (celular do mecanico na rede da oficina)
; entra na etapa 6. O arquivo ja existe aqui para o electron-builder nao quebrar
; quando ela for adicionada, e para o ponto de mudanca ficar obvio.

!macro customInstall
  DetailPrint "JJS Mecânica instalado."
!macroend

!macro customUnInstall
  DetailPrint "JJS Mecânica removido. Os dados da oficina foram mantidos."
!macroend
