# Servidor de Streaming RTMP (SRS)

Este diretório contém a configuração do servidor SRS (Simple RTMP Server) para receber e distribuir streams RTMP das câmeras IP.

## Funcionalidades

- Recebe streams RTSP convertidas pelo worker
- Distribui streams RTMP para os clientes web
- Suporte a RTMP, HLS e FLV
- Interface HTTP para administração

## Portas

- 1935: RTMP (principal)
- 1985: HTTP API 
- 8080: HTTP Server
- 8088: HTTPS Server

## Como iniciar

Para iniciar o servidor, execute:

```bash
docker-compose up -d
```

## Verificação de status

Para verificar o status do servidor:

```bash
curl http://localhost:1985/api/v1/versions
```

## URLs de streaming

Formato para publicação:
```
rtmp://[servidor-ip]:1935/live/[stream-key]
```

Formato para visualização:
```
rtmp://[servidor-ip]:1935/live/[stream-key]
http://[servidor-ip]:8080/live/[stream-key].flv
http://[servidor-ip]:8080/live/[stream-key]/index.m3u8
```

## Integração com o sistema

O worker RTSP enviará streams para o servidor SRS via RTMP.
O frontend utilizará o servidor SRS para exibir as streams ao vivo.

## Configuração avançada

Para ajustar configurações adicionais, edite o arquivo `srs.conf` antes de criar o container. 