# E-mails da a rede.online

Modelos dos e-mails da conta. Eles ficam no Supabase, em Authentication › Emails › Templates.
O Supabase não deixa trocar esses modelos por aqui: é preciso colar cada arquivo no painel dele.

22/11/2026 (Amanda): desenho novo e igual para todos os e-mails da rede.
- A marca em cima, um cartão branco com título, uma frase, um botão largo e quanto tempo o link vale.
- O endereço do link aparece pequeno, embaixo, só para quando o botão não abrir.
- Rodapé curto: o que fazer se não foi você, "Nunca pedimos sua senha por e-mail" e o contato.
- O nome da rede no rodapé é um link para https://arede.online. Assim o programa de e-mail não transforma
  "rede.online" sozinho em link para outro endereço.

| Modelo no Supabase | Assunto | Arquivo |
|---|---|---|
| Confirm signup | Confirme seu e-mail · a rede.online | confirmar-cadastro.html |
| Reset password | Crie uma nova senha · a rede.online | nova-senha.html |
| Change email address | Confirme o novo e-mail · a rede.online | trocar-email.html |

Os avisos que a própria rede manda (moderação, resumo, alertas do painel) saem pela função avisos-envia,
com o mesmo desenho. Essa parte já está no ar.

Configuração de endereços (Authentication › URL Configuration):
- Site URL: https://arede.online/
- Redirect URLs: https://arede.online/**
