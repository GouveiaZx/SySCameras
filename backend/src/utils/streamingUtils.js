/**
 * Utilitários para manipulação de streams e URLs
 */

/**
 * Gera um ID único para a stream
 * @returns {string} ID único para a stream
 */
function generateStreamId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `cam_${timestamp}_${random}`;
}

/**
 * Gera uma URL RTMP para o servidor SRS configurado
 * @param {string} streamId - ID opcional da stream (se não fornecido, um novo será gerado)
 * @returns {string} URL RTMP completa
 */
function generateRtmpUrl(streamId = null) {
  const srsBaseUrl = process.env.SRS_RTMP_BASE_URL || 'rtmp://localhost:1935/live';
  const streamKey = streamId || generateStreamId();
  return `${srsBaseUrl}/${streamKey}`;
}

/**
 * Extrai o ID da stream de uma URL RTMP
 * @param {string} rtmpUrl - URL RTMP completa
 * @returns {string} ID da stream
 */
function extractStreamIdFromRtmpUrl(rtmpUrl) {
  if (!rtmpUrl) return '';
  const parts = rtmpUrl.split('/');
  return parts[parts.length - 1];
}

/**
 * Gera uma URL HTTP para HLS a partir de uma URL RTMP
 * @param {string} rtmpUrl - URL RTMP completa
 * @returns {string} URL HTTP para HLS
 */
function getHlsUrlFromRtmpUrl(rtmpUrl) {
  const streamId = extractStreamIdFromRtmpUrl(rtmpUrl);
  const srsHttpBase = process.env.SRS_HTTP_BASE_URL || 'http://localhost:8080/live';
  return `${srsHttpBase}/${streamId}/index.m3u8`;
}

/**
 * Gera uma URL HTTP para FLV a partir de uma URL RTMP
 * @param {string} rtmpUrl - URL RTMP completa
 * @returns {string} URL HTTP para FLV
 */
function getFlvUrlFromRtmpUrl(rtmpUrl) {
  const streamId = extractStreamIdFromRtmpUrl(rtmpUrl);
  const srsHttpBase = process.env.SRS_HTTP_BASE_URL || 'http://localhost:8080/live';
  return `${srsHttpBase}/${streamId}.flv`;
}

module.exports = {
  generateStreamId,
  generateRtmpUrl,
  extractStreamIdFromRtmpUrl,
  getHlsUrlFromRtmpUrl,
  getFlvUrlFromRtmpUrl
}; 