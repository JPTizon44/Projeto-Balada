"""
Ponto de entrada para Render.com e outros serviços de hospedagem.
Lê a porta da variável de ambiente PORT (Render usa 10000 por padrão).
"""
import os
import sys
import http.server

# Adiciona o diretório atual ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import server as copo_server

# Render.com define PORT via variável de ambiente
PORT = int(os.environ.get('PORT', 8000))

if __name__ == '__main__':
    print(f"🍸 Iniciando Copo Social na porta {PORT}...")
    os.makedirs(os.path.join(copo_server.STATIC_DIR, 'css'), exist_ok=True)
    os.makedirs(os.path.join(copo_server.STATIC_DIR, 'js'), exist_ok=True)

    server_address = ('0.0.0.0', PORT)
    httpd = http.server.HTTPServer(server_address, copo_server.CopoSocialRequestHandler)
    print(f"✅ Servidor rodando na porta {PORT}!")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor finalizado.")
        httpd.server_close()
