const functions = require("firebase-functions");
const { PDFDocument } = require("pdf-lib");
const { Storage } = require("@google-cloud/storage");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors")({ origin: true });
const admin     = require("firebase-admin");
admin.initializeApp();

const storage = new Storage();
const bucketName = ""; //confidencial

const { google } = require("googleapis");
const fs = require("fs");
const os = require("os");
const path = require("path");

const auth = new google.auth.GoogleAuth({
  keyFile: "./service-account.json",
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

function sanitizarNome(username) {
  return username
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase();
}

async function uploadPdfToDrive(username, pdfBuffer) {
  const parentFolderId = ""; //confidencial

  const folderMetadata = {
    name: username,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentFolderId],
  };

  const folder = await drive.files.create({
    resource: folderMetadata,
    fields: "id",
  });

  const folderId = folder.data.id;

  const tempFilePath = path.join(os.tmpdir(), `termo-${Date.now()}.pdf`);
  fs.writeFileSync(tempFilePath, pdfBuffer);

  const fileMetadata = {
    name: "termo.pdf",
    parents: [folderId],
  };

  const media = {
    mimeType: "application/pdf",
    body: fs.createReadStream(tempFilePath),
  };

  const uploadedFile = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: "id, webViewLink, webContentLink",
  });

  fs.unlinkSync(tempFilePath);
  console.log("📄 PDF enviado para o Drive:", uploadedFile.data.webViewLink);

  return uploadedFile.data;
}


//funcao usada pra criar pdfs. Eles podem ser do tipo relatorio, certificado ou termo. No caso do relatorio, apenas sao preenchidas as tabelas com os dados do JSON recebido (atraves de passagem de coordenadas x e y do PDF). Para termo, são inseridos os campos e, após, a assinatura no x e y especificado. Para certificados, apenas são preechidos os campos. Caso seja termo, é salvo no Drive, enquanto os outros são salvos apenas no FireStore.
exports.fillPdf = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pdfUrl, campos, ...outrosCampos } = req.body;
      const camposPreenchimento = campos || outrosCampos;

      if (!pdfUrl || Object.keys(camposPreenchimento).length === 0) {
        console.error("Faltando pdfUrl ou campos para preenchimento");
        return res.status(400).json({ error: "pdfUrl e campos são obrigatórios" });
      }

      // 1. Identificação dos tipos
      const isRelatorio = camposPreenchimento.tipo === "relatorio";
      const isCertificado = camposPreenchimento.tipo === "certificado"; // NOVO

      const nomeBase = isRelatorio
        ? camposPreenchimento.idrelatorio || `relatorio1`
        : req.body.username || "anonimo";
      const nomeSanitizado = sanitizarNome(nomeBase);

      // 2. Definição do Caminho do Arquivo (MODIFICADO para incluir certificados)
      let fileName;
      if (isRelatorio) {
        fileName = `relatorios/${nomeBase}.pdf`;
      } else if (isCertificado) {
        fileName = `certificados/${nomeSanitizado}.pdf`;
      } else {
        fileName = `termos/${nomeSanitizado}/termo.pdf`;
      }

      const templatePath = path.join(__dirname, "templates", pdfUrl);
      const pdfBytes = fs.readFileSync(templatePath);
      console.log("📄 Template carregado localmente:", templatePath);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      console.log(`✅ Encontrados ${fields.length} campos no formulário`);
      fields.forEach(f => console.log("➡️ Campo:", f.getName()));

      for (const [campo, valor] of Object.entries(camposPreenchimento)) {
        try {
          const field = form.getTextField(campo);
          field.setText(valor);
          console.log(`✔️ Campo preenchido: ${campo} = ${valor}`);
        } catch (err) {
          console.warn(`⚠️ Campo '${campo}' não encontrado ou erro ao preencher.`);
        }
      }

      // Assinatura (caso não seja relatório E NEM certificado)
      if (!isRelatorio && !isCertificado && camposPreenchimento.assinatura) {
        try {
          console.log("🔋 Baixando imagem da assinatura...");
          const axios = require("axios");
          const imgResponse = await axios.get(camposPreenchimento.assinatura, { responseType: "arraybuffer" });
          const imgBytes = imgResponse.data;

          let assinaturaImage;
            try {
              assinaturaImage = await pdfDoc.embedPng(imgBytes);
            } catch {
              assinaturaImage = await pdfDoc.embedJpg(imgBytes);
            }
          const page = pdfDoc.getPages()[0];

          const x = parseFloat(req.body.assinaturaX) || 120;
          const y = parseFloat(req.body.assinaturaY) || 145;
          const width = parseFloat(req.body.assinaturaWidth) || 160;
          const height = parseFloat(req.body.assinaturaHeight) || 40;

          page.drawImage(assinaturaImage, { x, y, width, height });
          console.log(`🔋 Assinatura inserida nas coordenadas x:${x}, y:${y}`);
        } catch (imgErr) {
          console.warn("⚠️ Erro ao inserir assinatura:", imgErr.message);
        }
      }

      form.flatten();
      
      if (isRelatorio) {
        const plantios = camposPreenchimento.plantioslista || {};
        const plantiosKeys = Object.keys(plantios);
        const totalPlantios = plantiosKeys.length;
        const temPlantios = totalPlantios > 0;

        const eventos = camposPreenchimento.eventoslista || {};
        const eventosKeys = Object.keys(eventos);
        const totalEventos = eventosKeys.length;
        const temEventos = totalEventos > 0;

        const PAGINA_MODELO_PLANTIOS_IDX = 1; // Página 2
        const PAGINA_MODELO_EVENTOS_IDX = 2; // Página 3

        const maxPorPaginaPlantios = 23;
        const maxPorPaginaEventos = 23;

        const [plantiosModeloCopia] = temPlantios 
            ? await pdfDoc.copyPages(pdfDoc, [PAGINA_MODELO_PLANTIOS_IDX]) 
            : [null];
            
        const [eventosModeloCopia] = temEventos 
            ? await pdfDoc.copyPages(pdfDoc, [PAGINA_MODELO_EVENTOS_IDX]) 
            : [null];

        pdfDoc.removePage(PAGINA_MODELO_EVENTOS_IDX);
        pdfDoc.removePage(PAGINA_MODELO_PLANTIOS_IDX);

        const font = await pdfDoc.embedFont('Helvetica');
        let paginasExtrasPlantio = 0;
        let indiceInsercaoAtual = 1;

        if (temPlantios) {
          try {
            paginasExtrasPlantio = Math.ceil(totalPlantios / maxPorPaginaPlantios);
            console.log(`🪴 Total de plantios: ${totalPlantios}, páginas necessárias: ${paginasExtrasPlantio}`);

            const paginasPlantioAdicionadas = [];
            for (let i = 0; i < paginasExtrasPlantio; i++) {
              const paginaParaAdicionar = (i === 0) 
                  ? plantiosModeloCopia 
                  : await pdfDoc.copyPages(pdfDoc, [pdfDoc.getPageCount() - 1]).then(p => p[0]);            
              const novaPagina = pdfDoc.insertPage(indiceInsercaoAtual + i, paginaParaAdicionar);
              paginasPlantioAdicionadas.push(novaPagina);
            }

            const startX = 15;
            const startY = 673;
            const lineHeight = 28;

            for (let i = 0; i < totalPlantios; i++) {
              const paginaIndex = Math.floor(i / maxPorPaginaPlantios);
              const linhaIndex = i % maxPorPaginaPlantios;
              const y = startY - linhaIndex * lineHeight;

              const pg = paginasPlantioAdicionadas[paginaIndex];
              const { data, local, coords, nmudas } = plantios[plantiosKeys[i]];

              pg.drawText(`${plantiosKeys[i]}`, { x: startX, y, size: 10, font });
              pg.drawText(`${coords || ""}`, { x: startX + 33, y, size: 8.5, font });
              pg.drawText(`${data || ""}`, { x: startX + 205, y, size: 10, font });
              pg.drawText(`${local || ""}`, { x: startX + 273, y, size: 10, font });
              pg.drawText(`${nmudas || ""}`, { x: startX + 493, y, size: 10, font });
            }
            console.log("✅ Campos de plantios desenhados com sucesso.");
            indiceInsercaoAtual += paginasExtrasPlantio;
          } catch (err) {
            console.error("💥 Erro ao desenhar os dados de plantios:", err);
          }
        } else {
            console.log("ℹ️ Nenhum plantio. Página de plantios não adicionada.");
        }
        
        if (temEventos) {
          try {
            const paginasExtrasEventos = Math.ceil(totalEventos / maxPorPaginaEventos);
            console.log(`🎉 Total de eventos: ${totalEventos}, páginas necessárias: ${paginasExtrasEventos}`);

            const paginasEventosAdicionadas = [];
            for (let i = 0; i < paginasExtrasEventos; i++) {
              const paginaParaAdicionar = (i === 0)
                ? eventosModeloCopia
                : await pdfDoc.copyPages(pdfDoc, [pdfDoc.getPageCount() - 1]).then(p => p[0]);
              const novaPagina = pdfDoc.insertPage(indiceInsercaoAtual + i, paginaParaAdicionar);
              paginasEventosAdicionadas.push(novaPagina);
            }

            const startX = 15;
            const startY = 673;
            const lineHeight = 28;

            for (let i = 0; i < totalEventos; i++) {
              const paginaIndex = Math.floor(i / maxPorPaginaEventos);
              const linhaIndex = i % maxPorPaginaEventos;
              const y = startY - linhaIndex * lineHeight;

              const pg = paginasEventosAdicionadas[paginaIndex];
              const { tipo, data, local, publicototal } = eventos[eventosKeys[i]];

              pg.drawText(`${eventosKeys[i]}`, { x: startX, y, size: 10, font });
              pg.drawText(`${tipo || ""}`, { x: startX + 33, y, size: 10, font });
              pg.drawText(`${data || ""}`, { x: startX + 205, y, size: 10, font });
              pg.drawText(`${local || ""}`, { x: startX + 273, y, size: 10, font });
              pg.drawText(`${publicototal || ""}`, { x: startX + 505, y, size: 10, font });
            }
            console.log("✅ Campos de eventos desenhados com sucesso.");
          } catch (err) {
            console.error("💥 Erro ao desenhar os dados de eventos:", err);
          }
        } else {
             console.log("ℹ️ Nenhum evento. Página de eventos não adicionada.");
        }
      }

      const filledPdfBytes = await pdfDoc.save();

      const downloadToken = uuidv4();
      const file = storage.bucket(bucketName).file(fileName);

      await file.save(filledPdfBytes, {
        metadata: {
          contentType: "application/pdf",
          metadata: {
            firebaseStorageDownloadTokens: downloadToken
          }
        },
        resumable: false
      });

      const pdfUrlDownload = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`;
      console.log("✅ PDF salvo com sucesso:", pdfUrlDownload);

      // Upload para Drive: Apenas se NÃO for relatório E NEM certificado
      if (!isRelatorio && !isCertificado) {
        await uploadPdfToDrive(nomeSanitizado, filledPdfBytes); 
      } else {
        console.log("📄 Relatório ou Certificado detectado — não será enviado ao Google Drive.");
      }

      res.json({ pdfUrl: pdfUrlDownload });
    } catch (err) {
      console.error("💥 Erro inesperado:", err);
      res.status(500).json({ error: "Erro ao preencher o PDF" });
    }
  });
});