# 📄 fillpdfAPI

API desenvolvida em **Node.js** para **preenchimento automático de PDFs** (relatórios, certificados e termos de adesão) do projeto **Virada Ambiental**. A aplicação processa dados via JSON e utiliza templates pré-definidos para compor os arquivos finais.

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

A API recebe um JSON no seguinte formato (Caso campos desnecessários estejam vazios, são ignorados):

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

## Retorno da API

A API retorna um objeto JSON contendo o **URL público** do PDF gerado e armazenado no **Firebase Storage**.

```json
{
  "url": "https://storage.googleapis.com/..."
}
```

## 🚀 Estrutura de Templates
Todos os templates base estão armazenados no diretório raiz junto ao `index.js`. A API decide qual template utilizar através do campo `pdfurl` recebido no corpo da requisição.

**Exemplos de templates:**
* `certificadoouro.pdf`
* `relatorio.pdf`
* `termo_adesao.pdf`

---

## 🛠️ Funcionalidades Principais

### 1. Preenchimento de Relatórios
O sistema gera relatórios dinâmicos que podem variar de 1 a N páginas, dependendo do volume de dados:

* **Página 1 (Geral):** Sempre gerada. Contém dados consolidados dos plantios do período.
* **Página 2 (Detalhamento de Plantios):** Gerada apenas se houver plantios.
    * *Regra de Layout:* Acomoda até **23 registros** por tabela. Caso ultrapasse, a API calcula automaticamente o número de páginas adicionais ($total / 23$).
* **Página 3 (Detalhamento de Eventos):** Gerada apenas se houver eventos cadastrados. Exibe público, data, local e tipo de atividade. Possui a mesma regra de layout do detalhamento de plantios.

### 2. Emissão de Certificados
A lógica de classificação (Ouro, Prata ou Bronze) é processada no Front-end. A API atua como o motor de renderização:
* Recebe a definição do nível via JSON (`pdfurl`).
* Mapeia e preenche os campos do template usando `field.setText()`.
* Garante agilidade na entrega do documento final.

### 3. Termo de Adesão e Assinatura Digital
Uma função especializada para formalização de documentos:
* **Assinatura:** Utiliza funções de desenho em PDF para inserir a assinatura manuscrita do usuário sobre o documento.
* **Integração:** * O arquivo é armazenado no **Firebase Storage**.
    * Uma cópia é enviada ao **Google Drive**, organizada em uma pasta específica com o nome do usuário signatário.

---

## 📁 Fluxo de Dados



1. **Input:** JSON contendo `pdfurl` e os dados dos campos.
2. **Processamento:** * Seleção do arquivo `.pdf` local.
    * Cálculo de paginação (para relatórios).
    * Injeção de texto e imagens (assinaturas).
3. **Output:** Upload para Storage e Google Drive.

---

## 🧰 Tecnologias Utilizadas
* **Node.js** (Ambiente de execução)
* **Firebase/Google Drive API** (Armazenamento)
* **PDF-Lib** (ou biblioteca similar utilizada para `field.setText`)

---
