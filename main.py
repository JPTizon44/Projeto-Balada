"""
Ponto de entrada principal para o Replit.
O Replit define a variável de ambiente PORT (geralmente 8080).
Importa e executa o servidor do server.py adaptando a porta.
"""
import os
import http.server
import server as copo_server

# Replit define PORT=8080 via variável de ambiente
PORT = int(os.environ.get('PORT', 8000))

copo_server.PORT = PORT

if __name__ == '__main__':
    print(f"🍸 Iniciando Copo Social na porta {PORT}...")
    import os
    os.makedirs(os.path.join(copo_server.STATIC_DIR, 'css'), exist_ok=True)
    os.makedirs(os.path.join(copo_server.STATIC_DIR, 'js'), exist_ok=True)
    
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, copo_server.CopoSocialRequestHandler)
    print(f"✅ Servidor rodando! Acesse o link público do Replit.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor finalizado.")
        httpd.server_close()
