# 📄 fillpdfAPI

API desenvolvida em **Node.js** para **preenchimento automático de PDFs** (relatórios, certificados e termos de adesão) do projeto **Virada Ambiental**.

A API recebe um **JSON com dados estruturados**, seleciona dinamicamente o **template de PDF correto**, realiza o preenchimento dos campos e **salva o PDF final no Firebase Storage**, retornando um **URL público** para acesso.

---

## 🚀 Funcionalidades

- Preenchimento dinâmico de PDFs a partir de templates
- Geração automática de múltiplas páginas conforme volume de dados
- Inserção de **assinatura desenhada no PDF**
- Integração com **Firebase Storage**
- Integração com **Google Drive** (caso específico)
- Retorno de URL público do arquivo final

---

## 📥 Entrada da API

A API recebe um JSON no seguinte formato:

```json
{
  "pdfUrl": "<pdfUrl>",
  "username": "<username>",
  "assinaturaX": "<assinaturaX>",
  "assinaturaY": "<assinaturaY>",
  "assinaturaWidth": "<assinaturaWidth>",
  "assinaturaHeight": "<assinaturaHeight>",
  "campos": {
    "nome": "<nome>",
    "cpf": "<cpf>",
    "telefone": "<telefone>",
    "email": "<email>",
    "mudas": "<mudas>",
    "dia": "<dia>",
    "mes": "<mes>",
    "ano": "<ano>",
    "assinatura": "<assinatura>",
    "idrelatorio": "<idrelatorio>",
    "datageracao": "<datageracao>",
    "periodo": "<periodo>",
    "cidade": "<cidade>",
    "estado": "<estado>",
    "mudasperiodo": "<mudasperiodo>",
    "mudastotal": "<mudastotal>",
    "area": "<area>",
    "nomeinstituicao": "<nomeinstituicao>",
    "cnpj": "<cnpj>",
    "nomecompleto": "<nomecompleto>",
    "tipo": "<tipo>",
    "publicototal": "<publicototal>",
    "plantiosperiodo": "<plantiosperiodo>",
    "numeventos": "<numeventos>",
    "plantioslista": "<plantioslista>",
    "eventoslista": "<eventoslista>",
    "edicao": "<edicao>",
    "numextenso": "<numextenso>"
  }
}
```

O retorno esperado da API é o URL público onde o PDF foi salvo no Storage do Firebase, no estilo abaixo:
{
  "url": "https://storage.googleapis.com/..."
}


Possui três principais ramos, onde todos os PDFs templates necessários já estão armazenados na mesma pasta do index.js, e ele apenas irá decidir qual usar baseado no campo "pdfurl" vindo do JSON, que pode ser certificadoouro.pdf, relatorio.pdf, e por ai vai:

Preenchimento de Relatórios: o PDF da página de relatórios possui 3 páginas por padrão. A primeira possui dados gerais e sempre será gerada, informa dados dos plantios no período selecionado. A segunda página informa local, município, quantidade de mudas e coordenadas dos plantios da região e período selecionado. Essa página acomoda até 23 plantios devido ao tamanho da tabela, então no início da função verificamos quantos plantios temos pra /23 e saber quantas páginas de plantios precisaremos. A página de evento tem comportamento idêntico, mudando apenas os dados (público total, data, local (nome da cidade apenas, não coordenadas) e tipo de atividade (maratona, plantio, etc.). Vale ressaltar que caso não haja plantios no período selecionado, a página de plantios (p.2) não será gerada. A mesma regra se aplica pra a página de eventos.

Preenchimento de Certificados: A regra de negócio de verificar se o usuário merece o certificado de ouro, prata ou bronze já é realizada no front-end, então a API só está sendo encarregada de criar o certificado que é passado (O campo pdfurl do JSON recebido será certificadoouro.pdf, certificadoprata.pdf ou certificadobronze.pdf, e assim a API vai escolher corretamente o nivel do certificado). Apenas preenche os campos utilizando a field.setText() e está pronto.

Preenchimento de Termo de Adesão: Para o termo de adesão, existe uma função especial onde a assinatura que o usuário criou será inserida no PDF com a função da biblioteca de desenhar em PDF. Além de inserir os dados do usuário no PDF com field.sexText(), faremos a inserção da assinatura e está pronto. Para o caso do termo de adesão, além de salvar no Storage do Firebase, o arquivo também é salvo no Drive em uma pasta com o nome do usuário que assinou.
