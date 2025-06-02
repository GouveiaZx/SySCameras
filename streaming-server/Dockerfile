FROM ossrs/srs:4

# Copiar configuração
COPY srs.conf /usr/local/srs/conf/srs.conf

# Expor portas
EXPOSE 1935 1985 8080 8088

# Iniciar SRS
CMD ["./objs/srs", "-c", "conf/srs.conf"] 