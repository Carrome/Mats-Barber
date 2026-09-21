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
