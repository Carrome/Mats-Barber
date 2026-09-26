# SQL do projeto

Rodar em ordem, uma vez cada, no **SQL Editor** do painel do projeto.

## 01-etapa1.sql

Cria a tabela `barbearia`, liga as políticas de acesso e o gatilho de versão.

### Antes de rodar

No painel, em **Authentication → Providers → Email**, desligue **Confirm email**.
Sem isso o cadastro fica pendente de um e-mail que nunca será lido.

### Depois de rodar

Em **Authentication → Users → Add user**, crie o usuário do Matheus:

- E-mail: `mats@mats-barber.vercel.app`
- Senha: a combinada
- **Auto Confirm User: marcado**

Guarde o `User UID` que aparece na lista: o app usa ele na primeira gravação.

> Com o login desligado (`EXIGIR_LOGIN = false`), os passos de usuário acima
> ficam para depois. O 02 funciona sem eles.

## 02-sem-login.sql

Liga a sincronização entre os celulares sem usuário. Rodar depois do 01.

- A tabela `barbearia` passa a aceitar no máximo uma linha, e sem dono.
- Cria `barbearia_historico`, com as versões substituídas (quando muda o aparelho
  que grava, ou a cada 10 minutos de uso), guardando as 60 mais recentes.
- Cria as funções `mf_versao`, `mf_ler`, `mf_criar` e `mf_gravar`. O app só fala
  com o banco por elas, levando o código de `src/config.js`. A tabela continua
  fechada para acesso direto e não existe função de apagar.

Se o código de `src/config.js` mudar, o resumo em `mf_ok` tem que mudar junto
(o teste `src/config.test.js` avisa quando os dois não batem).
