; Ganchos do instalador NSIS.
;
; A regra de firewall e o que permite o celular do mecanico alcancar o
; notebook pelo Wi-Fi da oficina. Sem ela o Windows recusa a conexao em
; silencio, e a unica pista seria o app do mecanico dizendo "nao encontrei o
; computador da oficina" — com tudo aparentemente certo.
;
; `profile=private` limita a liberacao a redes domesticas/corporativas. Numa
; rede publica a porta continua fechada, que e o desejado.

!macro customInstall
  DetailPrint "Liberando a porta 4570 para o celular do mecanico..."

  ; Remove uma regra antiga antes, para reinstalacao nao duplicar.
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="JJS Mecanica - celular do mecanico"'
  Pop $0

  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="JJS Mecanica - celular do mecanico" dir=in action=allow protocol=TCP localport=4570 profile=private'
  Pop $0

  ${If} $0 == 0
    DetailPrint "Porta 4570 liberada."
  ${Else}
    DetailPrint "Nao consegui liberar a porta 4570 automaticamente."
    DetailPrint "De em Configuracoes > Celular do mecanico para liberar depois."
  ${EndIf}

  DetailPrint "JJS Mecanica instalado."
!macroend

!macro customUnInstall
  DetailPrint "Removendo a regra de firewall..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="JJS Mecanica - celular do mecanico"'
  Pop $0
  DetailPrint "JJS Mecanica removido. Os dados da oficina foram mantidos."
!macroend
