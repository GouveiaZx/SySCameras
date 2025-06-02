const fs = require('fs');
const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsCommand } = require('@aws-sdk/client-s3');

// Configura o AWS SDK v3 para o Wasabi
const s3Client = new S3Client({
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com',
  region: process.env.WASABI_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY,
  },
  forcePathStyle: true
});

const BUCKET_NAME = process.env.WASABI_BUCKET;

/**
 * Faz upload de um arquivo para o Wasabi S3
 * @param {string} filePath - Caminho do arquivo local
 * @param {string} filename - Nome do arquivo remoto
 * @returns {Promise<string>} URL do arquivo no Wasabi
 */
async function uploadToWasabi(filePath, filename) {
  console.log(`Iniciando upload para Wasabi: ${filename}`);
  
  // Lê o arquivo
  const fileContent = fs.readFileSync(filePath);
  
  // Define a data atual para organização em pastas
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // Caminho no bucket com organização por data
  const s3Key = `recordings/${year}/${month}/${day}/${filename}`;
  
  // Parâmetros para o upload
  const uploadCommand = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileContent,
    ContentType: 'video/mp4'
  });
  
  try {
    // Envia o arquivo para o Wasabi
    await s3Client.send(uploadCommand);
    const fileUrl = `${process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com'}/${BUCKET_NAME}/${s3Key}`;
    console.log(`Arquivo enviado com sucesso para: ${fileUrl}`);
    return fileUrl;
  } catch (error) {
    console.error(`Erro ao fazer upload para Wasabi: ${error}`);
    throw error;
  }
}

/**
 * Exclui um arquivo do Wasabi S3
 * @param {string} fileKey - Chave do arquivo no S3
 * @returns {Promise<void>}
 */
async function deleteFromWasabi(fileKey) {
  const deleteCommand = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey
  });
  
  try {
    await s3Client.send(deleteCommand);
    console.log(`Arquivo excluído do Wasabi: ${fileKey}`);
  } catch (error) {
    console.error(`Erro ao excluir arquivo do Wasabi: ${error}`);
    throw error;
  }
}

/**
 * Lista arquivos em um diretório do Wasabi S3
 * @param {string} prefix - Prefixo (diretório) para listar
 * @returns {Promise<Array>} Lista de arquivos
 */
async function listFilesFromWasabi(prefix) {
  const listCommand = new ListObjectsCommand({
    Bucket: BUCKET_NAME,
    Prefix: prefix
  });
  
  try {
    const data = await s3Client.send(listCommand);
    return data.Contents || [];
  } catch (error) {
    console.error(`Erro ao listar arquivos do Wasabi: ${error}`);
    throw error;
  }
}

module.exports = {
  uploadToWasabi,
  deleteFromWasabi,
  listFilesFromWasabi
}; 