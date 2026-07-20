import http.server
import json
import os
import re
import urllib.parse

PORT = 8000
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

# In-memory database
state = {
    "event_active": True,
    "users": {},      # cup_id -> user_dict
    "cheers": set(),   # set of tuples (from_cup_id, to_cup_id)
    "matches": {},    # match_id -> match_dict
    "messages": {},   # match_id -> list of message_dicts
    "mural_messages": [], # list of message dicts: { id, text, status, timestamp }
    "gallery_photos": [], # list of gallery dicts: { id, sender_name, image, timestamp }
    "active_promo": None, # dict: { text, end_time } or None
    "active_announcement": None, # dict: { text, timestamp } or None
    "winning_matches": {}, # match_id -> voucher_code
}

# Pre-populated mock profiles for a lively event simulation
MOCK_PROFILES = {
    "cup_mock1": {
        "id": "cup_mock1",
        "name": "Carol",
        "age": 23,
        "clothes": "Vestido preto brilhante e jaqueta jeans rasgada",
        "instagram": "@carol_vibe",
        "avatar": "/static/images/carol.png",
        "location": "VIP",
        "vibe": "Paquerar",
        "active": True
    },
    "cup_mock2": {
        "id": "cup_mock2",
        "name": "Mateus",
        "age": 25,
        "clothes": "Camiseta preta do Daft Punk e boné virado",
        "instagram": "@mateus.music",
        "avatar": "/static/images/mateus.png",
        "location": "Pista",
        "vibe": "Dançar",
        "active": True
    },
    "cup_mock3": {
        "id": "cup_mock3",
        "name": "Juliana",
        "age": 22,
        "clothes": "Top prata holográfico e maquiagem neon",
        "instagram": "@juju_dance",
        "avatar": "/static/images/juliana.png",
        "location": "Pista",
        "vibe": "Paquerar",
        "active": True
    },
    "cup_mock4": {
        "id": "cup_mock4",
        "name": "Rodrigo",
        "age": 27,
        "clothes": "Camisa aberta estampada florida e óculos escuros",
        "instagram": "@rodrigo.party",
        "avatar": "/static/images/rodrigo.png",
        "location": "Bar",
        "vibe": "Amigos",
        "active": True
    },
    "cup_mock5": {
        "id": "cup_mock5",
        "name": "DJ Kael",
        "age": 28,
        "clothes": "Moletom preto oversized com fone neon no pescoço",
        "instagram": "@djkael_oficial",
        "avatar": "/static/images/kael.png",
        "location": "Palco",
        "vibe": "Dançar",
        "active": True
    }
}

# Add mock profiles to state
for k, v in MOCK_PROFILES.items():
    state["users"][k] = v

class CopoSocialRequestHandler(http.server.BaseHTTPRequestHandler):
    
    def end_headers(self):
        # Allow CORS for easy development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # ------------------ API ENDPOINTS ------------------
        if path.startswith('/api/'):
            self.handle_api_get(path, query_params)
            return

        # ------------------ STATIC FILES / SPA ROUTING ------------------
        # If it is a static file request starting with /static/
        if path.startswith('/static/'):
            relative_path = path[len('/static/'):]
            clean_path = os.path.normpath(relative_path).lstrip('/')
            file_path = os.path.join(STATIC_DIR, clean_path)
            
            if file_path.startswith(STATIC_DIR) and os.path.isfile(file_path):
                self.serve_file(file_path)
            else:
                self.send_error(404, "File Not Found")
            return

        # Rota exclusiva do moderador → serve moderacao.html separado
        if path == '/moderacao':
            mod_path = os.path.join(STATIC_DIR, 'moderacao.html')
            if os.path.isfile(mod_path):
                self.serve_file(mod_path)
            else:
                self.send_error(404, "Moderacao page not found")
            return

        # SPA Routing: Any other path (like /copo/XYZ, /telao, /barman, /) serves index.html
        index_path = os.path.join(STATIC_DIR, 'index.html')
        if os.path.isfile(index_path):
            self.serve_file(index_path)
        else:
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(b"<h1>Copo Social</h1><p>Diretorio /static/index.html nao encontrado.</p>")

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path.startswith('/api/'):
            # Read JSON body
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length) if content_length > 0 else b''
            
            try:
                body = json.loads(post_data.decode('utf-8')) if post_data else {}
            except Exception as e:
                self.send_json({"error": "Invalid JSON"}, status=400)
                return
                
            self.handle_api_post(path, body)
            return
            
        self.send_error(404, "Not Found")

    def serve_file(self, file_path):
        mime_types = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        }
        _, ext = os.path.splitext(file_path)
        content_type = mime_types.get(ext.lower(), 'application/octet-stream')

        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Internal Server Error: {str(e)}")

    def send_json(self, data, status=200):
        response_bytes = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def handle_api_get(self, path, query_params):
        # 1. Get Event Configuration / Status
        if path == '/api/config':
            self.send_json({
                "event_active": state["event_active"],
                "total_users": len(state["users"]),
                "total_matches": len(state["matches"])
            })
            return

        # 2. Get Users Active in the Event
        elif path == '/api/users':
            active_users = [u for u in state["users"].values() if u.get("active", True)]
            self.send_json(active_users)
            return

        # 3. Get Matches for a specific user
        elif path == '/api/matches':
            cup_id = query_params.get('cup_id', [None])[0]
            if not cup_id:
                self.send_json({"error": "Missing cup_id parameter"}, status=400)
                return
            
            user_matches = []
            for match_id, m in state["matches"].items():
                if cup_id in [m["user1"], m["user2"]]:
                    other_id = m["user2"] if m["user1"] == cup_id else m["user1"]
                    other_user = state["users"].get(other_id)
                    if other_user:
                        user_matches.append({
                            "match_id": match_id,
                            "user": other_user,
                            "timestamp": m["timestamp"]
                        })
            self.send_json(user_matches)
            return

        # 4. Get Messages for a specific match
        elif path == '/api/messages':
            match_id = query_params.get('match_id', [None])[0]
            if not match_id:
                self.send_json({"error": "Missing match_id parameter"}, status=400)
                return
            
            chat_messages = state["messages"].get(match_id, [])
            self.send_json(chat_messages)
            return

        # 5. Get Real-time updates / Pings for a user (Notifications)
        elif path == '/api/ping':
            cup_id = query_params.get('cup_id', [None])[0]
            if not cup_id:
                self.send_json({"error": "Missing cup_id parameter"}, status=400)
                return
            
            # Check if there is an incoming Brinde invitation that hasn't been matched yet
            incoming_cheers = []
            for from_id, to_id in state["cheers"]:
                if to_id == cup_id:
                    # check if not already matched
                    already_matched = False
                    for m in state["matches"].values():
                        if (m["user1"] == from_id and m["user2"] == to_id) or (m["user1"] == to_id and m["user2"] == from_id):
                            already_matched = True
                            break
                    if not already_matched:
                        sender = state["users"].get(from_id)
                        if sender:
                            incoming_cheers.append(sender)

            # Check if there are matches
            user_matches = []
            for match_id, m in state["matches"].items():
                if cup_id in [m["user1"], m["user2"]]:
                    other_id = m["user2"] if m["user1"] == cup_id else m["user1"]
                    other_user = state["users"].get(other_id)
                    if other_user:
                        user_matches.append({
                            "match_id": match_id,
                            "user": other_user
                        })

            # Check if this user is a winner in any match
            my_prize_voucher = None
            for match_id, voucher in state["winning_matches"].items():
                if cup_id in match_id:
                    # Found! Get other user details
                    m_info = state["matches"].get(match_id, {})
                    other_id = m_info.get("user2") if m_info.get("user1") == cup_id else m_info.get("user1")
                    other_user = state["users"].get(other_id, {}).get("name", "Parceiro") if other_id else "Parceiro"
                    my_prize_voucher = {
                        "voucher": voucher,
                        "partner": other_user,
                        "match_id": match_id
                    }

            self.send_json({
                "event_active": state["event_active"],
                "incoming_cheers": incoming_cheers,
                "matches": user_matches,
                "active_promo": state["active_promo"],
                "prize_winner": my_prize_voucher,
                "announcement": state["active_announcement"]
            })
            return

        # 6. Get stats for public big screen (Telão)
        elif path == '/api/stats':
            approved_messages = [m for m in state["mural_messages"] if m["status"] == "approved"]
            approved_photos = [p for p in state["gallery_photos"] if p.get("status", "pending") == "approved"]
            self.send_json({
                "event_active": state["event_active"],
                "users_count": len(state["users"]),
                "matches_count": len(state["matches"]),
                "recent_matches": [
                    {
                        "user1": state["users"].get(m["user1"], {}).get("name", "Anônimo"),
                        "user2": state["users"].get(m["user2"], {}).get("name", "Anônimo"),
                        "timestamp": m["timestamp"]
                    }
                    for m in list(state["matches"].values())[-5:]
                ],
                "active_users": [u for u in state["users"].values() if u.get("active", True)],
                "mural_messages": approved_messages[-10:], # Last 10 approved
                "gallery_photos": approved_photos[-8:], # Last 8 approved photos for Telão
                "announcement": state["active_announcement"]
            })
            return

        # 7. Get approved mural messages
        elif path == '/api/mural':
            approved_messages = [m for m in state["mural_messages"] if m["status"] == "approved"]
            self.send_json(approved_messages)
            return

        # 8. Get all mural messages for moderation
        elif path == '/api/admin/mural':
            self.send_json(state["mural_messages"])
            return

        # 9. Get latest approved gallery photos for users
        elif path == '/api/gallery':
            approved_photos = [p for p in state["gallery_photos"] if p.get("status", "pending") == "approved"]
            self.send_json(approved_photos[-30:])
            return

        # 9B. Get all gallery photos for moderation
        elif path == '/api/admin/gallery':
            self.send_json(state["gallery_photos"])
            return

        self.send_error(404, "API Endpoint Not Found")

    def handle_api_post(self, path, body):
        # 1. Register or Update User Profile (vibe added)
        if path == '/api/register':
            cup_id = body.get("cup_id")
            name = body.get("name")
            age = body.get("age")
            clothes = body.get("clothes")
            instagram = body.get("instagram")
            avatar = body.get("avatar")
            location = body.get("location", "Pista")
            vibe = body.get("vibe", "Amigos")

            if not cup_id or not name:
                self.send_json({"error": "cup_id and name are required"}, status=400)
                return

            if instagram and not instagram.startswith('@'):
                instagram = '@' + instagram

            user_data = {
                "id": cup_id,
                "name": name,
                "age": int(age) if age else 18,
                "clothes": clothes,
                "instagram": instagram,
                "avatar": avatar,
                "location": location,
                "vibe": vibe,
                "active": True
            }

            state["users"][cup_id] = user_data
            self.send_json({"success": True, "user": user_data})
            return

        # 2. Update Location
        elif path == '/api/location':
            cup_id = body.get("cup_id")
            location = body.get("location")

            if not cup_id or not location:
                self.send_json({"error": "cup_id and location are required"}, status=400)
                return

            if cup_id in state["users"]:
                state["users"][cup_id]["location"] = location
                self.send_json({"success": True, "location": location})
            else:
                self.send_json({"error": "User not found"}, status=404)
            return

        # 3. Send a Brinde (Cheers 🥂)
        elif path == '/api/like':
            from_cup_id = body.get("from_cup_id")
            to_cup_id = body.get("to_cup_id")

            if not from_cup_id or not to_cup_id:
                self.send_json({"error": "from_cup_id and to_cup_id are required"}, status=400)
                return

            state["cheers"].add((from_cup_id, to_cup_id))

            is_match = (to_cup_id, from_cup_id) in state["cheers"]
            match_id = None

            if is_match:
                match_id = f"match_{min(from_cup_id, to_cup_id)}_{max(from_cup_id, to_cup_id)}"
                if match_id not in state["matches"]:
                    import time
                    state["matches"][match_id] = {
                        "id": match_id,
                        "user1": from_cup_id,
                        "user2": to_cup_id,
                        "timestamp": int(time.time())
                    }
                    state["messages"][match_id] = []

            self.send_json({
                "success": True,
                "match": is_match,
                "match_id": match_id
            })
            return

        # 4. Send Message in Chat
        elif path == '/api/messages':
            match_id = body.get("match_id")
            sender = body.get("sender")
            text = body.get("text")

            if not match_id or not sender or not text:
                self.send_json({"error": "match_id, sender, and text are required"}, status=400)
                return

            if match_id not in state["messages"]:
                state["messages"][match_id] = []

            import time
            message_data = {
                "sender": sender,
                "text": text,
                "timestamp": int(time.time())
            }
            state["messages"][match_id].append(message_data)

            # --- Mock Bot Responses for interactive feel ---
            match_info = state["matches"].get(match_id)
            if match_info:
                recipient = match_info["user2"] if match_info["user1"] == sender else match_info["user1"]
                if recipient.startswith("cup_mock"):
                    mock_user = state["users"].get(recipient)
                    reply_text = self.get_mock_reply(mock_user["name"], text)
                    bot_msg = {
                        "sender": recipient,
                        "text": reply_text,
                        "timestamp": int(time.time()) + 1
                    }
                    state["messages"][match_id].append(bot_msg)

            self.send_json({"success": True, "message": message_data})
            return

        # 5. Send Mural Message (recados anônimos)
        elif path == '/api/mural':
            sender = body.get("sender")
            text = body.get("text", "").strip()

            if not sender or not text:
                self.send_json({"error": "sender and text are required"}, status=400)
                return

            if len(text) > 60:
                self.send_json({"error": "Texto muito longo (máximo 60 caracteres)"}, status=400)
                return

            # Filtro básico de palavras inadequadas (Português)
            BLACKLIST = [
                "puta", "putaria", "porra", "caralho", "foder", "foda", 
                "buceta", "cu", "viado", "corno", "merda", "bosta",
                "cacete", "piranha", "arrombado", "foda-se"
            ]
            text_lower = text.lower()
            contains_bad_word = any(re.search(rf"\b{word}\b", text_lower) for word in BLACKLIST)

            import time
            msg_id = f"msg_{int(time.time() * 1000)}"
            msg_data = {
                "id": msg_id,
                "text": text,
                "sender_name": state["users"].get(sender, {}).get("name", "Anônimo"),
                "status": "rejected" if contains_bad_word else "approved",
                "timestamp": int(time.time())
            }

            state["mural_messages"].append(msg_data)
            
            if contains_bad_word:
                self.send_json({"error": "Linguagem inadequada detectada. Recado recusado automaticamente."}, status=400)
            else:
                self.send_json({"success": True, "message": msg_data})
            return

        # 5B. Send Gallery Photo
        elif path == '/api/gallery':
            sender = body.get("sender")
            image = body.get("image")

            if not sender or not image:
                self.send_json({"error": "sender and image are required"}, status=400)
                return

            import time
            photo_id = f"photo_{int(time.time() * 1000)}"
            photo_data = {
                "id": photo_id,
                "sender_name": state["users"].get(sender, {}).get("name", "Anônimo"),
                "image": image,
                "timestamp": int(time.time()),
                "status": "approved",
                "cheers_count": 0,
                "cheers_by": []
            }

            state["gallery_photos"].append(photo_data)
            state["gallery_photos"] = state["gallery_photos"][-30:]
            
            self.send_json({"success": True, "photo": photo_data})
            return

        # 5C. Cheers a Photo (Curtir sem Facebook/Instagram)
        elif path == '/api/gallery/cheers':
            photo_id = body.get("photo_id")
            cup_id = body.get("cup_id")

            if not photo_id or not cup_id:
                self.send_json({"error": "photo_id and cup_id are required"}, status=400)
                return

            found_photo = None
            for p in state["gallery_photos"]:
                if p["id"] == photo_id:
                    found_photo = p
                    break

            if not found_photo:
                self.send_json({"error": "Photo not found"}, status=404)
                return

            # Garantir campos inicializados
            if "cheers_by" not in found_photo:
                found_photo["cheers_by"] = []
            if "cheers_count" not in found_photo:
                found_photo["cheers_count"] = 0

            # Evitar brindar duas vezes na mesma foto
            if cup_id not in found_photo["cheers_by"]:
                found_photo["cheers_by"].append(cup_id)
                found_photo["cheers_count"] += 1

            self.send_json({
                "success": True, 
                "cheers_count": found_photo["cheers_count"]
            })
            return

        # 6. Moderate Mural Message (Admin)
        elif path == '/api/admin/mural/moderate':
            msg_id = body.get("msg_id")
            action = body.get("action") # "approve" or "reject"

            if not msg_id or not action:
                self.send_json({"error": "msg_id and action are required"}, status=400)
                return

            found = False
            for m in state["mural_messages"]:
                if m["id"] == msg_id:
                    m["status"] = "approved" if action == "approve" else "rejected"
                    found = True
                    break

            if found:
                self.send_json({"success": True})
            else:
                self.send_json({"error": "Message not found"}, status=404)
            return

        # 6B. Moderate Gallery Photo (Admin)
        elif path == '/api/admin/gallery/moderate':
            photo_id = body.get("photo_id")
            action = body.get("action") # "approve" or "reject"

            if not photo_id or not action:
                self.send_json({"error": "photo_id and action are required"}, status=400)
                return

            found = False
            for p in state["gallery_photos"]:
                if p["id"] == photo_id:
                    p["status"] = "approved" if action == "approve" else "rejected"
                    found = True
                    break

            if found:
                self.send_json({"success": True})
            else:
                self.send_json({"error": "Photo not found"}, status=404)
            return

        # 7. Trigger Promotional Deal (Admin)
        elif path == '/api/admin/trigger-promo':
            text = body.get("text", "").strip()
            duration = int(body.get("duration", 60)) # default 60s

            if not text:
                state["active_promo"] = None
                self.send_json({"success": True, "message": "Promo cleared"})
                return

            import time
            state["active_promo"] = {
                "text": text,
                "end_time": int(time.time()) + duration
            }
            self.send_json({"success": True, "active_promo": state["active_promo"]})
            return

        # 7B. Trigger Global Announcement (Admin)
        elif path == '/api/admin/trigger-announcement':
            text = body.get("text", "").strip()

            if not text:
                self.send_json({"error": "text is required"}, status=400)
                return

            import time
            state["active_announcement"] = {
                "text": text,
                "timestamp": int(time.time())
            }
            self.send_json({"success": True, "active_announcement": state["active_announcement"]})
            return

        # 7C. Clear Global Announcement (Admin)
        elif path == '/api/admin/clear-announcement':
            state["active_announcement"] = None
            self.send_json({"success": True})
            return

        # 8. Draw Prize Winner (Admin)
        elif path == '/api/admin/draw-prize':
            if not state["matches"]:
                self.send_json({"error": "Nenhum brinde (match) confirmado na balada ainda para poder sortear!"}, status=400)
                return

            import random
            match_id = random.choice(list(state["matches"].keys()))
            
            if match_id not in state["winning_matches"]:
                voucher = f"PREMIO-{random.randint(1000, 9999)}"
                state["winning_matches"][match_id] = voucher
            else:
                voucher = state["winning_matches"][match_id]

            m = state["matches"][match_id]
            u1 = state["users"].get(m["user1"], {}).get("name", "Usuário")
            u2 = state["users"].get(m["user2"], {}).get("name", "Usuário")

            self.send_json({
                "success": True,
                "winner_names": f"{u1} & {u2}",
                "voucher": voucher,
                "match_id": match_id
            })
            return

        # 9. Toggle Event Status (Simulation Endpoint)
        elif path == '/api/admin/toggle-event':
            state["event_active"] = not state["event_active"]
            self.send_json({"success": True, "event_active": state["event_active"]})
            return

        # 10. Reset all data (Simulation Endpoint)
        elif path == '/api/admin/reset':
            state["users"] = {}
            state["cheers"] = set()
            state["matches"] = {}
            state["messages"] = {}
            state["mural_messages"] = []
            state["active_promo"] = None
            state["winning_matches"] = {}
            for k, v in MOCK_PROFILES.items():
                state["users"][k] = v
            self.send_json({"success": True, "message": "State reset successful"})
            return

        self.send_error(404, "API Endpoint Not Found")

    def get_mock_reply(self, bot_name, user_text):
        user_text = user_text.lower()
        replies = {
            "Carol": [
                "Oii! Que legal que você me brindou! 🥂 Estou curtindo muito a festa.",
                "Simm! Estou na área VIP perto do bar principal, onde você tá?",
                "Haha adorei! Vamos pegar um drink juntos? Me encontra no bar em 5 minutos! 🍹"
            ],
            "Mateus": [
                "Fala brother! Tranquilo? 🥂 Som tá animal hoje né!",
                "Estou aqui no meio da pista de dança, perto do painel de LED principal. Cola aqui!",
                "Bora brindarrrr! 🍻 Pegar uma breja ali no bar rápido."
            ],
            "Juliana": [
                "Oiii! 🥂 Adorei o seu brinde! Menina/menino, o som hoje tá tudo!",
                "Tô dançando perto do palco agora, a vibe tá surreal! Me acha aqui!",
                "Bora beber alguma coisa! Um Gin tônica? Te vejo no bar do canto!"
            ],
            "Rodrigo": [
                "E aí! Beleza? 🥂 Cara, a fila do bar tá um pouco grande mas tá valendo.",
                "Estou encostado no bar principal conversando com a galera. E você, por onde anda?",
                "Bora tomar uma dose de tequila? Aproveitamos o cupom grátis! Te espero no balcão 🍸"
            ],
            "DJ Kael": [
                "Fala! Valeu pelo brinde! 🥂 Tocando as brabas hoje!",
                "Estou aqui na cabine do palco focado no set! Mas logo mais dou um pulo na pista.",
                "Daqui a pouco dou uma pausa. Valeu pela vibe! 🎧✨"
            ]
        }
        
        char_replies = replies.get(bot_name, ["🥂 Viva! Nos encontramos por aí!"])
        
        if "onde" in user_text or "cadê" in user_text or "tá" in user_text:
            return char_replies[1]
        elif "beber" in user_text or "bar" in user_text or "drink" in user_text or "brindar" in user_text or "cupom" in user_text:
            return char_replies[2]
        else:
            return char_replies[0]

def run():
    print(f"Iniciando o servidor Copo Social em http://localhost:{PORT}...")
    os.makedirs(os.path.join(STATIC_DIR, 'css'), exist_ok=True)
    os.makedirs(os.path.join(STATIC_DIR, 'js'), exist_ok=True)
    
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, CopoSocialRequestHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor finalizado pelo usuário.")
        httpd.server_close()

if __name__ == '__main__':
    run()
